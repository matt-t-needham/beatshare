import { useEffect, useState, useCallback, useRef } from 'react';
import { useSongStore } from './store';
import { Header } from './components/Header';
import { StepGrid } from './components/StepGrid';
import { AddTrack } from './components/AddTrack';
import { SoundPacksPanel } from './components/SoundPacksPanel';
import { playSong, stopSong, setTickCallback, updateScheduledNotes } from './audio';
import { loadFromHash, cleanHash, buildShareUrl, exportToFile } from './persistence';
import { exportMidi } from './midi-export';
import { getInstalledPacks, hasSample } from './sound-pack-store';
import { SPIN_PACK_ID, fetchMissingSamples } from './spin';
import { transposeAllTracks } from './scales';
import type { InstalledPack, MusicalKey, ScaleType } from './types';

function App() {
  const store = useSongStore();
  const { song, resolution, selectedTrackId } = store;
  const [playing, setPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [packsOpen, setPacksOpen] = useState(false);
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const songRef = useRef(song);
  songRef.current = song;

  const [missingDialog, setMissingDialog] = useState<string[] | null>(null);
  const [soloTrackId, setSoloTrackId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1); // 0.5, 0.75, 1, 1.25, 1.5

  // Load from URL hash on mount
  useEffect(() => {
    const loaded = loadFromHash();
    if (loaded) {
      store.loadSong(loaded);
      cleanHash();
      showToast('Song loaded from shared link');
      // Check for missing samples
      checkMissingSamples(loaded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkMissingSamples(loadedSong: typeof song) {
    const needed = new Set<string>();
    for (const track of loadedSong.tracks) {
      if (track.type !== 'sample' || track.sample?.packId !== SPIN_PACK_ID) continue;
      if (track.sample.sampleName) needed.add(track.sample.sampleName);
      for (const step of track.steps) {
        if (step.sampleName) needed.add(step.sampleName);
      }
    }
    if (needed.size === 0) return;

    const missing: string[] = [];
    for (const name of needed) {
      if (!(await hasSample(SPIN_PACK_ID, name))) missing.push(name);
    }
    if (missing.length > 0) setMissingDialog(missing);
  }

  async function handleFetchMissing() {
    if (!missingDialog) return;
    const paths = missingDialog;
    setMissingDialog(null);
    showToast(`Downloading ${paths.length} missing samples...`);
    try {
      await fetchMissingSamples(paths, (status) => showToast(status));
      refreshPacks();
      showToast('Missing samples downloaded!');
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`);
    }
  }

  // Load installed packs on mount
  useEffect(() => {
    refreshPacks();
  }, []);

  const refreshPacks = useCallback(() => {
    getInstalledPacks().then(setInstalledPacks).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Build effective song with solo applied
  const soloTrackIdRef = useRef(soloTrackId);
  soloTrackIdRef.current = soloTrackId;
  const effectiveSong = useCallback(() => {
    const s = songRef.current;
    const solo = soloTrackIdRef.current;
    if (!solo) return s;
    return {
      ...s,
      tracks: s.tracks.map(t => ({
        ...t,
        muted: t.id !== solo ? true : t.muted,
      })),
    };
  }, []);

  const handlePlay = useCallback(async () => {
    setTickCallback((tick) => setCurrentTick(tick));
    await playSong(effectiveSong());
    setPlaying(true);
  }, [effectiveSong]);

  const handleStop = useCallback(() => {
    stopSong();
    setPlaying(false);
    setCurrentTick(null);
  }, []);

  // Spacebar start/stop
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (playingRef.current) handleStop();
      else handlePlay();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handlePlay, handleStop]);

  // Re-schedule events while playing without restarting from the beginning
  useEffect(() => {
    if (playing) {
      updateScheduledNotes(effectiveSong());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.tracks, song.bpm, song.measures, soloTrackId]);

  const handleShare = useCallback(() => {
    const url = buildShareUrl(songRef.current);
    const len = url.length;
    navigator.clipboard.writeText(url).then(() => {
      if (len > 2000) {
        showToast(`Link copied (${len} chars - may be truncated by some apps)`);
      } else {
        showToast('Link copied to clipboard');
      }
    }).catch(() => {
      showToast('Failed to copy link');
    });
  }, []);

  const handleExportMidi = useCallback(() => {
    exportMidi(songRef.current);
    showToast('MIDI file downloaded');
  }, []);

  const handleSaveFile = useCallback(() => {
    exportToFile(songRef.current);
    showToast('File saved');
  }, []);

  const handleOpenFile = useCallback((loadedSong: typeof song) => {
    store.loadSong(loadedSong);
    showToast('Song loaded from file');
    checkMissingSamples(loadedSong);
  }, [store]);

  const handleDoubleUp = useCallback(() => {
    const s = songRef.current;
    const oldMeasures = s.measures;
    const ticksPerMeasure = 64; // 4/4 time = 64 ticks per measure
    const totalOldTicks = oldMeasures * ticksPerMeasure;
    const newMeasures = Math.min(oldMeasures * 2, 16);
    store.setSong({
      ...s,
      measures: newMeasures,
      tracks: s.tracks.map(t => ({
        ...t,
        steps: [
          ...t.steps,
          ...t.steps
            .filter(step => step.position + totalOldTicks < newMeasures * ticksPerMeasure)
            .map(step => ({
              ...step,
              position: step.position + totalOldTicks,
            })),
        ],
      })),
    });
    showToast(`Doubled to ${newMeasures} bars`);
  }, [store]);

  const handleKeyChange = useCallback((newKey: MusicalKey, newScale: ScaleType) => {
    const s = songRef.current;
    const oldKey = s.key;
    const oldScale = s.scale;
    if (oldKey === newKey && oldScale === newScale) return;
    const transposedTracks = transposeAllTracks(s.tracks, oldKey, oldScale, newKey, newScale);
    store.setSong({ ...s, key: newKey, scale: newScale, tracks: transposedTracks });
  }, [store]);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      <Header
        store={store}
        playing={playing}
        onPlay={handlePlay}
        onStop={handleStop}
        onShare={handleShare}
        onSaveFile={handleSaveFile}
        onOpenFile={handleOpenFile}
        onExportMidi={handleExportMidi}
        onDoubleUp={handleDoubleUp}
        resolution={resolution}
        onResolutionChange={store.setResolution}
        onKeyChange={handleKeyChange}
        zoom={zoom}
        onZoomChange={setZoom}
      />
      <StepGrid
        song={song}
        resolution={resolution}
        zoom={zoom}
        selectedTrackId={selectedTrackId}
        currentTick={currentTick}
        soloTrackId={soloTrackId}
        onSelectTrack={store.setSelectedTrackId}
        onToggleStep={store.toggleStep}
        onSetStep={store.setStep}
        onClearStep={store.clearStep}
        onMuteTrack={(id, muted) => store.updateTrack(id, { muted })}
        onSoloTrack={(id) => setSoloTrackId(prev => prev === id ? null : id)}
        onRemoveTrack={store.removeTrack}
        onCloneTrack={(track) => store.addTrack({ ...track, id: crypto.randomUUID(), name: `${track.name} (copy)` })}
        onUpdateTrack={store.updateTrack}
        onMoveTrack={store.moveTrack}
        installedPacks={installedPacks}
        addTrackSlot={
          <AddTrack
            onAdd={store.addTrack}
            trackCount={song.tracks.length}
            installedPacks={installedPacks}
          />
        }
      />
      <SoundPacksPanel
        open={packsOpen}
        onToggle={() => setPacksOpen(p => !p)}
        installedPacks={installedPacks}
        onPacksChanged={refreshPacks}
        onToast={showToast}
        song={song}
        onSongUpdate={store.loadSong}
      />

      {/* Missing samples dialog */}
      {missingDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setMissingDialog(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-3">Missing Samples</h3>
            <p className="text-sm text-zinc-300 mb-3">
              This shared song uses {missingDialog.length} sample{missingDialog.length > 1 ? 's' : ''} not installed locally. Download them from GitHub?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMissingDialog(null)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer">Skip</button>
              <button onClick={handleFetchMissing} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer">Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm border border-zinc-600 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;

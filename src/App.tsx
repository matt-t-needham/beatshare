import { useEffect, useState, useCallback, useRef } from 'react';
import { useSongStore } from './store';
import { Header } from './components/Header';
import { Transport } from './components/Transport';
import { StepGrid } from './components/StepGrid';
import { AddTrack } from './components/AddTrack';
import { SoundPacksPanel } from './components/SoundPacksPanel';
import { playSong, stopSong, setTickCallback, setMetronome, getMetronome, updateScheduledNotes } from './audio';
import { loadFromHash, cleanHash, buildShareUrl } from './persistence';
import { exportMidi } from './midi-export';

function App() {
  const store = useSongStore();
  const { song, resolution, selectedTrackId } = store;
  const [playing, setPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [packsOpen, setPacksOpen] = useState(false);
  const [metronome, setMetronomeState] = useState(getMetronome());
  const songRef = useRef(song);
  songRef.current = song;

  // Load from URL hash on mount
  useEffect(() => {
    const loaded = loadFromHash();
    if (loaded) {
      store.loadSong(loaded);
      cleanHash();
      showToast('Song loaded from shared link');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handlePlay = useCallback(async () => {
    setTickCallback((tick) => setCurrentTick(tick));
    await playSong(songRef.current);
    setPlaying(true);
  }, []);

  const handleStop = useCallback(() => {
    stopSong();
    setPlaying(false);
    setCurrentTick(null);
  }, []);

  // Re-schedule events while playing without restarting from the beginning
  useEffect(() => {
    if (playing) {
      updateScheduledNotes(song);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.tracks, song.bpm, song.measures]);

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

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      <Header store={store} onShare={handleShare} onExportMidi={handleExportMidi} />
      <Transport
        playing={playing}
        onPlay={handlePlay}
        onStop={handleStop}
        resolution={resolution}
        onResolutionChange={store.setResolution}
        metronome={metronome}
        onMetronomeChange={(enabled) => {
          setMetronome(enabled);
          setMetronomeState(enabled);
        }}
      />
      <AddTrack onAdd={store.addTrack} />
      <StepGrid
        song={song}
        resolution={resolution}
        selectedTrackId={selectedTrackId}
        currentTick={currentTick}
        onSelectTrack={store.setSelectedTrackId}
        onToggleStep={store.toggleStep}
        onSetStep={store.setStep}
        onClearStep={store.clearStep}
        onMuteTrack={(id, muted) => store.updateTrack(id, { muted })}
        onRemoveTrack={store.removeTrack}
        onUpdateTrack={store.updateTrack}
      />
      <SoundPacksPanel open={packsOpen} onToggle={() => setPacksOpen(p => !p)} />

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

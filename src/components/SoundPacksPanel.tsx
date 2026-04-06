import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { SOUND_PACK_DIRECTORY } from '../sound-packs';
import type { SoundPackEntry } from '../sound-packs';
import type { InstalledPack, Song } from '../types';
import { savePack, removePack, removeSample } from '../sound-pack-store';
import { executeSpin, SPIN_PACK_ID, type DownloadProgress } from '../spin';
import { classifySample, friendlyName } from '../sample-categories';

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.webm'];

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function baseName(path: string): string {
  return path.split('/').pop()!;
}

async function extractSamplesFromZip(data: ArrayBuffer): Promise<Map<string, ArrayBuffer>> {
  const zip = await JSZip.loadAsync(data);
  const samples = new Map<string, ArrayBuffer>();
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, file) => {
    if (!file.dir && isAudioFile(relativePath)) {
      promises.push(
        file.async('arraybuffer').then(buf => {
          samples.set(baseName(relativePath), buf);
        })
      );
    }
  });

  await Promise.all(promises);
  return samples;
}

interface SoundPacksPanelProps {
  open: boolean;
  onToggle: () => void;
  installedPacks: InstalledPack[];
  onPacksChanged: () => void;
  onToast: (msg: string) => void;
  song?: Song;
  onSongUpdate?: (song: Song) => void;
}

export function SoundPacksPanel({ open, onToggle, installedPacks, onPacksChanged, onToast, song, onSongUpdate }: SoundPacksPanelProps) {
  const [consentDialog, setConsentDialog] = useState<SoundPackEntry | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlDialog, setUrlDialog] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  const installedIds = new Set(installedPacks.map(p => p.id));
  function handleDownload(pack: SoundPackEntry) {
    if (!pack.zipUrl) return;
    window.open(pack.zipUrl, '_blank');
    setConsentDialog(null);
    onToast('Downloading .zip — use "Import .zip from file" to install it');
  }

  async function handleSpin(mode: 'fresh' | 'add' | 'respin') {
    setLoading('Starting spin...');
    setDownloadProgress(null);
    try {
      const result = await executeSpin(mode, 6, setLoading, setDownloadProgress);

      // For respin: update song to remap old sample names to new ones
      if (mode === 'respin' && result.remapping && song && onSongUpdate) {
        const updated: Song = {
          ...song,
          tracks: song.tracks.map(t => {
            if (t.type !== 'sample' || t.sample?.packId !== SPIN_PACK_ID) return t;
            const newBrush = result.remapping!.get(t.sample.sampleName) ?? t.sample.sampleName;
            return {
              ...t,
              sample: { ...t.sample, sampleName: newBrush },
              steps: t.steps.map(s => {
                if (!s.sampleName) return s;
                const newName = result.remapping!.get(s.sampleName) ?? s.sampleName;
                return { ...s, sampleName: newName };
              }),
            };
          }),
        };
        onSongUpdate(updated);
      }

      onPacksChanged();
      onToast(`Got ${result.newSamples.length} samples!`);
    } catch (err: any) {
      onToast(`Spin failed: ${err.message}`);
    }
    setLoading(null);
    setDownloadProgress(null);
  }

  async function handleRemoveSample(packId: string, sampleName: string) {
    try {
      await removeSample(packId, sampleName);
      onPacksChanged();
    } catch (err: any) {
      onToast(`Remove failed: ${err.message}`);
    }
  }

  async function handleImportFile() {
    const file = pendingFileRef.current;
    if (!file) return;
    setImportDialog(false);
    setLoading(`Reading ${file.name}...`);
    try {
      const data = await file.arrayBuffer();
      setLoading('Extracting samples...');
      const samples = await extractSamplesFromZip(data);

      if (samples.size === 0) {
        onToast('No audio files found in zip');
        setLoading(null);
        return;
      }

      const cleanName = file.name.replace(/\.zip$/i, '').replace(/-main$/, '');
      const knownPack = SOUND_PACK_DIRECTORY.find(p =>
        cleanName === p.id || p.url.includes(cleanName) || p.name.includes(cleanName)
      );
      const entry: SoundPackEntry = knownPack ?? {
        id: cleanName.replace(/[^a-zA-Z0-9-_]/g, '-'),
        name: cleanName,
        description: `Imported from ${file.name}`,
        license: 'Unknown',
        source: 'Local file',
        url: '',
        estimatedSize: 'Unknown',
      };

      setLoading(`Saving ${samples.size} samples...`);
      await savePack(entry, samples);
      onPacksChanged();
      onToast(`Imported ${entry.name} (${samples.size} samples)`);
    } catch (err: any) {
      onToast(`Import failed: ${err.message}`);
    }
    pendingFileRef.current = null;
    setLoading(null);
  }

  async function handleLoadFromUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlDialog(false);
    setUrlInput('');
    setLoading('Downloading...');
    try {
      let resp: Response;
      try {
        resp = await fetch(url);
      } catch {
        throw new Error('Download blocked (CORS). Try downloading the file manually and using "Import .zip from file" instead.');
      }
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const data = await resp.arrayBuffer();

      setLoading('Extracting samples...');
      const samples = await extractSamplesFromZip(data);

      if (samples.size === 0) {
        onToast('No audio files found in zip');
        setLoading(null);
        return;
      }

      const packId = url.split('/').pop()?.replace(/\.zip$/i, '') || 'url-pack';
      const entry: SoundPackEntry = {
        id: packId.replace(/[^a-zA-Z0-9-_]/g, '-'),
        name: packId.replace(/[^a-zA-Z0-9-_ ]/g, ' '),
        description: `Loaded from URL`,
        license: 'Unknown',
        source: url,
        url,
        zipUrl: url,
        estimatedSize: 'Unknown',
      };

      setLoading(`Saving ${samples.size} samples...`);
      await savePack(entry, samples);
      onPacksChanged();
      onToast(`Installed ${entry.name} (${samples.size} samples)`);
    } catch (err: any) {
      onToast(`Failed: ${err.message}`);
    }
    setLoading(null);
  }

  async function handleRemove(packId: string) {
    setRemoveConfirm(null);
    setLoading('Removing...');
    try {
      await removePack(packId);
      onPacksChanged();
      onToast('Pack removed');
    } catch (err: any) {
      onToast(`Remove failed: ${err.message}`);
    }
    setLoading(null);
  }

  return (
    <>
      <button
        onClick={onToggle}
        className="px-4 py-2 border-t border-zinc-700 text-left text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer w-full flex items-center gap-2"
      >
        <span className="w-7 h-7 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={open ? 'M2 7.5L6 3.5L10 7.5' : 'M2 4.5L6 8.5L10 4.5'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Sound Packs
      </button>

      {open && (
        <div className="border-t border-zinc-700 bg-zinc-900 px-4 py-3 max-h-96 overflow-y-auto">
          {loading && (
            <div className="bg-purple-900/30 border border-purple-700 rounded px-3 py-2 text-sm text-purple-300 mb-3">
              <div>{loading}</div>
              {downloadProgress && downloadProgress.picked.length > 0 && (
                <div className="mt-2 flex flex-col gap-0.5">
                  {downloadProgress.picked.map(path => {
                    const done = downloadProgress.completed.has(path);
                    const fail = downloadProgress.failed.has(path);
                    return (
                      <div
                        key={path}
                        className={`text-xs flex items-center gap-1.5 ${
                          done ? 'text-green-400' : fail ? 'text-zinc-500 line-through' : 'text-purple-300/70'
                        }`}
                      >
                        <span>{done ? '\u2713' : fail ? '\u2717' : '\u25CB'}</span>
                        <span>{friendlyName(path)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Installed packs */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Installed Packs</h4>
            {installedPacks.length === 0 ? (
              <p className="text-xs text-zinc-500">No packs installed yet. Download one below or import a .zip file.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {installedPacks.map(pack => (
                  <div key={pack.id} className="bg-zinc-800 rounded p-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setExpandedPackId(expandedPackId === pack.id ? null : pack.id)}
                        className="flex items-center gap-1 text-sm text-white hover:text-purple-300 cursor-pointer min-w-0"
                      >
                        <span className="text-xs text-zinc-500">{expandedPackId === pack.id ? '▾' : '▸'}</span>
                        <span className="truncate">{pack.name}</span>
                        <span className="text-xs text-zinc-500 shrink-0">({pack.sampleNames.length} samples)</span>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        {pack.id === SPIN_PACK_ID && (
                          <>
                            <button
                              onClick={() => handleSpin('respin')}
                              disabled={!!loading || pack.sampleNames.length === 0}
                              className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded cursor-pointer disabled:opacity-50"
                              title="Replace all samples with new random ones"
                            >
                              Re-spin
                            </button>
                            <button
                              onClick={() => handleSpin('add')}
                              disabled={!!loading}
                              className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded cursor-pointer disabled:opacity-50"
                              title="Add 6 more random samples"
                            >
                              Spin+
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setRemoveConfirm(pack.id)}
                          className="px-2 py-0.5 bg-zinc-700 hover:bg-red-700 text-zinc-400 hover:text-white text-xs rounded cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {expandedPackId === pack.id && (
                      <div className="mt-2 pl-4 flex flex-wrap gap-1">
                        {pack.sampleNames.map(name => {
                          const cat = classifySample(name);
                          return (
                            <span
                              key={name}
                              className="text-xs text-white rounded px-1.5 py-0.5 flex items-center gap-1"
                              style={{ backgroundColor: cat.color }}
                              title={name}
                            >
                              {friendlyName(name)}
                              <button
                                onClick={() => handleRemoveSample(pack.id, name)}
                                className="text-white/60 hover:text-white cursor-pointer ml-0.5"
                                title="Remove this sample"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pack directory */}
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Browse Packs</h4>
          <div className="flex flex-col gap-2 mb-4">
            {SOUND_PACK_DIRECTORY.map(pack => {
              const isSpinPack = !!pack.repoOwner;
              const isInstalled = installedIds.has(pack.id);

              return (
                <div
                  key={pack.id}
                  className="bg-zinc-800 rounded p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{pack.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{pack.description}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      License: {pack.license} &middot; Source: <a href={pack.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">{pack.source}</a> &middot; Size: {pack.estimatedSize}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={pack.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded"
                    >
                      View
                    </a>
                    {isSpinPack ? (
                      <button
                        onClick={() => handleSpin(isInstalled ? 'add' : 'fresh')}
                        disabled={!!loading}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded cursor-pointer disabled:opacity-50"
                      >
                        {isInstalled ? 'Spin+ 6' : 'Spin 6'}
                      </button>
                    ) : isInstalled ? (
                      <span className="px-2 py-1 bg-green-800 text-green-300 text-xs rounded">Installed</span>
                    ) : (
                      <button
                        onClick={() => setConsentDialog(pack)}
                        disabled={!!loading}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded cursor-pointer disabled:opacity-50"
                      >
                        Download
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Import actions */}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!!loading}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded cursor-pointer disabled:opacity-50"
            >
              Import .zip from file
            </button>
            <button
              onClick={() => setUrlDialog(true)}
              disabled={!!loading}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded cursor-pointer disabled:opacity-50"
            >
              Load from URL
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                pendingFileRef.current = file;
                setImportDialog(true);
              }
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Download consent dialog */}
      {consentDialog && (
        <Dialog title="Download Sound Pack" onClose={() => setConsentDialog(null)}>
          <div className="text-sm text-zinc-300 space-y-3">
            <p><strong>What:</strong> {consentDialog.name}</p>
            <p><strong>From:</strong> {consentDialog.url}</p>
            <p><strong>Size:</strong> {consentDialog.estimatedSize}</p>
            <p><strong>License:</strong> {consentDialog.license}</p>
            <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-400 space-y-1">
              <p><strong>How it works:</strong></p>
              <p>1. Click "Download .zip" — your browser will save the file</p>
              <p>2. Use "Import .zip from file" below to load it into BeatShare</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setConsentDialog(null)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer">Cancel</button>
            <button onClick={() => handleDownload(consentDialog)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer">Download .zip</button>
          </div>
        </Dialog>
      )}

      {/* Import .zip dialog */}
      {importDialog && (
        <Dialog title="Import Local Sound Pack" onClose={() => { setImportDialog(false); pendingFileRef.current = null; }}>
          <div className="text-sm text-zinc-300 space-y-3">
            <p><strong>What:</strong> Reading <em>{pendingFileRef.current?.name}</em> from your local machine.</p>
            <p><strong>Note:</strong> No network request will be made. The file is read directly from your device.</p>
            <p className="text-xs text-zinc-500">Audio samples (.wav, .mp3, .ogg, .flac) will be extracted and stored in your browser.</p>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => { setImportDialog(false); pendingFileRef.current = null; }} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer">Cancel</button>
            <button onClick={handleImportFile} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer">Import</button>
          </div>
        </Dialog>
      )}

      {/* Load from URL dialog */}
      {urlDialog && (
        <Dialog title="Load Sound Pack from URL" onClose={() => setUrlDialog(false)}>
          <div className="text-sm text-zinc-300 space-y-3">
            <p>Enter the URL to a .zip file containing audio samples.</p>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com/samples.zip"
              className="w-full bg-zinc-800 text-white px-3 py-2 rounded border border-zinc-600 text-sm outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => { setUrlDialog(false); setUrlInput(''); }} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer">Cancel</button>
            <button onClick={handleLoadFromUrl} disabled={!urlInput} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer disabled:opacity-50">Download</button>
          </div>
        </Dialog>
      )}

      {/* Remove confirmation dialog */}
      {removeConfirm && (
        <Dialog title="Remove Sound Pack" onClose={() => setRemoveConfirm(null)}>
          <p className="text-sm text-zinc-300">Are you sure you want to remove this sound pack? Any tracks using its samples will lose their audio.</p>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setRemoveConfirm(null)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer">Cancel</button>
            <button onClick={() => handleRemove(removeConfirm)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded cursor-pointer">Remove</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 max-w-md w-full mx-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

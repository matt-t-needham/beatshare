import { useState, useRef } from 'react';
import { SOUND_PACK_DIRECTORY } from '../sound-packs';
import type { SoundPackEntry } from '../sound-packs';

interface SoundPacksPanelProps {
  open: boolean;
  onToggle: () => void;
}

export function SoundPacksPanel({ open, onToggle }: SoundPacksPanelProps) {
  const [consentDialog, setConsentDialog] = useState<SoundPackEntry | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlDialog, setUrlDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="px-4 py-2 border-t border-zinc-700 text-left text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer w-full"
      >
        {open ? '▾ Sound Packs' : '▸ Sound Packs'}
      </button>

      {open && (
        <div className="border-t border-zinc-700 bg-zinc-900 px-4 py-3 max-h-80 overflow-y-auto">
          <p className="text-xs text-zinc-500 mb-3">
            Browse open-source sample packs. Nothing is downloaded until you confirm.
          </p>

          {/* Pack directory */}
          <div className="flex flex-col gap-2 mb-4">
            {SOUND_PACK_DIRECTORY.map(pack => (
              <div
                key={pack.id}
                className="bg-zinc-800 rounded p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{pack.name}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{pack.description}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    License: {pack.license} &middot; Source: {pack.source}
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
                  <button
                    onClick={() => setConsentDialog(pack)}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Import actions */}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded cursor-pointer"
            >
              Import .zip from file
            </button>
            <button
              onClick={() => setUrlDialog(true)}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded cursor-pointer"
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
                setImportDialog(true);
              }
            }}
          />
        </div>
      )}

      {/* Download consent dialog */}
      {consentDialog && (
        <Dialog
          title="Download Sound Pack"
          onClose={() => setConsentDialog(null)}
        >
          <div className="text-sm text-zinc-300 space-y-3">
            <p><strong>What:</strong> {consentDialog.name}</p>
            <p><strong>From:</strong> {consentDialog.url}</p>
            <p><strong>Why:</strong> This will download audio sample files so you can use them as tracks in your song.</p>
            <p><strong>License:</strong> {consentDialog.license}</p>
            <p className="text-xs text-zinc-500">
              The files will be cached in your browser so they don't need to be downloaded again.
              You can clear the cache at any time from the Sound Packs panel.
            </p>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setConsentDialog(null)}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // TODO: Implement actual download + IndexedDB caching
                setConsentDialog(null);
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer"
            >
              Download
            </button>
          </div>
        </Dialog>
      )}

      {/* Import .zip dialog */}
      {importDialog && (
        <Dialog
          title="Import Local Sound Pack"
          onClose={() => setImportDialog(false)}
        >
          <div className="text-sm text-zinc-300 space-y-3">
            <p><strong>What:</strong> Reading a .zip file from your local machine.</p>
            <p><strong>Note:</strong> No network request will be made. The file is read directly from your device.</p>
            <p className="text-xs text-zinc-500">
              The samples will be stored in your browser's local storage for use in tracks.
            </p>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setImportDialog(false)}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // TODO: Implement JSZip extraction + IndexedDB storage
                setImportDialog(false);
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer"
            >
              Import
            </button>
          </div>
        </Dialog>
      )}

      {/* Load from URL dialog */}
      {urlDialog && (
        <Dialog
          title="Load Sound Pack from URL"
          onClose={() => setUrlDialog(false)}
        >
          <div className="text-sm text-zinc-300 space-y-3">
            <p>Enter the URL to a .zip file containing audio samples.</p>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com/samples.zip"
              className="w-full bg-zinc-800 text-white px-3 py-2 rounded border border-zinc-600 text-sm outline-none focus:border-purple-500"
            />
            {urlInput && (
              <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-400">
                <p><strong>What will happen:</strong></p>
                <p>1. Download the .zip file from: {urlInput}</p>
                <p>2. Extract audio files from the archive</p>
                <p>3. Cache them locally in your browser</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => { setUrlDialog(false); setUrlInput(''); }}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // TODO: Implement URL fetch + extraction
                setUrlDialog(false);
                setUrlInput('');
              }}
              disabled={!urlInput}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Download
            </button>
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

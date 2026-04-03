import { useState, useEffect } from 'react';
import type { SongStore } from '../store';

interface HeaderProps {
  store: SongStore;
  onShare: () => void;
  onExportMidi: () => void;
}

export function Header({ store, onShare, onExportMidi }: HeaderProps) {
  const { song, updateSong } = store;
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(song.name);

  // Local state for numeric inputs so typing isn't clamped mid-keystroke
  const [bpmInput, setBpmInput] = useState(String(song.bpm));
  const [measuresInput, setMeasuresInput] = useState(String(song.measures));

  // Sync local state when song changes externally (e.g. URL load)
  useEffect(() => { setBpmInput(String(song.bpm)); }, [song.bpm]);
  useEffect(() => { setMeasuresInput(String(song.measures)); }, [song.measures]);

  const commitBpm = () => {
    const n = Number(bpmInput);
    if (n >= 40 && n <= 300) {
      updateSong({ bpm: n });
    } else {
      setBpmInput(String(song.bpm));
    }
  };

  const commitMeasures = () => {
    const n = Number(measuresInput);
    if (n >= 1 && n <= 16 && Number.isInteger(n)) {
      updateSong({ measures: n });
    } else {
      setMeasuresInput(String(song.measures));
    }
  };

  const commitName = () => {
    updateSong({ name: nameInput.trim() || 'Untitled' });
    setEditingName(false);
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-700 bg-zinc-900">
      {/* Song name */}
      {editingName ? (
        <input
          className="bg-zinc-800 text-white text-lg font-semibold px-2 py-1 rounded border border-zinc-600 outline-none focus:border-purple-500 w-48"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
          autoFocus
        />
      ) : (
        <button
          className="text-lg font-semibold text-white hover:text-purple-400 cursor-pointer"
          onClick={() => { setNameInput(song.name); setEditingName(true); }}
          title="Click to rename"
        >
          {song.name}
        </button>
      )}

      <div className="flex items-center gap-2 ml-4">
        <label className="text-zinc-400 text-sm">BPM</label>
        <input
          type="number"
          min={40}
          max={300}
          value={bpmInput}
          onChange={e => setBpmInput(e.target.value)}
          onBlur={commitBpm}
          onKeyDown={e => { if (e.key === 'Enter') commitBpm(); }}
          className="bg-zinc-800 text-white w-16 px-2 py-1 rounded border border-zinc-600 text-sm text-center outline-none focus:border-purple-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Measures</label>
        <input
          type="number"
          min={1}
          max={16}
          value={measuresInput}
          onChange={e => setMeasuresInput(e.target.value)}
          onBlur={commitMeasures}
          onKeyDown={e => { if (e.key === 'Enter') commitMeasures(); }}
          className="bg-zinc-800 text-white w-14 px-2 py-1 rounded border border-zinc-600 text-sm text-center outline-none focus:border-purple-500"
        />
      </div>

      <div className="flex-1" />

      <button
        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded font-medium cursor-pointer"
        onClick={onShare}
      >
        Share
      </button>
      <button
        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded font-medium cursor-pointer"
        onClick={onExportMidi}
      >
        Export MIDI
      </button>
    </div>
  );
}

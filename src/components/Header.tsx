import { useState, useEffect } from 'react';
import type { SongStore } from '../store';
import type { GridResolution, MusicalKey, ScaleType } from '../types';
import { ALL_KEYS, ALL_SCALES } from '../scales';

const RESOLUTIONS: { value: GridResolution; label: string }[] = [
  { value: 8, label: '8th' },
  { value: 16, label: '16th' },
  { value: 32, label: '32nd' },
  { value: 64, label: '64th' },
];

interface HeaderProps {
  store: SongStore;
  onShare: () => void;
  onExportMidi: () => void;
  onDoubleUp: () => void;
  resolution: GridResolution;
  onResolutionChange: (r: GridResolution) => void;
  onKeyChange: (key: MusicalKey, scale: ScaleType) => void;
}

export function Header({ store, onShare, onExportMidi, onDoubleUp, resolution, onResolutionChange, onKeyChange }: HeaderProps) {
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
        <label className="text-zinc-400 text-sm">Bars</label>
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
        <button
          onClick={onDoubleUp}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded cursor-pointer"
          title="Double the bars and copy all existing content into the new bars"
        >
          Double up!
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Grid</label>
        <select
          value={resolution}
          onChange={e => onResolutionChange(Number(e.target.value) as GridResolution)}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
        >
          {RESOLUTIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Key</label>
        <select
          value={song.key}
          onChange={e => onKeyChange(e.target.value as MusicalKey, song.scale)}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
        >
          {ALL_KEYS.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select
          value={song.scale}
          onChange={e => onKeyChange(song.key, e.target.value as ScaleType)}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
        >
          {ALL_SCALES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
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

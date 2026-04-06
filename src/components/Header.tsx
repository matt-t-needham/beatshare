import { useState, useEffect, useRef } from 'react';
import type { SongStore } from '../store';
import type { GridResolution, MusicalKey, ScaleType } from '../types';
import { ALL_KEYS, ALL_SCALES } from '../scales';
import { importFromFile } from '../persistence';

const RESOLUTIONS: { value: GridResolution; label: string }[] = [
  { value: 8, label: '8th' },
  { value: 16, label: '16th' },
  { value: 32, label: '32nd' },
  { value: 64, label: '64th' },
];

interface HeaderProps {
  store: SongStore;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onShare: () => void;
  onSaveFile: () => void;
  onOpenFile: (song: any) => void;
  onExportMidi: () => void;
  onDoubleUp: () => void;
  onClearAll: () => void;
  resolution: GridResolution;
  onResolutionChange: (r: GridResolution) => void;
  onKeyChange: (key: MusicalKey, scale: ScaleType) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];

export function Header({ store, playing, onPlay, onStop, onShare, onSaveFile, onOpenFile, onExportMidi, onDoubleUp, onClearAll, resolution, onResolutionChange, onKeyChange, zoom, onZoomChange }: HeaderProps) {
  const { song, updateSong } = store;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(song.name);
  const [confirmClear, setConfirmClear] = useState(false);

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

  const commitMeasures = (val?: string) => {
    const n = Number(val ?? measuresInput);
    if (n >= 1 && n <= 8 && Number.isInteger(n)) {
      updateSong({ measures: n });
    } else if (n > 8) {
      updateSong({ measures: 8 });
      setMeasuresInput('8');
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

      <button
        onClick={playing ? onStop : onPlay}
        className={`px-4 py-1.5 rounded font-medium text-sm cursor-pointer ${
          playing
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-green-600 hover:bg-green-500 text-white'
        }`}
      >
        {playing ? 'Stop' : 'Play'}
      </button>

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
          max={8}
          value={measuresInput}
          onChange={e => {
            setMeasuresInput(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1) {
              commitMeasures(e.target.value);
            }
          }}
          onBlur={() => commitMeasures()}
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
        <label className="text-zinc-400 text-sm">Zoom</label>
        <select
          value={zoom}
          onChange={e => onZoomChange(Number(e.target.value))}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
        >
          {ZOOM_LEVELS.map(z => (
            <option key={z} value={z}>{Math.round(z * 100)}%</option>
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
        onClick={() => {
          if (confirmClear) {
            onClearAll();
            setConfirmClear(false);
          } else {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
          }
        }}
        className={`px-3 py-1.5 text-sm rounded font-medium cursor-pointer ${
          confirmClear
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
        }`}
      >
        {confirmClear ? 'Sure?' : 'Clear'}
      </button>

      <button
        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded font-medium cursor-pointer"
        onClick={onShare}
      >
        Share
      </button>
      <button
        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded font-medium cursor-pointer"
        onClick={onSaveFile}
      >
        Save
      </button>
      <button
        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded font-medium cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        Open
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".beatshare,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const song = importFromFile(text);
            onOpenFile(song);
          } catch {
            // handled by parent via toast
          }
          e.target.value = '';
        }}
      />
      <button
        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded font-medium cursor-pointer"
        onClick={onExportMidi}
      >
        Export MIDI
      </button>
    </div>
  );
}

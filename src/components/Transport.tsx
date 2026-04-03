import type { GridResolution } from '../types';

interface TransportProps {
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  resolution: GridResolution;
  onResolutionChange: (r: GridResolution) => void;
  metronome: boolean;
  onMetronomeChange: (enabled: boolean) => void;
}

const RESOLUTIONS: { value: GridResolution; label: string }[] = [
  { value: 8, label: '8th' },
  { value: 16, label: '16th' },
  { value: 32, label: '32nd' },
  { value: 64, label: '64th' },
];

export function Transport({ playing, onPlay, onStop, resolution, onResolutionChange, metronome, onMetronomeChange }: TransportProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-700 bg-zinc-850">
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

      <button
        onClick={() => onMetronomeChange(!metronome)}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium ${
          metronome
            ? 'bg-orange-600 hover:bg-orange-500 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400'
        }`}
        title={metronome ? 'Metronome on' : 'Metronome off'}
      >
        Metro
      </button>

      <div className="flex items-center gap-2 ml-4">
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
    </div>
  );
}

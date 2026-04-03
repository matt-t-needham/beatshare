import { useCallback, useRef } from 'react';
import type { Track, Waveform } from '../types';

interface TrackSettingsProps {
  track: Track;
  onUpdate: (updates: Partial<Track>) => void;
  inline?: boolean;
}

const WAVEFORMS: Waveform[] = ['sine', 'square', 'sawtooth', 'triangle'];

function OctaveKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const knobRef = useRef<HTMLDivElement>(null);

  // Map value (-7..+7) to rotation angle in degrees
  // -7 → -150°, 0 → 0°, +7 → +150° (300° total arc)
  const rotation = (value / 7) * 150;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startValue = value;

    const onMouseMove = (ev: MouseEvent) => {
      // Drag up = increase, down = decrease. 8px per step.
      const delta = Math.round((startY - ev.clientY) / 8);
      const newValue = Math.max(-7, Math.min(7, startValue + delta));
      onChange(newValue);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [value, onChange]);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-500 cursor-ns-resize relative select-none hover:border-purple-500 transition-colors"
        title={`Octave: ${value >= 0 ? '+' : ''}${value} (drag up/down)`}
      >
        {/* Indicator line */}
        <div
          className="absolute left-1/2 top-[3px] w-0.5 h-[14px] bg-purple-400 rounded-full origin-bottom"
          style={{
            transformOrigin: '50% 100%',
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            top: '4px',
            height: '14px',
          }}
        />
        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 bg-zinc-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>
      <span className="text-zinc-400 text-[10px] font-mono">
        {value >= 0 ? '+' : ''}{value}
      </span>
    </div>
  );
}

export function TrackSettings({ track, onUpdate, inline }: TrackSettingsProps) {
  return (
    <div
      className={`flex items-center gap-4 flex-wrap ${
        inline
          ? 'px-3 py-2 mb-1 bg-zinc-800/60 rounded'
          : 'px-4 py-3 border-t border-zinc-700 bg-zinc-900'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Name</label>
        <input
          type="text"
          value={track.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 w-28 outline-none focus:border-purple-500"
        />
      </div>

      {track.type === 'synth' && track.synth && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Wave</label>
            <select
              value={track.synth.waveform}
              onChange={e => onUpdate({ synth: { ...track.synth!, waveform: e.target.value as Waveform } })}
              className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
            >
              {WAVEFORMS.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Octave</label>
            <OctaveKnob
              value={track.synth.octave}
              onChange={v => onUpdate({ synth: { ...track.synth!, octave: v } })}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Volume</label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(track.volume * 100)}
          onChange={e => onUpdate({ volume: Number(e.target.value) / 100 })}
          className="w-24 accent-purple-500"
        />
        <span className="text-zinc-500 text-xs w-8">{Math.round(track.volume * 100)}%</span>
      </div>
    </div>
  );
}

import { useCallback, useMemo } from 'react';
import type { Track, Waveform, InstalledPack, MusicalKey, ScaleType, GridResolution } from '../types';
import { groupSamplesByCategory, classifySample, friendlyNames } from '../sample-categories';
import { PianoRoll } from './PianoRoll';

interface TrackSettingsProps {
  track: Track;
  onUpdate: (updates: Partial<Track>) => void;
  inline?: boolean;
  installedPacks?: InstalledPack[];
  songKey?: MusicalKey;
  songScale?: ScaleType;
  resolution?: GridResolution;
  measures?: number;
  currentCol?: number | null;
  onSetStep?: (trackId: string, position: number, note: number, duration: number) => void;
  onClearStep?: (trackId: string, position: number) => void;
}

// --- Knob component (reused for octave and volume) ---

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  formatValue?: (v: number) => string;
  sensitivity?: number; // pixels per step, default 8
}

function Knob({ value, min, max, onChange, label, formatValue, sensitivity = 8 }: KnobProps) {
  const range = max - min;
  // Map value to rotation: min → -150°, max → +150° (300° arc)
  const normalized = (value - min) / range; // 0..1
  const rotation = (normalized - 0.5) * 300;

  // Notch positions
  const notchCount = range;
  const notches: number[] = [];
  for (let i = 0; i <= notchCount; i++) {
    notches.push(-150 + (i / notchCount) * 300);
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startValue = value;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = Math.round((startY - ev.clientY) / sensitivity);
      const newValue = Math.max(min, Math.min(max, startValue + delta));
      onChange(newValue);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [value, onChange, min, max, sensitivity]);

  const display = formatValue ? formatValue(value) : String(value);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        onMouseDown={handleMouseDown}
        className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-500 cursor-ns-resize relative select-none hover:border-purple-500 transition-colors"
        title={`${label}: ${display} (drag up/down)`}
      >
        {/* Notches around the edge */}
        {notches.map((angle, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-1 bg-zinc-500 rounded-full"
            style={{
              left: '50%',
              top: '1px',
              transformOrigin: '50% 18px',
              transform: `translateX(-50%) rotate(${angle}deg)`,
              opacity: 0.4,
            }}
          />
        ))}
        {/* Indicator line */}
        <div
          className="absolute left-1/2 w-0.5 h-[14px] bg-purple-400 rounded-full"
          style={{
            transformOrigin: '50% 100%',
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            top: '4px',
          }}
        />
        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 bg-zinc-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>
      <span className="text-zinc-400 text-[10px] font-mono">{display}</span>
    </div>
  );
}

// --- Wave icon selector ---

const WAVE_PATHS: Record<Waveform, string> = {
  sine: 'M2 8 C4 2, 8 2, 10 8 S16 14, 18 8',
  square: 'M2 12 L2 4 L10 4 L10 12 L18 12 L18 4',
  sawtooth: 'M2 12 L10 4 L10 12 L18 4',
  triangle: 'M2 8 L6 3 L10 8 L14 13 L18 8',
};

const WAVEFORMS: Waveform[] = ['sine', 'square', 'sawtooth', 'triangle'];

function WaveSelector({ value, onChange }: { value: Waveform; onChange: (w: Waveform) => void }) {
  return (
    <div className="flex gap-1">
      {WAVEFORMS.map(w => (
        <button
          key={w}
          onClick={e => { e.stopPropagation(); onChange(w); }}
          className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
            value === w
              ? 'bg-purple-600 border border-purple-400'
              : 'bg-zinc-700 border border-zinc-600 hover:bg-zinc-600'
          }`}
          title={w}
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
            <path
              d={WAVE_PATHS[w]}
              stroke={value === w ? '#fff' : '#a1a1aa'}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

// --- Two-step sample picker ---

function SamplePicker({
  track,
  installedPacks,
  onUpdate,
}: {
  track: Track;
  installedPacks: InstalledPack[];
  onUpdate: (updates: Partial<Track>) => void;
}) {
  const pack = installedPacks.find(p => p.id === track.sample?.packId);
  const grouped = useMemo(() => pack ? groupSamplesByCategory(pack.sampleNames) : [], [pack]);
  const nameMap = useMemo(() => pack ? friendlyNames(pack.sampleNames) : new Map<string, string>(), [pack]);
  const isSmallPack = (pack?.sampleNames.length ?? 0) <= 24;

  // Small packs (spin packs): flat list with group prefix
  if (isSmallPack) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Sample</label>
        <select
          value={track.sample?.sampleName || ''}
          onChange={e => onUpdate({ sample: { ...track.sample!, sampleName: e.target.value } })}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer max-w-56"
        >
          {grouped.map(({ category, samples }) =>
            samples.map(name => (
              <option key={name} value={name}>
                {category.abbr} — {nameMap.get(name) ?? name}
              </option>
            ))
          )}
        </select>
      </div>
    );
  }

  // Large packs: two-step Type → Sample picker
  // Derive current category from selected sample
  const currentCatId = track.sample?.sampleName
    ? classifySample(track.sample.sampleName).id
    : (grouped[0]?.category.id ?? '');

  const currentGroup = grouped.find(g => g.category.id === currentCatId);

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Type</label>
        <select
          value={currentCatId}
          onChange={e => {
            const group = grouped.find(g => g.category.id === e.target.value);
            if (group && group.samples[0]) {
              onUpdate({ sample: { ...track.sample!, sampleName: group.samples[0] } });
            }
          }}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
        >
          {grouped.map(({ category, samples }) => (
            <option key={category.id} value={category.id}>
              {category.name} ({samples.length})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Sample</label>
        <select
          value={track.sample?.sampleName || ''}
          onChange={e => onUpdate({ sample: { ...track.sample!, sampleName: e.target.value } })}
          className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer max-w-48"
        >
          {currentGroup?.samples.map(name => (
            <option key={name} value={name}>{nameMap.get(name) ?? name}</option>
          ))}
        </select>
      </div>
    </>
  );
}

// --- Main component ---

export function TrackSettings({ track, onUpdate, inline, installedPacks = [], songKey, songScale, resolution, measures, currentCol, onSetStep, onClearStep }: TrackSettingsProps) {
  return (
    <div
      className={`flex items-center gap-4 flex-wrap ${
        inline
          ? 'px-3 py-2 mb-1 bg-zinc-800/60 rounded'
          : 'px-4 py-3 border-t border-zinc-700 bg-zinc-900'
      }`}
      onClick={e => e.stopPropagation()}
    >
      {track.type === 'synth' && track.synth && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Wave</label>
            <WaveSelector
              value={track.synth.waveform}
              onChange={w => onUpdate({ synth: { ...track.synth!, waveform: w } })}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Octave</label>
            <Knob
              value={track.synth.octave}
              min={-4}
              max={4}
              onChange={v => onUpdate({ synth: { ...track.synth!, octave: v } })}
              label="Octave"
              formatValue={v => (v >= 0 ? `+${v}` : String(v))}
              sensitivity={6}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Decay</label>
            <Knob
              value={track.synth.decay ?? 50}
              min={0}
              max={100}
              onChange={v => onUpdate({ synth: { ...track.synth!, decay: v } })}
              label="Decay"
              formatValue={v => `${v}%`}
              sensitivity={2}
            />
          </div>
        </>
      )}

      {track.type === 'synth' && songKey && songScale && resolution && measures != null && onSetStep && onClearStep && (
        <div className="w-full">
          <PianoRoll
            track={track}
            songKey={songKey}
            songScale={songScale}
            resolution={resolution}
            measures={measures}
            currentCol={currentCol ?? null}
            onSetStep={onSetStep}
            onClearStep={onClearStep}
          />
        </div>
      )}

      {track.type === 'sample' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Pack</label>
            <select
              value={track.sample?.packId || ''}
              onChange={e => {
                const packId = e.target.value;
                const pack = installedPacks.find(p => p.id === packId);
                const firstSample = pack?.sampleNames[0] || '';
                onUpdate({ sample: { packId, sampleName: firstSample } });
              }}
              className="bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none cursor-pointer"
            >
              <option value="">Select pack...</option>
              {installedPacks.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {track.sample?.packId && (
            <SamplePicker
              track={track}
              installedPacks={installedPacks}
              onUpdate={onUpdate}
            />
          )}

          <div className="flex items-center gap-2">
            <label className="text-zinc-400 text-sm">Pitch</label>
            <Knob
              value={track.sample?.pitchShift ?? 0}
              min={-2}
              max={2}
              onChange={v => onUpdate({ sample: { ...track.sample!, pitchShift: v } })}
              label="Pitch"
              formatValue={v => (v >= 0 ? `+${v}` : String(v))}
              sensitivity={6}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Vol</label>
        <Knob
          value={Math.round(track.volume * 100)}
          min={0}
          max={100}
          onChange={v => onUpdate({ volume: v / 100 })}
          label="Volume"
          formatValue={v => `${v}%`}
          sensitivity={2}
        />
      </div>
    </div>
  );
}

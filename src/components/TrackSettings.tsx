import { useCallback, useMemo, useState } from 'react';
import type { Track, SampleTrack, Waveform, InstalledPack, GridResolution } from '../types';
import { ticksPerStep, TRACK_DEFAULTS } from '../types';
import { groupSamplesByCategory, friendlyNames } from '../sample-categories';
import { Tooltip } from './Tooltip';

const EFFECT_PRESETS: { id: string; label: string }[] = [
  { id: 'reverb', label: 'Reverb' },
  { id: 'delay', label: 'Delay' },
  { id: 'ping-pong', label: 'Ping Pong' },
  { id: 'distortion', label: 'Distortion' },
  { id: 'bitcrush', label: 'Bit Crush' },
  { id: 'chorus', label: 'Chorus' },
  { id: 'phaser', label: 'Phaser' },
  { id: 'tremolo', label: 'Tremolo' },
  { id: 'vibrato', label: 'Vibrato' },
  { id: 'autofilter', label: 'Auto Filter' },
  { id: 'autowah', label: 'Auto Wah' },
];

interface TrackSettingsProps {
  track: Track;
  onUpdate: (updates: Partial<Track>) => void;
  installedPacks?: InstalledPack[];
  resolution?: GridResolution;
}

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  formatValue?: (v: number) => string;
  sensitivity?: number;
}

function Knob({ value, min, max, onChange, label, formatValue, sensitivity = 2 }: KnobProps) {
  const range = max - min;
  const normalized = (value - min) / range;
  const rotation = (normalized - 0.5) * 300;

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
      <Tooltip text={`${label}: ${display} (drag up/down)`}>
        <div
          onMouseDown={handleMouseDown}
          className="w-7 h-7 rounded-full bg-zinc-700 border border-zinc-500 cursor-ns-resize relative select-none hover:border-purple-500 transition-colors"
        >
          <div
            className="absolute left-1/2 w-0.5 h-2.5 bg-purple-400 rounded-full"
            style={{
              transformOrigin: '50% 100%',
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              top: '3px',
            }}
          />
          <div className="absolute left-1/2 top-1/2 w-1 h-1 bg-zinc-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
      </Tooltip>
      <span className="text-zinc-400 text-[9px] font-mono leading-none">{display}</span>
    </div>
  );
}

const WAVE_PATHS: Record<Waveform, string> = {
  sine: 'M2 8 C4 2, 8 2, 10 8 S16 14, 18 8',
  square: 'M2 12 L2 4 L10 4 L10 12 L18 12 L18 4',
  sawtooth: 'M2 12 L10 4 L10 12 L18 4',
  triangle: 'M2 8 L6 3 L10 8 L14 13 L18 8',
};

const WAVEFORMS: Waveform[] = ['sine', 'square', 'sawtooth', 'triangle'];

function WaveSelector({ value, onChange }: { value: Waveform; onChange: (w: Waveform) => void }) {
  return (
    <div className="flex gap-0.5">
      {WAVEFORMS.map(w => (
        <Tooltip text={w.charAt(0).toUpperCase() + w.slice(1) + ' wave'} key={w}>
          <button
            onClick={e => { e.stopPropagation(); onChange(w); }}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
              value === w
                ? 'bg-purple-600 border border-purple-400'
                : 'bg-zinc-700 border border-zinc-600 hover:bg-zinc-600'
            }`}
          >
            <svg width="16" height="12" viewBox="0 0 20 16" fill="none">
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
        </Tooltip>
      ))}
    </div>
  );
}

function SamplePicker({
  track,
  installedPacks,
  onUpdate,
}: {
  track: SampleTrack;
  installedPacks: InstalledPack[];
  onUpdate: (updates: Partial<Track>) => void;
}) {
  const pack = installedPacks.find(p => p.id === track.sample.packId);
  const grouped = useMemo(() => pack ? groupSamplesByCategory(pack.sampleNames) : [], [pack]);
  const nameMap = useMemo(() => pack ? friendlyNames(pack.sampleNames) : new Map<string, string>(), [pack]);

  return (
    <Row label="Sample">
      <select
        value={track.sample.sampleName || ''}
        onChange={e => onUpdate({ sample: { ...track.sample, sampleName: e.target.value } })}
        className="bg-zinc-900 text-zinc-200 text-xs px-1 py-0.5 rounded border border-zinc-600 outline-none cursor-pointer flex-1 min-w-0 h-5"
      >
        {grouped.map(({ category, samples }) =>
          samples.map(name => (
            <option key={name} value={name}>
              {category.abbr} — {nameMap.get(name) ?? name}
            </option>
          ))
        )}
      </select>
    </Row>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-zinc-400 text-[10px] uppercase tracking-wider w-10 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function KnobPair({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-around gap-2 py-1">{children}</div>;
}

export function TrackSettings({ track, onUpdate, installedPacks = [], resolution }: TrackSettingsProps) {
  const [preHumanizeSteps, setPreHumanizeSteps] = useState<typeof track.steps | null>(null);

  const handleHumanize = useCallback(() => {
    if (!resolution) return;
    setPreHumanizeSteps(track.steps);
    const stepSize = ticksPerStep(resolution);
    const newSteps = track.steps.map(step => {
      if (Math.random() < 0.5) return step;
      const shift = Math.random() < 0.5 ? -stepSize : stepSize;
      const newPos = step.position + shift;
      if (newPos < 0) return step;
      return { ...step, position: newPos };
    });
    onUpdate({ steps: newSteps });
  }, [resolution, track.steps, onUpdate]);

  const handleUndoHumanize = useCallback(() => {
    if (!preHumanizeSteps) return;
    onUpdate({ steps: preHumanizeSteps });
    setPreHumanizeSteps(null);
  }, [preHumanizeSteps, onUpdate]);

  const effect = track.effect;
  const fxBlock = (
    <Row label="FX">
      <select
        value={effect?.id || ''}
        onChange={e => {
          const id = e.target.value;
          onUpdate({ effect: id ? { id, wet: effect?.wet ?? TRACK_DEFAULTS.effectWet } : undefined });
        }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 text-zinc-200 text-xs px-1 py-0.5 rounded border border-zinc-600 outline-none cursor-pointer flex-1 min-w-0 h-5"
      >
        <option value="">None</option>
        {EFFECT_PRESETS.map(fx => (
          <option key={fx.id} value={fx.id}>{fx.label}</option>
        ))}
      </select>
      {effect && (
        <Knob
          value={Math.round((effect.wet ?? TRACK_DEFAULTS.effectWet) * 100)}
          min={0}
          max={100}
          onChange={v => onUpdate({ effect: { ...effect, wet: v / 100 } })}
          label="Wet"
          formatValue={v => `${v}%`}
        />
      )}
    </Row>
  );

  const humanizeBlock = resolution && (
    <Row label="Groove">
      <button
        onClick={e => { e.stopPropagation(); handleHumanize(); }}
        className="h-5 px-2 rounded-l bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs cursor-pointer border border-zinc-600 border-r-0 flex items-center"
        title="Humanize — randomly nudges ~50% of notes by one step"
      >
        Humanize
      </button>
      <button
        onClick={e => { e.stopPropagation(); handleUndoHumanize(); }}
        disabled={!preHumanizeSteps}
        className={`h-5 px-1.5 rounded-r border border-zinc-600 flex items-center ${
          preHumanizeSteps
            ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 cursor-pointer'
            : 'bg-zinc-700 text-zinc-600 cursor-default'
        }`}
        title="Undo the last humanize"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" />
          <polyline points="7 14 3 10 7 6" />
        </svg>
      </button>
    </Row>
  );

  return (
    <div className="flex flex-col gap-1 px-1.5 py-1.5" onClick={e => e.stopPropagation()}>
      {track.type === 'synth' && (() => { const synth = track.synth; return (
        <>
          <Row label="Wave">
            <WaveSelector
              value={synth.waveform}
              onChange={w => onUpdate({ synth: { ...synth, waveform: w } })}
            />
          </Row>
          <Row label="Oct">
            <button
              onClick={e => { e.stopPropagation(); onUpdate({ synth: { ...synth, octave: Math.max(-1, synth.octave - 1) } }); }}
              disabled={synth.octave <= -1}
              className="w-5 h-5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-default cursor-pointer flex items-center justify-center border border-zinc-600 text-zinc-300"
            >
              <svg width="8" height="5" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-zinc-300 text-xs font-mono w-6 text-center">{synth.octave >= 0 ? `+${synth.octave}` : String(synth.octave)}</span>
            <button
              onClick={e => { e.stopPropagation(); onUpdate({ synth: { ...synth, octave: Math.min(1, synth.octave + 1) } }); }}
              disabled={synth.octave >= 1}
              className="w-5 h-5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-default cursor-pointer flex items-center justify-center border border-zinc-600 text-zinc-300"
            >
              <svg width="8" height="5" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </Row>
          <KnobPair>
            <Knob
              value={synth.decay ?? TRACK_DEFAULTS.synthDecay}
              min={0}
              max={100}
              onChange={v => onUpdate({ synth: { ...synth, decay: v } })}
              label="Decay"
              formatValue={v => `${v}%`}
            />
            <Knob
              value={Math.round(track.volume * 100)}
              min={0}
              max={100}
              onChange={v => onUpdate({ volume: v / 100 })}
              label="Volume"
              formatValue={v => `${v}%`}
            />
          </KnobPair>
          {fxBlock}
          {humanizeBlock}
        </>
      ); })()}

      {track.type === 'sample' && (() => { const sample = track.sample; return (
        <>
          <Row label="Pack">
            <select
              value={sample.packId || ''}
              onChange={e => {
                const packId = e.target.value;
                const pack = installedPacks.find(p => p.id === packId);
                const firstSample = pack?.sampleNames[0] || '';
                onUpdate({ sample: { packId, sampleName: firstSample } });
              }}
              className="bg-zinc-900 text-zinc-200 text-xs px-1 py-0.5 rounded border border-zinc-600 outline-none cursor-pointer flex-1 min-w-0 h-5"
            >
              <option value="">Select pack...</option>
              {installedPacks.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Row>
          {sample.packId && (
            <SamplePicker
              track={track}
              installedPacks={installedPacks}
              onUpdate={onUpdate}
            />
          )}
          <KnobPair>
            <Knob
              value={sample.pitchShift ?? TRACK_DEFAULTS.samplePitchShift}
              min={-2}
              max={2}
              onChange={v => onUpdate({ sample: { ...sample, pitchShift: v } })}
              label="Pitch"
              formatValue={v => (v >= 0 ? `+${v}` : String(v))}
              sensitivity={6}
            />
            <Knob
              value={sample.decay ?? TRACK_DEFAULTS.sampleDecay}
              min={0}
              max={100}
              onChange={v => onUpdate({ sample: { ...sample, decay: v } })}
              label="Decay"
              formatValue={v => `${v}%`}
            />
            <Knob
              value={Math.round(track.volume * 100)}
              min={0}
              max={100}
              onChange={v => onUpdate({ volume: v / 100 })}
              label="Volume"
              formatValue={v => `${v}%`}
            />
          </KnobPair>
          {fxBlock}
          {humanizeBlock}
        </>
      ); })()}

      {track.type === 'drum-machine' && (
        <>
          <KnobPair>
            <Knob
              value={Math.round(track.volume * 100)}
              min={0}
              max={100}
              onChange={v => onUpdate({ volume: v / 100 })}
              label="Volume"
              formatValue={v => `${v}%`}
            />
          </KnobPair>
          {fxBlock}
        </>
      )}
    </div>
  );
}

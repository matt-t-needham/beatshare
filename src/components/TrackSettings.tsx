import { useCallback, useMemo, useState } from 'react';
import type { Track, SampleTrack, Waveform, InstalledPack, GridResolution } from '../types';
import { ticksPerStep, TRACK_DEFAULTS } from '../types';
import { groupSamplesByCategory, friendlyNames } from '../sample-categories';
import { Tooltip } from './Tooltip';
import { Dropdown } from './Dropdown';
import { SamplePopover } from './SamplePopover';

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

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  formatValue?: (v: number) => string;
}

function Slider({ value, min, max, step = 1, onChange, label, formatValue }: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div className="flex items-center gap-2">
      <label className="text-zinc-400 text-[10px] uppercase tracking-wider w-12 shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className="slider-thin flex-1 min-w-0"
      />
      <span className="text-zinc-400 text-[10px] font-mono w-9 text-right shrink-0">{display}</span>
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
  const triggerLabel = track.sample.sampleName
    ? (nameMap.get(track.sample.sampleName) ?? track.sample.sampleName)
    : 'Pick sample...';

  return (
    <Row label="Sample">
      <SamplePopover
        value={track.sample.sampleName || undefined}
        groupedSamples={grouped}
        onSelect={name => onUpdate({ sample: { ...track.sample, sampleName: name } })}
        trigger={triggerLabel}
        triggerClassName="bg-zinc-900 text-zinc-200 text-xs px-1 py-0.5 rounded border border-zinc-600 cursor-pointer flex-1 min-w-0 h-5 truncate text-left"
      />
    </Row>
  );
}

function Row({ label, children, rightAlign }: { label: string; children: React.ReactNode; rightAlign?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-zinc-400 text-[10px] uppercase tracking-wider w-12 shrink-0">{label}</label>
      <div className={`flex items-center gap-1 flex-1 min-w-0 ${rightAlign ? 'justify-end' : ''}`}>{children}</div>
    </div>
  );
}

function SliderStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
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
    <>
      <Row label="FX">
        <Dropdown
          value={effect?.id || ''}
          onChange={id => onUpdate({ effect: id ? { id, wet: effect?.wet ?? TRACK_DEFAULTS.effectWet } : undefined })}
          options={[{ value: '', label: 'None' }, ...EFFECT_PRESETS.map(fx => ({ value: fx.id, label: fx.label }))]}
          triggerClassName="bg-zinc-900 text-zinc-200 text-xs px-1 py-0.5 rounded border border-zinc-600 cursor-pointer flex-1 min-w-0 h-5"
        />
      </Row>
      {effect && (
        <Slider
          value={Math.round((effect.wet ?? TRACK_DEFAULTS.effectWet) * 100)}
          min={0}
          max={100}
          onChange={v => onUpdate({ effect: { ...effect, wet: v / 100 } })}
          label="Wet"
          formatValue={v => `${v}%`}
        />
      )}
    </>
  );

  const humanizeBlock = resolution && track.type !== 'drum-machine' && (
    <div className="flex items-center justify-end">
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
    </div>
  );

  const synth = track.type === 'synth' ? track.synth : null;
  const sample = track.type === 'sample' ? track.sample : null;

  const topSelectors: React.ReactNode[] = [];
  const bottomSliders: React.ReactNode[] = [];

  if (sample) {
    topSelectors.push(
      sample.packId && (
        <SamplePicker
          key="sample-picker"
          track={track as SampleTrack}
          installedPacks={installedPacks}
          onUpdate={onUpdate}
        />
      ),
    );
    bottomSliders.push(
      <SliderStack key="sample-knobs">
        <Slider
          value={sample.pitchShift ?? TRACK_DEFAULTS.samplePitchShift}
          min={-2}
          max={2}
          onChange={v => onUpdate({ sample: { ...sample, pitchShift: v } })}
          label="Pitch"
          formatValue={v => (v >= 0 ? `+${v}` : String(v))}
        />
        <Slider
          value={sample.decay ?? TRACK_DEFAULTS.sampleDecay}
          min={0}
          max={100}
          onChange={v => onUpdate({ sample: { ...sample, decay: v } })}
          label="Decay"
          formatValue={v => `${v}%`}
        />
        <Slider
          value={Math.round(track.volume * 100)}
          min={0}
          max={100}
          onChange={v => onUpdate({ volume: v / 100 })}
          label="Volume"
          formatValue={v => `${v}%`}
        />
      </SliderStack>,
    );
  }

  if (synth) {
    topSelectors.push(
      <Row key="wave" label="Wave" rightAlign>
        <WaveSelector
          value={synth.waveform}
          onChange={w => onUpdate({ synth: { ...synth, waveform: w } })}
        />
      </Row>,
      <Row key="oct" label="Octave" rightAlign>
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
      </Row>,
    );
    bottomSliders.push(
      <SliderStack key="synth-knobs">
        <Slider
          value={synth.decay ?? TRACK_DEFAULTS.synthDecay}
          min={0}
          max={100}
          onChange={v => onUpdate({ synth: { ...synth, decay: v } })}
          label="Decay"
          formatValue={v => `${v}%`}
        />
        <Slider
          value={Math.round(track.volume * 100)}
          min={0}
          max={100}
          onChange={v => onUpdate({ volume: v / 100 })}
          label="Volume"
          formatValue={v => `${v}%`}
        />
      </SliderStack>,
    );
  }

  if (track.type === 'drum-machine') {
    const dm = track.drumMachine;
    topSelectors.push(
      <div key="add-lane" className="flex">
        <button
          onClick={e => {
            e.stopPropagation();
            onUpdate({ drumMachine: { ...dm, lanes: [...dm.lanes, { sampleName: '', volume: 1, muted: false }] } });
          }}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white text-xs px-2 h-5 rounded font-medium cursor-pointer flex-1 text-center"
        >
          + Add lane
        </button>
      </div>,
    );
    bottomSliders.push(
      <SliderStack key="drum-knobs">
        <Slider
          value={Math.round(track.volume * 100)}
          min={0}
          max={100}
          onChange={v => onUpdate({ volume: v / 100 })}
          label="Volume"
          formatValue={v => `${v}%`}
        />
      </SliderStack>,
    );
  }

  topSelectors.push(<div key="fx">{fxBlock}</div>);
  if (humanizeBlock) topSelectors.push(<div key="groove">{humanizeBlock}</div>);

  return (
    <div className="h-full flex flex-col justify-between gap-2 px-1.5 py-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex flex-col gap-1">{topSelectors}</div>
      <div className="flex flex-col gap-1">{bottomSliders}</div>
    </div>
  );
}

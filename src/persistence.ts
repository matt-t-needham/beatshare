import LZString from 'lz-string';
import type { Song, Track, Step, Waveform, MusicalKey, ScaleType } from './types';
import { TRACK_DEFAULTS, newSynthTrack, newSampleTrack, newDrumTrack } from './types';

// Minified key mapping for URL compactness
interface SerializedSong {
  n: string;       // name
  b: number;       // bpm
  sw: number;      // swing
  ts: [number, number]; // timeSignature
  m: number;       // measures
  k?: string;      // key
  sc?: string;     // scale
  t: SerializedTrack[];
}

interface SerializedDrumLane {
  sn: string;      // sampleName
  v: number;       // volume
  mu: boolean;     // muted
}

interface SerializedTrack {
  n: string;       // name
  ty: 'synth' | 'sample' | 'drum-machine';
  w?: string;      // waveform (synth)
  o?: number;      // octave (synth)
  dc?: number;     // decay (synth)
  pk?: string;     // packId (sample)
  sn?: string;     // sampleName (sample)
  ps?: number;     // pitchShift (sample)
  sd?: number;     // sample decay
  dm?: { pk: string; ln: SerializedDrumLane[] }; // drumMachine
  v: number;       // volume
  mu: boolean;     // muted
  fx?: string;     // effect id
  fw?: number;     // effect wet
  s: SerializedStep[];
}

interface SerializedStep {
  p: number;       // position
  nt: number;      // note
  vl: number;      // velocity
  d: number;       // duration
  sm?: string;     // sampleName (per-step sample override)
}

export function serialize(song: Song): SerializedSong {
  return {
    n: song.name,
    b: song.bpm,
    sw: song.swing,
    ts: song.timeSignature,
    m: song.measures,
    ...(song.key && song.key !== 'C' ? { k: song.key } : {}),
    ...(song.scale && song.scale !== 'major' ? { sc: song.scale } : {}),
    t: song.tracks.map(t => {
      const base = {
        n: t.name,
        ty: t.type,
        v: t.volume,
        mu: t.muted,
        ...(t.effect ? { fx: t.effect.id, ...(t.effect.wet != null && t.effect.wet !== TRACK_DEFAULTS.effectWet ? { fw: t.effect.wet } : {}) } : {}),
        s: t.steps.map(s => ({ p: s.position, nt: s.note, vl: s.velocity, d: s.duration, ...(s.sampleName ? { sm: s.sampleName } : {}) })),
      };
      if (t.type === 'synth') {
        return {
          ...base,
          w: t.synth.waveform,
          o: t.synth.octave,
          ...(t.synth.decay != null && t.synth.decay !== TRACK_DEFAULTS.synthDecay ? { dc: t.synth.decay } : {}),
        };
      }
      if (t.type === 'sample') {
        return {
          ...base,
          pk: t.sample.packId,
          sn: t.sample.sampleName,
          ...(t.sample.pitchShift ? { ps: t.sample.pitchShift } : {}),
          ...(t.sample.decay != null && t.sample.decay !== TRACK_DEFAULTS.sampleDecay ? { sd: t.sample.decay } : {}),
        };
      }
      return {
        ...base,
        dm: {
          pk: t.drumMachine.packId,
          ln: t.drumMachine.lanes.map(l => ({ sn: l.sampleName, v: l.volume, mu: l.muted })),
        },
      };
    }),
  };
}

function deserializeSteps(s: SerializedStep[] | undefined): Step[] {
  return (s ?? []).map(step => ({
    position: step.p,
    note: step.nt,
    velocity: step.vl,
    duration: step.d,
    ...(step.sm ? { sampleName: step.sm } : {}),
  }));
}

function deserializeEffect(t: SerializedTrack) {
  return t.fx
    ? { effect: { id: t.fx, ...(t.fw != null ? { wet: t.fw } : {}) } }
    : {};
}

function deserializeTrack(t: SerializedTrack): Track {
  const common = {
    name: t.n || 'Track',
    volume: t.v ?? TRACK_DEFAULTS.volume,
    muted: t.mu || false,
    steps: deserializeSteps(t.s),
    ...deserializeEffect(t),
  };

  if (t.ty === 'sample') {
    return newSampleTrack(t.pk || '', t.sn || '', {
      ...common,
      sample: {
        packId: t.pk || '',
        sampleName: t.sn || '',
        ...(t.ps ? { pitchShift: t.ps } : {}),
        ...(t.sd != null ? { decay: t.sd } : {}),
      },
    });
  }

  if (t.ty === 'drum-machine' && t.dm) {
    return newDrumTrack(
      t.dm.pk,
      t.dm.ln.map(l => ({ sampleName: l.sn, volume: l.v, muted: l.mu })),
      common,
    );
  }

  return newSynthTrack({
    ...common,
    synth: {
      waveform: (t.w as Waveform) || TRACK_DEFAULTS.waveform,
      octave: t.o ?? TRACK_DEFAULTS.synthOctave,
      ...(t.dc != null ? { decay: t.dc } : {}),
    },
  });
}

export function deserialize(data: SerializedSong): Song {
  return {
    name: data.n || 'Untitled',
    bpm: data.b || 120,
    swing: data.sw || 0,
    timeSignature: data.ts || [4, 4],
    measures: data.m || 1,
    key: (data.k as MusicalKey) || 'C',
    scale: (data.sc as ScaleType) || 'major',
    tracks: (data.t || []).map(deserializeTrack),
  };
}

export function buildShareUrl(song: Song): string {
  const json = JSON.stringify(serialize(song));
  const compressed = LZString.compressToEncodedURIComponent(json);
  const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
  return url;
}

export function loadFromHash(): Song | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  try {
    const json = LZString.decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    const data = JSON.parse(json) as SerializedSong;
    return deserialize(data);
  } catch {
    console.warn('Failed to load song from URL hash');
    return null;
  }
}

export function cleanHash() {
  window.history.replaceState(null, '', window.location.pathname);
}

export function getShareUrlLength(song: Song): number {
  return buildShareUrl(song).length;
}

export function exportToFile(song: Song) {
  const json = JSON.stringify(serialize(song), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${song.name || 'beatshare'}.beatshare`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(text: string): Song {
  const data = JSON.parse(text) as SerializedSong;
  return deserialize(data);
}

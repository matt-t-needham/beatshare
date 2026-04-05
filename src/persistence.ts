import LZString from 'lz-string';
import type { Song, Track, Step, MusicalKey, ScaleType } from './types';

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

interface SerializedTrack {
  n: string;       // name
  ty: 'synth' | 'sample';
  w?: string;      // waveform (synth)
  o?: number;      // octave (synth)
  dc?: number;     // decay (synth)
  pk?: string;     // packId (sample)
  sn?: string;     // sampleName (sample)
  ps?: number;     // pitchShift (sample)
  v: number;       // volume
  mu: boolean;     // muted
  s: SerializedStep[];
}

interface SerializedStep {
  p: number;       // position
  nt: number;      // note
  vl: number;      // velocity
  d: number;       // duration
  sm?: string;     // sampleName (per-step sample override)
}

function serialize(song: Song): SerializedSong {
  return {
    n: song.name,
    b: song.bpm,
    sw: song.swing,
    ts: song.timeSignature,
    m: song.measures,
    ...(song.key && song.key !== 'C' ? { k: song.key } : {}),
    ...(song.scale && song.scale !== 'major' ? { sc: song.scale } : {}),
    t: song.tracks.map(t => ({
      n: t.name,
      ty: t.type,
      ...(t.synth ? { w: t.synth.waveform, o: t.synth.octave, ...(t.synth.decay != null && t.synth.decay !== 50 ? { dc: t.synth.decay } : {}) } : {}),
      ...(t.sample ? { pk: t.sample.packId, sn: t.sample.sampleName, ...(t.sample.pitchShift ? { ps: t.sample.pitchShift } : {}) } : {}),
      v: t.volume,
      mu: t.muted,
      s: t.steps.map(s => ({ p: s.position, nt: s.note, vl: s.velocity, d: s.duration, ...(s.sampleName ? { sm: s.sampleName } : {}) })),
    })),
  };
}

function deserialize(data: SerializedSong): Song {
  return {
    name: data.n || 'Untitled',
    bpm: data.b || 120,
    swing: data.sw || 0,
    timeSignature: data.ts || [4, 4],
    measures: data.m || 1,
    key: (data.k as MusicalKey) || 'C',
    scale: (data.sc as ScaleType) || 'major',
    tracks: (data.t || []).map((t): Track => ({
      id: crypto.randomUUID(),
      name: t.n || 'Track',
      type: t.ty || 'synth',
      ...(t.ty === 'synth' ? { synth: { waveform: (t.w as any) || 'sawtooth', octave: t.o ?? 0, ...(t.dc != null ? { decay: t.dc } : {}) } } : {}),
      ...(t.ty === 'sample' ? { sample: { packId: t.pk || '', sampleName: t.sn || '', ...(t.ps ? { pitchShift: t.ps } : {}) } } : {}),
      volume: t.v ?? 0.7,
      muted: t.mu || false,
      steps: (t.s || []).map((s): Step => ({
        position: s.p,
        note: s.nt,
        velocity: s.vl,
        duration: s.d,
        ...(s.sm ? { sampleName: s.sm } : {}),
      })),
    })),
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

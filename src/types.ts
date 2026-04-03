export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export type GridResolution = 4 | 8 | 16 | 32 | 64;

export interface Step {
  position: number;   // 0-based tick (1 tick = 1/64th note)
  note: number;       // MIDI note number
  velocity: number;   // 0-127
  duration: number;   // in ticks
}

export interface SynthConfig {
  waveform: Waveform;
  octave: number;     // -7 to +7 offset (0 = middle C area)
}

export interface SampleConfig {
  packId: string;
  sampleName: string;
}

export interface Track {
  id: string;
  name: string;
  type: 'synth' | 'sample';
  synth?: SynthConfig;
  sample?: SampleConfig;
  volume: number;     // 0-1
  muted: boolean;
  steps: Step[];
}

export interface Song {
  name: string;
  bpm: number;
  swing: number;
  timeSignature: [number, number];
  measures: number;
  tracks: Track[];
}

// Ticks per 64th note = 1
// Ticks per beat (quarter note) = 16
// Ticks per measure (4/4) = 64
export const TICKS_PER_64TH = 1;
export const TICKS_PER_BEAT = 16;

export function ticksPerMeasure(timeSignature: [number, number]): number {
  const [beats, beatValue] = timeSignature;
  // beatValue: 4 = quarter note = 16 ticks, 8 = eighth = 8 ticks, etc.
  const ticksPerBeatUnit = (64 / beatValue);
  return beats * ticksPerBeatUnit;
}

export function stepsPerMeasure(resolution: GridResolution): number {
  // resolution=16 means 16th notes, so 16 steps per measure in 4/4
  // In ticks: measure has 64 ticks (4/4), step size = 64/resolution
  return resolution;
}

export function ticksPerStep(resolution: GridResolution): number {
  // In 4/4: 64 ticks per measure, divided by resolution steps
  return 64 / resolution;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60; // default C4
  const noteName = match[1];
  const octave = parseInt(match[2]);
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  if (noteIndex === -1) return 60;
  return (octave + 1) * 12 + noteIndex;
}

export function createDefaultSong(): Song {
  return {
    name: 'Untitled',
    bpm: 120,
    swing: 0,
    timeSignature: [4, 4] as [number, number],
    measures: 1,
    tracks: [
      {
        id: crypto.randomUUID(),
        name: 'Synth A',
        type: 'synth',
        synth: { waveform: 'sawtooth', octave: 0 },
        volume: 0.7,
        muted: false,
        steps: [],
      },
    ],
  };
}

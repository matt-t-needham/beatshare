import { describe, it, expect } from 'vitest';
import {
  ticksPerMeasure,
  ticksPerStep,
  stepsPerMeasure,
  midiNoteToName,
  noteNameToMidi,
  createDefaultSong,
} from './types';

describe('ticksPerMeasure', () => {
  it('returns 64 for 4/4 time', () => {
    expect(ticksPerMeasure([4, 4])).toBe(64);
  });

  it('returns 48 for 3/4 time', () => {
    expect(ticksPerMeasure([3, 4])).toBe(48);
  });

  it('returns 32 for 4/8 time', () => {
    expect(ticksPerMeasure([4, 8])).toBe(32);
  });
});

describe('ticksPerStep', () => {
  it('returns 4 for 16th note resolution', () => {
    expect(ticksPerStep(16)).toBe(4);
  });

  it('returns 8 for 8th note resolution', () => {
    expect(ticksPerStep(8)).toBe(8);
  });

  it('returns 1 for 64th note resolution', () => {
    expect(ticksPerStep(64)).toBe(1);
  });

  it('returns 2 for 32nd note resolution', () => {
    expect(ticksPerStep(32)).toBe(2);
  });
});

describe('stepsPerMeasure', () => {
  it('returns the resolution value (steps per measure in 4/4)', () => {
    expect(stepsPerMeasure(16)).toBe(16);
    expect(stepsPerMeasure(8)).toBe(8);
    expect(stepsPerMeasure(32)).toBe(32);
    expect(stepsPerMeasure(64)).toBe(64);
  });
});

describe('midiNoteToName', () => {
  it('converts C4 (MIDI 60)', () => {
    expect(midiNoteToName(60)).toBe('C4');
  });

  it('converts A4 (MIDI 69)', () => {
    expect(midiNoteToName(69)).toBe('A4');
  });

  it('converts C#3 (MIDI 49)', () => {
    expect(midiNoteToName(49)).toBe('C#3');
  });

  it('converts B5 (MIDI 83)', () => {
    expect(midiNoteToName(83)).toBe('B5');
  });

  it('converts C-1 (MIDI 0)', () => {
    expect(midiNoteToName(0)).toBe('C-1');
  });
});

describe('noteNameToMidi', () => {
  it('converts C4 to 60', () => {
    expect(noteNameToMidi('C4')).toBe(60);
  });

  it('converts A4 to 69', () => {
    expect(noteNameToMidi('A4')).toBe(69);
  });

  it('converts C#3 to 49', () => {
    expect(noteNameToMidi('C#3')).toBe(49);
  });

  it('returns 60 for invalid input', () => {
    expect(noteNameToMidi('invalid')).toBe(60);
  });

  it('round-trips with midiNoteToName', () => {
    for (const midi of [36, 48, 60, 72, 84]) {
      expect(noteNameToMidi(midiNoteToName(midi))).toBe(midi);
    }
  });
});

describe('createDefaultSong', () => {
  it('creates a song with sensible defaults', () => {
    const song = createDefaultSong();
    expect(song.name).toBe('Untitled');
    expect(song.bpm).toBe(120);
    expect(song.timeSignature).toEqual([4, 4]);
    expect(song.measures).toBe(1);
    expect(song.tracks).toHaveLength(1);
    expect(song.tracks[0].type).toBe('synth');
    expect(song.tracks[0].steps).toEqual([]);
  });

  it('generates unique track IDs', () => {
    const song1 = createDefaultSong();
    const song2 = createDefaultSong();
    expect(song1.tracks[0].id).not.toBe(song2.tracks[0].id);
  });
});

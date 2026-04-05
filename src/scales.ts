import type { MusicalKey, ScaleType, Track } from './types';

export const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // natural minor

export const KEY_ROOTS: Record<MusicalKey, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export const ALL_KEYS: MusicalKey[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const ALL_SCALES: ScaleType[] = ['major', 'minor'];

function getIntervals(scale: ScaleType): number[] {
  return scale === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
}

/**
 * Generate `count` scale notes starting from a given octave.
 * Returns MIDI note numbers, lowest first.
 */
export function getScaleNotes(key: MusicalKey, scale: ScaleType, octave: number, count: number = 10): number[] {
  const root = KEY_ROOTS[key];
  const intervals = getIntervals(scale);
  const notes: number[] = [];
  // Start from the given octave (MIDI octave: C4 = MIDI 60, octave 4)
  const baseMidi = (octave + 1) * 12 + root;
  let idx = 0;
  while (notes.length < count) {
    const octaveOffset = Math.floor(idx / 7);
    const degreeIdx = idx % 7;
    const midi = baseMidi + octaveOffset * 12 + intervals[degreeIdx];
    if (midi <= 127) notes.push(midi);
    else break;
    idx++;
  }
  return notes;
}

/**
 * Generate scale notes centered around a root note: `below` notes below + root + `above` notes above.
 * Used for sample-track piano rolls (e.g. 4 below + root + 4 above = 9 notes).
 */
export function getCenteredScaleNotes(key: MusicalKey, scale: ScaleType, centerOctave: number, below: number, above: number): number[] {
  const root = KEY_ROOTS[key];
  const intervals = getIntervals(scale);
  const centerMidi = (centerOctave + 1) * 12 + root;

  const notes: number[] = [centerMidi];

  // Go down
  for (let i = 1; i <= below; i++) {
    const octaveOffset = Math.floor(i / 7);
    const degreeIdx = 7 - (i % 7 || 7); // walk backwards through scale degrees
    const midi = centerMidi - octaveOffset * 12 - (12 - intervals[degreeIdx]);
    if (midi >= 0) notes.unshift(midi);
  }

  // Go up
  for (let i = 1; i <= above; i++) {
    const octaveOffset = Math.floor(i / 7);
    const degreeIdx = i % 7;
    const midi = centerMidi + octaveOffset * 12 + intervals[degreeIdx];
    if (midi <= 127) notes.push(midi);
  }

  return notes;
}

/**
 * Find the scale degree (0-6) and octave offset of a MIDI note within a key/scale.
 * Returns null if the note is not in the scale.
 */
function findScaleDegree(midiNote: number, key: MusicalKey, scale: ScaleType): { degree: number; octave: number } | null {
  const root = KEY_ROOTS[key];
  const intervals = getIntervals(scale);
  const pitchClass = ((midiNote % 12) - root + 12) % 12;
  const degree = intervals.indexOf(pitchClass);
  if (degree === -1) return null;
  const noteOctave = Math.floor((midiNote - root) / 12);
  return { degree, octave: noteOctave };
}

/**
 * Transpose a single MIDI note from one key/scale to another,
 * preserving its scale degree and octave.
 * Returns the note unchanged if it's not in the source scale.
 */
export function transposeNote(
  midiNote: number,
  oldKey: MusicalKey,
  oldScale: ScaleType,
  newKey: MusicalKey,
  newScale: ScaleType,
): number {
  const info = findScaleDegree(midiNote, oldKey, oldScale);
  if (!info) return midiNote;
  const newRoot = KEY_ROOTS[newKey];
  const newIntervals = getIntervals(newScale);
  const newNote = info.octave * 12 + newRoot + newIntervals[info.degree];
  return Math.max(0, Math.min(127, newNote));
}

/**
 * Transpose all track steps from one key/scale to another.
 * For synth tracks: transpose notes and remove any that fall outside the visible piano roll.
 * For sample tracks: transpose piano-roll-placed notes (note !== 60) and remove out-of-range ones.
 */
export function transposeAllTracks(
  tracks: Track[],
  oldKey: MusicalKey,
  oldScale: ScaleType,
  newKey: MusicalKey,
  newScale: ScaleType,
): Track[] {
  return tracks.map(track => {
    if (track.type === 'synth') {
      const octave = (track.synth?.octave ?? 0) + 4;
      const visibleNotes = getScaleNotes(newKey, newScale, octave, 10);
      const minNote = visibleNotes[0];
      const maxNote = visibleNotes[visibleNotes.length - 1];
      return {
        ...track,
        steps: track.steps
          .map(step => ({
            ...step,
            note: transposeNote(step.note, oldKey, oldScale, newKey, newScale),
          }))
          .filter(step => step.note >= minNote && step.note <= maxNote),
      };
    }
    if (track.type === 'sample') {
      const visibleNotes = getCenteredScaleNotes(newKey, newScale, 4, 4, 4);
      const minNote = visibleNotes[0];
      const maxNote = visibleNotes[visibleNotes.length - 1];
      return {
        ...track,
        steps: track.steps
          .map(step => {
            if (step.note === 60) return step; // grid-placed, no pitch info
            return {
              ...step,
              note: transposeNote(step.note, oldKey, oldScale, newKey, newScale),
            };
          })
          .filter(step => step.note === 60 || (step.note >= minNote && step.note <= maxNote)),
      };
    }
    return track;
  });
}

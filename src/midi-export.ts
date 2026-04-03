import MidiWriter from 'midi-writer-js';
import type { Song } from './types';

export function exportMidi(song: Song): void {
  const tracks: MidiWriter.Track[] = [];

  for (const track of song.tracks) {
    if (track.steps.length === 0) continue;

    const midiTrack = new MidiWriter.Track();
    midiTrack.addTrackName(track.name);
    midiTrack.setTempo(song.bpm);

    // Sort steps by position
    const sorted = [...track.steps].sort((a, b) => a.position - b.position);

    let lastEnd = 0;
    for (const step of sorted) {
      // Add rest if there's a gap
      if (step.position > lastEnd) {
        const restTicks = step.position - lastEnd;
        // Convert 64th-note ticks to MIDI ticks (T prefix = raw ticks, 128 ticks per beat in midi-writer-js)
        const restDuration = `T${restTicks * 2}`;
        midiTrack.addEvent(new MidiWriter.NoteEvent({
          pitch: ['C4'] as any,
          duration: restDuration,
          velocity: 0,
        }));
      }

      const durationTicks = `T${step.duration * 2}`;
      const noteEvent = new MidiWriter.NoteEvent({
        pitch: [step.note] as any,
        duration: durationTicks,
        velocity: step.velocity,
      });
      midiTrack.addEvent(noteEvent);
      lastEnd = step.position + step.duration;
    }

    tracks.push(midiTrack);
  }

  if (tracks.length === 0) return;

  const writer = new MidiWriter.Writer(tracks);
  const data = writer.buildFile();
  const blob = new Blob([new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${song.name || 'beatshare'}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}

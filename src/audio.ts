import * as Tone from 'tone';
import type { Song, Track } from './types';

let started = false;

async function ensureStarted() {
  if (!started) {
    await Tone.start();
    started = true;
  }
}

// Map of trackId -> synth instance
const synths = new Map<string, Tone.Synth>();

function getSynth(track: Track): Tone.Synth {
  let synth = synths.get(track.id);
  if (!synth) {
    synth = new Tone.Synth({
      oscillator: { type: track.synth?.waveform ?? 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 },
    }).toDestination();
    synths.set(track.id, synth);
  }
  if (track.synth) {
    synth.oscillator.type = track.synth.waveform;
  }
  synth.volume.value = track.muted ? -Infinity : Tone.gainToDb(track.volume);
  return synth;
}

export function cleanupSynths(activeTrackIds: Set<string>) {
  for (const [id, synth] of synths) {
    if (!activeTrackIds.has(id)) {
      synth.dispose();
      synths.delete(id);
    }
  }
}

let scheduledEvents: number[] = [];
let tickCallback: ((tick: number) => void) | null = null;
let metronomeEnabled = false;
let metronomeSynth: Tone.Synth | null = null;

export function setTickCallback(cb: ((tick: number) => void) | null) {
  tickCallback = cb;
}

export function setMetronome(enabled: boolean) {
  metronomeEnabled = enabled;
}

export function getMetronome(): boolean {
  return metronomeEnabled;
}

/**
 * Convert our 64th-note tick position to seconds at a given BPM.
 * 1 quarter note = 16 ticks. At BPM beats per minute:
 * seconds per tick = 60 / (BPM * 16)
 */
function ticksToSeconds(ticks: number, bpm: number): number {
  return ticks * (60 / (bpm * 16));
}

/**
 * Cancel all scheduled events and re-schedule them from the song.
 * Does NOT stop or restart the transport — it keeps playing at its current position.
 */
function scheduleAllEvents(song: Song) {
  // Clear all previously scheduled events (does not stop transport)
  Tone.getTransport().cancel();
  scheduledEvents = [];

  const bpm = song.bpm;
  const totalTicks = 64 * song.measures;
  const totalSeconds = ticksToSeconds(totalTicks, bpm);

  // Schedule each track's steps
  for (const track of song.tracks) {
    if (track.type !== 'synth' || track.muted) continue;
    const synth = getSynth(track);

    for (const step of track.steps) {
      if (step.position >= totalTicks) continue;

      const startTime = ticksToSeconds(step.position, bpm);
      const duration = ticksToSeconds(step.duration, bpm);
      const freq = Tone.Frequency(step.note, 'midi').toFrequency();

      const eventId = Tone.getTransport().schedule((time) => {
        synth.triggerAttackRelease(freq, duration, time, step.velocity / 127);
      }, startTime);
      scheduledEvents.push(eventId);
    }
  }

  // Schedule metronome clicks
  if (metronomeEnabled) {
    if (!metronomeSynth) {
      metronomeSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      }).toDestination();
      metronomeSynth.volume.value = -6;
    }
    const ticksPerBeat = 16;
    for (let tick = 0; tick < totalTicks; tick += ticksPerBeat) {
      const time = ticksToSeconds(tick, bpm);
      const isDownbeat = tick % 64 === 0;
      const freq = isDownbeat ? 1000 : 800;
      const eventId = Tone.getTransport().schedule((t) => {
        metronomeSynth!.triggerAttackRelease(freq, 0.03, t, isDownbeat ? 0.8 : 0.5);
      }, time);
      scheduledEvents.push(eventId);
    }
  }

  // Schedule tick callback for visual playback cursor
  if (tickCallback) {
    for (let tick = 0; tick < totalTicks; tick++) {
      const time = ticksToSeconds(tick, bpm);
      const capturedTick = tick;
      const eventId = Tone.getTransport().schedule((t) => {
        Tone.getDraw().schedule(() => {
          tickCallback?.(capturedTick);
        }, t);
      }, time);
      scheduledEvents.push(eventId);
    }
  }

  // Update loop bounds (in case measures or BPM changed)
  Tone.getTransport().loopEnd = totalSeconds;
}

/**
 * Start playing a song from the beginning.
 */
export async function playSong(song: Song) {
  await ensureStarted();
  stopSong();

  Tone.getTransport().bpm.value = song.bpm;
  scheduleAllEvents(song);

  Tone.getTransport().loop = true;
  Tone.getTransport().loopStart = 0;
  Tone.getTransport().position = 0;
  Tone.getTransport().start();
}

/**
 * Update scheduled notes while transport keeps playing.
 * Cancels and re-schedules all events without stopping transport.
 */
export function updateScheduledNotes(song: Song) {
  Tone.getTransport().bpm.value = song.bpm;
  scheduleAllEvents(song);
}

export function stopSong() {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  scheduledEvents = [];
  tickCallback?.(0);
}

export function isPlaying(): boolean {
  return Tone.getTransport().state === 'started';
}

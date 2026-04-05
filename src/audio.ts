import * as Tone from 'tone';
import type { Song, Track } from './types';
import { getSample } from './sound-pack-store';

let started = false;

async function ensureStarted() {
  if (!started) {
    await Tone.start();
    started = true;
  }
}

// Map of trackId -> synth instance
const synths = new Map<string, Tone.Synth>();

/**
 * Map decay value (0-100) to ADSR envelope parameters.
 * 0 = percussive click, 50 = default, 100 = long sustain
 */
function decayToEnvelope(decay: number): { attack: number; decay: number; sustain: number; release: number } {
  const t = decay / 100; // 0..1
  if (t <= 0.5) {
    // 0→0.5 maps between percussive and default
    const s = t / 0.5; // 0..1 within first half
    return {
      attack: 0.001 + s * 0.009,   // 0.001 → 0.01
      decay:  0.05  + s * 0.05,    // 0.05  → 0.1
      sustain: s * 0.3,            // 0     → 0.3
      release: 0.02 + s * 0.08,    // 0.02  → 0.1
    };
  } else {
    // 0.5→1 maps between default and long
    const s = (t - 0.5) / 0.5; // 0..1 within second half
    return {
      attack: 0.01,                      // stays 0.01
      decay:  0.1  + s * 0.2,            // 0.1  → 0.3
      sustain: 0.3 + s * 0.5,            // 0.3  → 0.8
      release: 0.1 + s * 0.4,            // 0.1  → 0.5
    };
  }
}

function getSynth(track: Track): Tone.Synth {
  const envelope = decayToEnvelope(track.synth?.decay ?? 50);
  let synth = synths.get(track.id);
  if (!synth) {
    synth = new Tone.Synth({
      oscillator: { type: track.synth?.waveform ?? 'sawtooth' },
      envelope,
    }).toDestination();
    synths.set(track.id, synth);
  }
  if (track.synth) {
    synth.oscillator.type = track.synth.waveform;
  }
  synth.set({ envelope });
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

// Sample playback — uses BufferSource (polyphonic, fire-and-forget) instead of Player
const sampleBufferCache = new Map<string, Tone.ToneAudioBuffer>();
// Gain nodes per track for volume control
const trackGains = new Map<string, Tone.Gain>();

function sampleKey(packId: string, sampleName: string): string {
  return `${packId}:${sampleName}`;
}

async function loadSampleBuffer(packId: string, sampleName: string): Promise<Tone.ToneAudioBuffer | null> {
  const key = sampleKey(packId, sampleName);
  if (sampleBufferCache.has(key)) return sampleBufferCache.get(key)!;

  try {
    const arrayBuffer = await getSample(packId, sampleName);
    const audioContext = Tone.getContext().rawContext;
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);
    sampleBufferCache.set(key, toneBuffer);
    return toneBuffer;
  } catch {
    return null;
  }
}

function getTrackGain(trackId: string, volume: number, muted: boolean): Tone.Gain {
  let gain = trackGains.get(trackId);
  if (!gain) {
    gain = new Tone.Gain().toDestination();
    trackGains.set(trackId, gain);
  }
  gain.gain.value = muted ? 0 : volume;
  return gain;
}

export async function preloadSamples(song: Song): Promise<void> {
  const promises: Promise<any>[] = [];
  for (const track of song.tracks) {
    if (track.type !== 'sample' || !track.sample?.packId) continue;
    // Collect all unique sample names from steps + the track-level brush
    const names = new Set<string>();
    if (track.sample.sampleName) names.add(track.sample.sampleName);
    for (const step of track.steps) {
      if (step.sampleName) names.add(step.sampleName);
    }
    for (const name of names) {
      promises.push(loadSampleBuffer(track.sample.packId, name));
    }
  }
  await Promise.all(promises);
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
    if (track.muted) continue;

    if (track.type === 'synth') {
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
    } else if (track.type === 'sample' && track.sample?.packId) {
      const packId = track.sample.packId;
      const gain = getTrackGain(track.id, track.volume, track.muted);
      for (const step of track.steps) {
        if (step.position >= totalTicks) continue;
        const stepSample = step.sampleName ?? track.sample?.sampleName;
        if (!stepSample) continue;
        const buffer = sampleBufferCache.get(sampleKey(packId, stepSample));
        if (!buffer) continue;
        const startTime = ticksToSeconds(step.position, bpm);
        const pitchShift = track.sample?.pitchShift ?? 0;
        const playbackRate = Math.pow(2, pitchShift);
        const eventId = Tone.getTransport().schedule((time) => {
          const source = new Tone.ToneBufferSource(buffer).connect(gain);
          source.playbackRate.value = playbackRate;
          source.start(time);
        }, startTime);
        scheduledEvents.push(eventId);
      }
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
  await preloadSamples(song);
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
export async function updateScheduledNotes(song: Song) {
  await preloadSamples(song);
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

import * as Tone from 'tone';
import type { Song, Track, EffectConfig } from './types';
import { getSample } from './sound-pack-store';
import { KEY_ROOTS } from './scales';

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
    const s = t / 0.5;
    return {
      attack: 0.001 + s * 0.009,
      decay:  0.05  + s * 0.05,
      sustain: s * 0.3,
      release: 0.02 + s * 0.08,
    };
  } else {
    const s = (t - 0.5) / 0.5;
    return {
      attack: 0.01,
      decay:  0.1  + s * 0.2,
      sustain: 0.3 + s * 0.5,
      release: 0.1 + s * 0.4,
    };
  }
}

// --- Per-track audio chain: gain -> effect -> destination ---
const trackGains = new Map<string, Tone.Gain>();
const trackEffects = new Map<string, { id: string; node: Tone.ToneAudioNode }>();

function createEffectNode(config: EffectConfig): Tone.ToneAudioNode | null {
  const wet = config.wet ?? 0.5;
  switch (config.id) {
    case 'reverb': {
      const fx = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
      fx.wet.value = wet;
      return fx;
    }
    case 'delay': {
      const fx = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3 });
      fx.wet.value = wet;
      return fx;
    }
    case 'ping-pong': {
      const fx = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.3 });
      fx.wet.value = wet;
      return fx;
    }
    case 'distortion': {
      const fx = new Tone.Distortion({ distortion: 0.4, oversample: '2x' });
      fx.wet.value = wet;
      return fx;
    }
    case 'bitcrush': {
      const fx = new Tone.BitCrusher({ bits: 4 });
      fx.wet.value = wet;
      return fx;
    }
    case 'chorus': {
      const fx = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 });
      fx.wet.value = wet;
      fx.start();
      return fx;
    }
    case 'phaser': {
      const fx = new Tone.Phaser({ frequency: 0.5, octaves: 3, stages: 10, Q: 10, baseFrequency: 350 });
      fx.wet.value = wet;
      return fx;
    }
    case 'tremolo': {
      const fx = new Tone.Tremolo({ frequency: 4, depth: 0.6 });
      fx.wet.value = wet;
      fx.start();
      return fx;
    }
    case 'vibrato': {
      const fx = new Tone.Vibrato({ frequency: 5, depth: 0.3 });
      fx.wet.value = wet;
      return fx;
    }
    case 'autofilter': {
      const fx = new Tone.AutoFilter({ frequency: 1, baseFrequency: 200, octaves: 4 });
      fx.wet.value = wet;
      fx.start();
      return fx;
    }
    case 'autowah': {
      const fx = new Tone.AutoWah({ baseFrequency: 100, octaves: 6, sensitivity: 0, Q: 2 });
      fx.wet.value = wet;
      return fx;
    }
    default:
      return null;
  }
}

/**
 * Get or create a track's gain node, wiring through the current effect if any.
 * Rebuilds the chain when the effect changes.
 */
function getTrackOutput(trackId: string, volume: number, muted: boolean, effect?: EffectConfig): Tone.Gain {
  let gain = trackGains.get(trackId);
  if (!gain) {
    gain = new Tone.Gain();
    trackGains.set(trackId, gain);
  }
  gain.gain.value = muted ? 0 : volume;

  // Check if effect changed
  const currentEffect = trackEffects.get(trackId);
  const wantedEffectId = effect?.id ?? '';

  if (currentEffect?.id !== wantedEffectId) {
    // Disconnect old chain
    gain.disconnect();
    if (currentEffect) {
      currentEffect.node.disconnect();
      currentEffect.node.dispose();
      trackEffects.delete(trackId);
    }

    // Build new chain
    if (effect && wantedEffectId) {
      const node = createEffectNode(effect);
      if (node) {
        gain.connect(node);
        node.toDestination();
        trackEffects.set(trackId, { id: wantedEffectId, node });
      } else {
        gain.toDestination();
      }
    } else {
      gain.toDestination();
    }
  } else if (currentEffect && effect) {
    // Same effect, update wet
    const node = currentEffect.node as any;
    if (node.wet) {
      node.wet.value = effect.wet ?? 0.5;
    }
  }

  return gain;
}

function getSynth(track: Track): Tone.Synth {
  const envelope = decayToEnvelope(track.synth?.decay ?? 50);
  const output = getTrackOutput(track.id, 1, false, track.effect);
  let synth = synths.get(track.id);
  if (!synth) {
    synth = new Tone.Synth({
      oscillator: { type: track.synth?.waveform ?? 'sawtooth' },
      envelope,
    });
    synth.connect(output);
    synths.set(track.id, synth);
  } else {
    // Reconnect in case the chain changed
    synth.disconnect();
    synth.connect(output);
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

// Sample playback
const sampleBufferCache = new Map<string, Tone.ToneAudioBuffer>();

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
  } catch (error) {
    console.error(`Failed to load sample ${packId}/${sampleName}:`, error);
    return null;
  }
}

export async function preloadSamples(song: Song): Promise<void> {
  const promises: Promise<any>[] = [];
  for (const track of song.tracks) {
    if (track.type === 'sample' && track.sample?.packId) {
      // Collect all unique sample names from steps + the track-level brush
      const names = new Set<string>();
      if (track.sample.sampleName) names.add(track.sample.sampleName);
      for (const step of track.steps) {
        if (step.sampleName) names.add(step.sampleName);
      }
      for (const name of names) {
        promises.push(loadSampleBuffer(track.sample.packId, name));
      }
    } else if (track.type === 'drum-machine' && track.drumMachine?.packId) {
      const names = new Set<string>();
      for (const lane of track.drumMachine.lanes) {
        names.add(lane.sampleName);
      }
      for (const step of track.steps) {
        if (step.sampleName) names.add(step.sampleName);
      }
      for (const name of names) {
        promises.push(loadSampleBuffer(track.drumMachine.packId, name));
      }
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
      const gain = getTrackOutput(track.id, track.volume, track.muted, track.effect);
      for (const step of track.steps) {
        if (step.position >= totalTicks) continue;
        const stepSample = step.sampleName ?? track.sample?.sampleName;
        if (!stepSample) continue;
        const buffer = sampleBufferCache.get(sampleKey(packId, stepSample));
        if (!buffer) continue;
        const startTime = ticksToSeconds(step.position, bpm);
        const trackPitchShift = track.sample?.pitchShift ?? 0;
        // Per-step pitch: if step note differs from default (60), it was placed via piano roll
        // Shift in semitones relative to song root at octave 4
        const rootMidi = 60 + KEY_ROOTS[song.key];
        const noteSemitones = step.note !== 60 ? (step.note - rootMidi) : 0;
        const playbackRate = Math.pow(2, trackPitchShift + noteSemitones / 12);
        const sampleDecay = track.sample?.decay ?? 100;
        const eventId = Tone.getTransport().schedule((time) => {
          const source = new Tone.ToneBufferSource(buffer).connect(gain);
          source.playbackRate.value = playbackRate;
          source.start(time);
          if (sampleDecay < 100) {
            // Map 0-99 to a duration: 0 = 0.02s, 99 ≈ full buffer length
            const maxDur = buffer.duration / playbackRate;
            const dur = 0.02 + (sampleDecay / 100) * (maxDur - 0.02);
            source.stop(time + dur);
          }
        }, startTime);
        scheduledEvents.push(eventId);
      }
    } else if (track.type === 'drum-machine' && track.drumMachine?.packId) {
      const packId = track.drumMachine.packId;
      const gain = getTrackOutput(track.id, track.volume, track.muted, track.effect);
      // Build a per-lane volume lookup and mute set
      const laneVolumes = new Map<string, number>();
      const laneMuted = new Set<string>();
      for (const lane of track.drumMachine.lanes) {
        laneVolumes.set(lane.sampleName, lane.volume);
        if (lane.muted) laneMuted.add(lane.sampleName);
      }
      for (const step of track.steps) {
        if (step.position >= totalTicks) continue;
        const stepSample = step.sampleName;
        if (!stepSample) continue;
        if (laneMuted.has(stepSample)) continue;
        const buffer = sampleBufferCache.get(sampleKey(packId, stepSample));
        if (!buffer) continue;
        const startTime = ticksToSeconds(step.position, bpm);
        const laneVol = laneVolumes.get(stepSample) ?? 1;
        const eventId = Tone.getTransport().schedule((time) => {
          const laneGain = new Tone.Gain(laneVol);
          const source = new Tone.ToneBufferSource(buffer).connect(laneGain);
          laneGain.connect(gain);
          source.playbackRate.value = 1;
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

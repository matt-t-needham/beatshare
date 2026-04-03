import { describe, it, expect } from 'vitest';

// Test the ticksToSeconds conversion logic directly.
// We can't easily test Tone.js scheduling without a browser, but we can
// verify the math that converts our tick system to seconds.

/**
 * Same formula as in audio.ts:
 * 1 quarter note = 16 ticks. At BPM beats per minute:
 * seconds per tick = 60 / (BPM * 16)
 */
function ticksToSeconds(ticks: number, bpm: number): number {
  return ticks * (60 / (bpm * 16));
}

describe('ticksToSeconds', () => {
  it('at 120 BPM, 16 ticks (1 beat) = 0.5 seconds', () => {
    expect(ticksToSeconds(16, 120)).toBeCloseTo(0.5);
  });

  it('at 120 BPM, 64 ticks (1 measure) = 2 seconds', () => {
    expect(ticksToSeconds(64, 120)).toBeCloseTo(2.0);
  });

  it('at 60 BPM, 16 ticks (1 beat) = 1 second', () => {
    expect(ticksToSeconds(16, 60)).toBeCloseTo(1.0);
  });

  it('at 60 BPM, 64 ticks (1 measure) = 4 seconds', () => {
    expect(ticksToSeconds(64, 60)).toBeCloseTo(4.0);
  });

  it('at 120 BPM, 4 ticks (1 sixteenth note) = 0.125 seconds', () => {
    expect(ticksToSeconds(4, 120)).toBeCloseTo(0.125);
  });

  it('at 120 BPM, 1 tick (1 sixty-fourth note) = 0.03125 seconds', () => {
    expect(ticksToSeconds(1, 120)).toBeCloseTo(60 / (120 * 16));
  });

  it('zero ticks = zero seconds', () => {
    expect(ticksToSeconds(0, 120)).toBe(0);
  });

  it('scales linearly with BPM', () => {
    const slow = ticksToSeconds(16, 60);
    const fast = ticksToSeconds(16, 120);
    expect(slow).toBeCloseTo(fast * 2);
  });
});

describe('tick system consistency', () => {
  it('64 ticks per measure matches 4 beats * 16 ticks/beat', () => {
    const ticksPerBeat = 16;
    const beatsPerMeasure = 4; // 4/4 time
    expect(ticksPerBeat * beatsPerMeasure).toBe(64);
  });

  it('16th note grid: 16 steps per measure, each step = 4 ticks', () => {
    const stepsPerMeasure = 16;
    const ticksPerStep = 64 / stepsPerMeasure;
    expect(ticksPerStep).toBe(4);
  });

  it('step positions at 16th resolution align with beat boundaries', () => {
    const ticksPerStep = 4;
    const ticksPerBeat = 16;
    // Steps 0, 4, 8, 12 should be on beats
    for (let step = 0; step < 16; step += 4) {
      const tick = step * ticksPerStep;
      expect(tick % ticksPerBeat).toBe(0);
    }
  });

  it('metronome clicks at every 16 ticks align with beats', () => {
    const ticksPerBeat = 16;
    const totalTicks = 64; // 1 measure
    const clicks: number[] = [];
    for (let tick = 0; tick < totalTicks; tick += ticksPerBeat) {
      clicks.push(tick);
    }
    expect(clicks).toEqual([0, 16, 32, 48]);
  });

  it('downbeats at every 64 ticks align with measure boundaries', () => {
    const totalTicks = 64 * 4; // 4 measures
    const downbeats: number[] = [];
    for (let tick = 0; tick < totalTicks; tick += 16) {
      if (tick % 64 === 0) downbeats.push(tick);
    }
    expect(downbeats).toEqual([0, 64, 128, 192]);
  });

  it('cursor at 64th-note visual resolution: 64 updates per measure', () => {
    const visualStepSize = 1;
    const totalTicks = 64;
    const cursorPositions: number[] = [];
    for (let tick = 0; tick < totalTicks; tick += visualStepSize) {
      cursorPositions.push(tick);
    }
    expect(cursorPositions).toHaveLength(64);
    expect(cursorPositions[0]).toBe(0);
    expect(cursorPositions[63]).toBe(63);
  });
});

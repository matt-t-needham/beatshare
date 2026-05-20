import { useMemo, useCallback, useRef } from 'react';
import type { DrumTrack, Track, GridResolution, InstalledPack, DrumLane } from '../types';
import { ticksPerStep } from '../types';
import { classifySample, friendlyName, groupSamplesByCategory } from '../sample-categories';
import { STEP_CELL_W, STICKY_COL_W, CONTROLS_W, ROW_LABEL_W, CELL_GAP } from './StepGrid';
import { useDragPaint } from '../hooks/useDragPaint';
import { IconButton } from './IconButton';

interface DrumGridProps {
  track: DrumTrack;
  resolution: GridResolution;
  measures: number;
  onSetDrumStep: (trackId: string, position: number, sampleName: string, duration: number) => void;
  onClearDrumStep: (trackId: string, position: number, sampleName: string) => void;
  onUpdateTrack: (updates: Partial<Track>) => void;
  installedPacks: InstalledPack[];
  zoom?: number;
  controlsPanel?: React.ReactNode;
}

export function DrumGrid({
  track,
  resolution,
  measures,
  onSetDrumStep,
  onClearDrumStep,
  onUpdateTrack,
  installedPacks,
  zoom = 1,
  controlsPanel,
}: DrumGridProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * measures;
  const cellSize = Math.round(STEP_CELL_W * zoom);
  const stepsPerBeat = resolution / 4;

  const lanes = track.drumMachine.lanes;
  const packId = track.drumMachine.packId;

  const activeSteps = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const step of track.steps) {
      if (!step.sampleName) continue;
      const col = Math.floor(step.position / stepSize);
      if (!map.has(step.sampleName)) map.set(step.sampleName, new Set());
      map.get(step.sampleName)!.add(col);
    }
    return map;
  }, [track.steps, stepSize]);

  const pack = installedPacks.find(p => p.id === packId);
  const grouped = useMemo(() => pack ? groupSamplesByCategory(pack.sampleNames) : [], [pack]);

  const updateLane = useCallback((index: number, updates: Partial<DrumLane>) => {
    const newLanes = lanes.map((l, i) => i === index ? { ...l, ...updates } : l);
    onUpdateTrack({ drumMachine: { ...track.drumMachine, lanes: newLanes } });
  }, [lanes, track.drumMachine, onUpdateTrack]);

  const removeLane = useCallback((index: number) => {
    const removed = lanes[index];
    const newLanes = lanes.filter((_, i) => i !== index);
    const newSteps = track.steps.filter(s => s.sampleName !== removed.sampleName);
    onUpdateTrack({ drumMachine: { ...track.drumMachine, lanes: newLanes }, steps: newSteps });
  }, [lanes, track.drumMachine, track.steps, onUpdateTrack]);

  const addLane = useCallback((sampleName: string) => {
    const newLane: DrumLane = { sampleName, volume: 1, muted: false };
    onUpdateTrack({ drumMachine: { ...track.drumMachine, lanes: [...lanes, newLane] } });
  }, [lanes, track.drumMachine, onUpdateTrack]);

  // Lane-locked drag: only paint/erase within the lane where the drag started.
  const dragSampleRef = useRef<string | null>(null);
  const drag = useDragPaint<{ col: number; sampleName: string }>(
    ({ col, sampleName }) => onSetDrumStep(track.id, col * stepSize, sampleName, stepSize),
    ({ col, sampleName }) => onClearDrumStep(track.id, col * stepSize, sampleName),
  );
  const handleStart = useCallback((col: number, sampleName: string, isActive: boolean) => {
    dragSampleRef.current = sampleName;
    drag.start({ col, sampleName }, isActive);
  }, [drag]);
  const handleEnter = useCallback((col: number, sampleName: string) => {
    if (dragSampleRef.current !== sampleName) return;
    drag.enter({ col, sampleName });
  }, [drag]);

  const laneHeight = cellSize;

  return (
    <div className="flex">
      {/* Sticky left panel — solid, holds controls (left zone) + lane labels (right zone) */}
      <div
        className="sticky left-0 z-10 bg-zinc-800 shrink-0 flex"
        style={{ width: STICKY_COL_W }}
      >
        <div style={{ width: CONTROLS_W }} className="border-r border-zinc-700/60">
          {controlsPanel}
        </div>
        <div style={{ width: ROW_LABEL_W }} className="flex flex-col gap-px">
          {lanes.map((lane, laneIdx) => {
            const cat = classifySample(lane.sampleName);
            return (
              <div
                key={`${lane.sampleName}-${laneIdx}-label`}
                className="flex items-center gap-1.5 pl-2 pr-2"
                style={{ height: laneHeight }}
              >
                <IconButton
                  tooltip={lane.muted ? 'Unmute lane' : 'Mute lane'}
                  variant="mute"
                  active={lane.muted}
                  onClick={() => updateLane(laneIdx, { muted: !lane.muted })}
                >
                  M
                </IconButton>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-mono text-zinc-200 truncate shrink-0 w-8" title={friendlyName(lane.sampleName)}>
                  {cat.abbr}
                </span>
                <select
                  value={lane.sampleName}
                  onChange={e => {
                    const oldName = lane.sampleName;
                    const newName = e.target.value;
                    const newLanes = lanes.map((l, i) => i === laneIdx ? { ...l, sampleName: newName } : l);
                    const newSteps = track.steps.map(s => s.sampleName === oldName ? { ...s, sampleName: newName } : s);
                    onUpdateTrack({ drumMachine: { ...track.drumMachine, lanes: newLanes }, steps: newSteps });
                  }}
                  className="bg-zinc-900 text-zinc-200 text-xs px-1 py-0.5 rounded border border-zinc-600 outline-none cursor-pointer flex-1 min-w-0 h-5"
                  title="Swap sample"
                >
                  {grouped.map(({ category, samples }) => (
                    <optgroup key={category.id} label={category.name}>
                      {samples.map(name => (
                        <option key={name} value={name}>
                          {name.split('/').pop()?.replace(/\.[^.]+$/, '')}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <IconButton
                  tooltip="Remove lane"
                  variant="danger"
                  onClick={() => removeLane(laneIdx)}
                  className="w-4"
                >
                  ×
                </IconButton>
              </div>
            );
          })}
          {pack && (
            <div className="flex items-center px-2 mt-1" style={{ height: laneHeight }}>
              <select
                defaultValue=""
                onChange={e => {
                  if (e.target.value) {
                    addLane(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-zinc-900 text-zinc-300 text-xs px-2 py-0.5 rounded border border-zinc-600 outline-none cursor-pointer w-full h-5"
              >
                <option value="" disabled>+ Add lane...</option>
                {grouped.map(({ category, samples }) => {
                  const available = samples.filter(name => !lanes.some(l => l.sampleName === name));
                  return available.length > 0 ? (
                    <optgroup key={category.id} label={category.name}>
                      {available.map(name => (
                        <option key={name} value={name}>
                          {name.split('/').pop()?.replace(/\.[^.]+$/, '')}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cells column — visual gap from sticky edge */}
      <div className="flex flex-col gap-px shrink-0" style={{ marginLeft: CELL_GAP }}>
        {lanes.map((lane, laneIdx) => {
          const cat = classifySample(lane.sampleName);
          const laneActive = activeSteps.get(lane.sampleName) ?? new Set<number>();
          return (
            <div key={`${lane.sampleName}-${laneIdx}-cells`} className="flex gap-px">
              {Array.from({ length: totalSteps }, (_, col) => {
                const isActive = laneActive.has(col);
                const isOnBeat = col % stepsPerBeat === 0;
                const isBarStart = col > 0 && col % resolution === 0;

                return (
                  <div key={col} className="relative shrink-0" style={{ width: cellSize }}>
                    {isBarStart && (
                      <div className="absolute left-0 top-0 bottom-0 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.18)', marginLeft: -1 }} />
                    )}
                    <button
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStart(col, lane.sampleName, isActive);
                      }}
                      onMouseEnter={() => handleEnter(col, lane.sampleName)}
                      style={{
                        width: cellSize,
                        height: laneHeight,
                        backgroundColor: isActive ? cat.color : undefined,
                      }}
                      className={`
                        rounded-sm text-[8px] font-mono cursor-pointer transition-colors select-none text-white
                        ${!isActive ? (isOnBeat ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-800 hover:bg-zinc-700') : ''}
                        ${lane.muted && isActive ? 'opacity-40' : ''}
                      `}
                      onMouseOver={isActive ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = cat.hoverColor; } : undefined}
                      onMouseOut={isActive ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = cat.color; } : undefined}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* spacer row to align with the "+ Add lane" select on the left */}
        {pack && <div style={{ height: laneHeight + 4 }} />}
      </div>
    </div>
  );
}

import { useMemo, useRef, useEffect, useCallback } from 'react';
import type { Track, GridResolution, InstalledPack, DrumLane } from '../types';
import { ticksPerStep } from '../types';
import { classifySample, friendlyName, groupSamplesByCategory } from '../sample-categories';
import { Tooltip } from './Tooltip';

interface DrumGridProps {
  track: Track;
  resolution: GridResolution;
  measures: number;
  currentCol: number | null;
  onSetDrumStep: (trackId: string, position: number, sampleName: string, duration: number) => void;
  onClearDrumStep: (trackId: string, position: number, sampleName: string) => void;
  onUpdateTrack: (updates: Partial<Track>) => void;
  installedPacks: InstalledPack[];
  zoom?: number;
  scrollRef?: (el: HTMLDivElement | null) => void;
}

export function DrumGrid({
  track,
  resolution,
  measures,
  currentCol,
  onSetDrumStep,
  onClearDrumStep,
  onUpdateTrack,
  installedPacks,
  zoom = 1,
  scrollRef,
}: DrumGridProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * measures;
  const cellSize = Math.round(28 * zoom);
  const stepsPerBeat = resolution / 4;

  const lanes = track.drumMachine?.lanes ?? [];
  const packId = track.drumMachine?.packId ?? '';

  // Build a lookup: (sampleName, col) -> true
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

  // Drag state for paint/erase
  const dragRef = useRef<{
    mode: 'paint' | 'erase';
    sampleName: string;
  } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => { dragRef.current = null; };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Get available samples for the pack (for lane swap dropdown)
  const pack = installedPacks.find(p => p.id === packId);
  const grouped = useMemo(() => pack ? groupSamplesByCategory(pack.sampleNames) : [], [pack]);

  const updateLane = useCallback((index: number, updates: Partial<DrumLane>) => {
    const newLanes = lanes.map((l, i) => i === index ? { ...l, ...updates } : l);
    onUpdateTrack({ drumMachine: { ...track.drumMachine!, lanes: newLanes } });
  }, [lanes, track.drumMachine, onUpdateTrack]);

  const removeLane = useCallback((index: number) => {
    const removed = lanes[index];
    const newLanes = lanes.filter((_, i) => i !== index);
    // Also remove steps for this lane
    const newSteps = track.steps.filter(s => s.sampleName !== removed.sampleName);
    onUpdateTrack({ drumMachine: { ...track.drumMachine!, lanes: newLanes }, steps: newSteps });
  }, [lanes, track.drumMachine, track.steps, onUpdateTrack]);

  const addLane = useCallback((sampleName: string) => {
    const newLane: DrumLane = { sampleName, volume: 1, muted: false };
    onUpdateTrack({ drumMachine: { ...track.drumMachine!, lanes: [...lanes, newLane] } });
  }, [lanes, track.drumMachine, onUpdateTrack]);

  return (
    <div className="flex flex-col gap-px" style={{ marginLeft: 14, marginRight: -8 }}>
      {lanes.map((lane, laneIdx) => {
        const cat = classifySample(lane.sampleName);
        const laneActive = activeSteps.get(lane.sampleName) ?? new Set<number>();

        return (
          <div key={`${lane.sampleName}-${laneIdx}`} className="flex items-center">
            {/* Lane controls */}
            <div className="flex items-center gap-1 shrink-0" style={{ width: 120 }}>
              <Tooltip text={lane.muted ? 'Unmute lane' : 'Mute lane'}>
                <button
                  onClick={() => updateLane(laneIdx, { muted: !lane.muted })}
                  className={`w-5 h-5 rounded text-[9px] font-bold cursor-pointer flex items-center justify-center ${
                    lane.muted ? 'bg-yellow-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                  }`}
                >
                  M
                </button>
              </Tooltip>
              <Tooltip text={friendlyName(lane.sampleName)}>
                <div
                  className="flex items-center gap-1 cursor-default overflow-hidden"
                  style={{ maxWidth: 70 }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-[10px] font-mono text-zinc-300 truncate">
                    {cat.abbr}
                  </span>
                </div>
              </Tooltip>
              <Tooltip text="Remove lane">
                <button
                  onClick={() => removeLane(laneIdx)}
                  className="w-4 h-4 rounded text-zinc-500 hover:text-red-400 cursor-pointer flex items-center justify-center text-[10px]"
                >
                  x
                </button>
              </Tooltip>
              {/* Lane sample swap */}
              <select
                value={lane.sampleName}
                onChange={e => {
                  const oldName = lane.sampleName;
                  const newName = e.target.value;
                  // Update lane and remap steps
                  const newLanes = lanes.map((l, i) => i === laneIdx ? { ...l, sampleName: newName } : l);
                  const newSteps = track.steps.map(s => s.sampleName === oldName ? { ...s, sampleName: newName } : s);
                  onUpdateTrack({ drumMachine: { ...track.drumMachine!, lanes: newLanes }, steps: newSteps });
                }}
                className="bg-zinc-800 text-zinc-400 text-[9px] px-0.5 py-0 rounded border border-zinc-700 outline-none cursor-pointer w-8 h-4"
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
            </div>

            {/* Step cells */}
            <div
              ref={laneIdx === 0 ? scrollRef : undefined}
              className="flex gap-px overflow-hidden"
            >
              {Array.from({ length: totalSteps }, (_, col) => {
                const isActive = laneActive.has(col);
                const isOnBeat = col % stepsPerBeat === 0;
                const isCurrent = col === currentCol;
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
                        const position = col * stepSize;
                        if (isActive) {
                          dragRef.current = { mode: 'erase', sampleName: lane.sampleName };
                          onClearDrumStep(track.id, position, lane.sampleName);
                        } else {
                          dragRef.current = { mode: 'paint', sampleName: lane.sampleName };
                          onSetDrumStep(track.id, position, lane.sampleName, stepSize);
                        }
                      }}
                      onMouseEnter={() => {
                        const drag = dragRef.current;
                        if (!drag || drag.sampleName !== lane.sampleName) return;
                        const position = col * stepSize;
                        if (drag.mode === 'paint') {
                          onSetDrumStep(track.id, position, lane.sampleName, stepSize);
                        } else {
                          onClearDrumStep(track.id, position, lane.sampleName);
                        }
                      }}
                      style={{
                        width: cellSize,
                        height: Math.round(20 * zoom),
                        backgroundColor: isActive ? cat.color : undefined,
                      }}
                      className={`
                        rounded-sm text-[8px] font-mono cursor-pointer transition-colors select-none text-white
                        ${isCurrent ? 'ring-1 ring-purple-400' : ''}
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
          </div>
        );
      })}

      {/* Add lane button */}
      {pack && (
        <div className="flex items-center gap-1 mt-1" style={{ marginLeft: 0 }}>
          <select
            defaultValue=""
            onChange={e => {
              if (e.target.value) {
                addLane(e.target.value);
                e.target.value = '';
              }
            }}
            className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded border border-zinc-700 outline-none cursor-pointer"
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
  );
}

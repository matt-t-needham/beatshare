import { useMemo, useRef, useEffect, useCallback } from 'react';
import type { Track, MusicalKey, ScaleType, GridResolution } from '../types';
import { ticksPerStep, midiNoteToName } from '../types';
import { getScaleNotes, getCenteredScaleNotes } from '../scales';
import { STEP_CELL_W, STICKY_COL_W, CONTROLS_W, ROW_LABEL_W, CELL_GAP } from './StepGrid';

interface PianoRollProps {
  track: Track;
  songKey: MusicalKey;
  songScale: ScaleType;
  resolution: GridResolution;
  measures: number;
  currentCol: number | null;
  onSetStep: (trackId: string, position: number, note: number, duration: number) => void;
  onClearStep: (trackId: string, position: number) => void;
  zoom?: number;
  compact?: boolean;
  controlsPanel?: React.ReactNode;
}

export function PianoRoll({
  track,
  songKey,
  songScale,
  resolution,
  measures,
  // currentCol unused — global playhead overlay handles indication
  onSetStep,
  onClearStep,
  zoom = 1,
  compact = false,
  controlsPanel,
}: PianoRollProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * measures;
  const stepsPerBeat = resolution / 4;

  const octave = compact ? 4 : (track.synth?.octave ?? 0) + 4;
  const scaleNotes = useMemo(
    () => compact
      ? getCenteredScaleNotes(songKey, songScale, octave, 4, 4)
      : getScaleNotes(songKey, songScale, octave, 10),
    [songKey, songScale, octave, compact],
  );

  const rows = useMemo(() => [...scaleNotes].reverse(), [scaleNotes]);

  const stepMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const step of track.steps) {
      map.set(step.position, step.note);
    }
    return map;
  }, [track.steps]);

  const dragRef = useRef<{ mode: 'paint' | 'erase'; note: number } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => { dragRef.current = null; };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseDown = useCallback((col: number, note: number, isActive: boolean) => {
    const position = col * stepSize;
    if (isActive) {
      dragRef.current = { mode: 'erase', note };
      onClearStep(track.id, position);
    } else {
      dragRef.current = { mode: 'paint', note };
      onSetStep(track.id, position, note, stepSize);
    }
  }, [track.id, stepSize, onSetStep, onClearStep]);

  const handleMouseEnter = useCallback((col: number, note: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const position = col * stepSize;
    if (drag.mode === 'paint') {
      onSetStep(track.id, position, note, stepSize);
    } else {
      onClearStep(track.id, position);
    }
  }, [track.id, stepSize, onSetStep, onClearStep]);

  const cellW = Math.round(STEP_CELL_W * zoom);
  const cellH = Math.round(STEP_CELL_W * zoom);

  return (
    <div className="flex select-none">
      {/* Sticky left panel — controls (left zone) + note labels (right zone) */}
      <div
        className="sticky left-0 z-10 bg-zinc-800 shrink-0 flex"
        style={{ width: STICKY_COL_W }}
      >
        <div style={{ width: CONTROLS_W }} className="border-r border-zinc-700/60">
          {controlsPanel}
        </div>
        <div style={{ width: ROW_LABEL_W }} className="flex flex-col gap-px">
          {rows.map(note => (
            <div
              key={note}
              className="flex items-center justify-end pr-3 text-xs font-mono text-zinc-300 whitespace-nowrap"
              style={{ height: cellH }}
            >
              {midiNoteToName(note)}
            </div>
          ))}
        </div>
      </div>

      {/* Cells column — visual gap from sticky edge */}
      <div className="flex flex-col gap-px shrink-0" style={{ marginLeft: CELL_GAP }}>
        {rows.map(note => (
          <div key={note} className="flex gap-px">
            {Array.from({ length: totalSteps }, (_, col) => {
              const position = col * stepSize;
              const stepNote = stepMap.get(position);
              const isActive = stepNote === note;
              const hasOtherNote = stepNote !== undefined && stepNote !== note;
              const isOnBeat = col % stepsPerBeat === 0;

              return (
                <button
                  key={col}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMouseDown(col, note, isActive);
                  }}
                  onMouseEnter={() => handleMouseEnter(col, note)}
                  style={{ width: cellW, height: cellH }}
                  className={`
                    shrink-0 rounded-sm cursor-pointer transition-colors
                    ${isActive
                      ? 'bg-purple-500 hover:bg-purple-400'
                      : hasOtherNote
                        ? (isOnBeat ? 'bg-zinc-600/50 hover:bg-zinc-500' : 'bg-zinc-700/50 hover:bg-zinc-600')
                        : (isOnBeat ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-800 hover:bg-zinc-700')
                    }
                  `}
                  title={`${midiNoteToName(note)} - Step ${col + 1}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

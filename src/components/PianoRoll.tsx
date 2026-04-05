import { useMemo, useRef, useEffect, useCallback } from 'react';
import type { Track, MusicalKey, ScaleType, GridResolution } from '../types';
import { ticksPerStep, midiNoteToName } from '../types';
import { getScaleNotes } from '../scales';

interface PianoRollProps {
  track: Track;
  songKey: MusicalKey;
  songScale: ScaleType;
  resolution: GridResolution;
  measures: number;
  currentCol: number | null;
  onSetStep: (trackId: string, position: number, note: number, duration: number) => void;
  onClearStep: (trackId: string, position: number) => void;
}

export function PianoRoll({
  track,
  songKey,
  songScale,
  resolution,
  measures,
  currentCol,
  onSetStep,
  onClearStep,
}: PianoRollProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * measures;
  const stepsPerBeat = resolution / 4; // quarter note beats

  // 10 scale notes based on track octave
  const octave = (track.synth?.octave ?? 0) + 4; // map -4..+4 to 0..8
  const scaleNotes = useMemo(
    () => getScaleNotes(songKey, songScale, octave, 10),
    [songKey, songScale, octave],
  );

  // Reversed for display: highest note at top
  const rows = useMemo(() => [...scaleNotes].reverse(), [scaleNotes]);

  // Map step positions to their notes for quick lookup
  const stepMap = useMemo(() => {
    const map = new Map<number, number>(); // position -> note
    for (const step of track.steps) {
      map.set(step.position, step.note);
    }
    return map;
  }, [track.steps]);

  // Drag state
  const dragRef = useRef<{
    mode: 'paint' | 'erase';
    note: number;
  } | null>(null);

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

  return (
    <div className="flex gap-0 select-none mt-1">
      {/* Note labels */}
      <div className="flex flex-col gap-px mr-1 shrink-0">
        {rows.map(note => (
          <div
            key={note}
            className="h-3.5 flex items-center justify-end pr-1 text-[9px] font-mono text-zinc-500 w-8"
          >
            {midiNoteToName(note)}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-px overflow-x-auto">
        {rows.map(note => (
          <div key={note} className="flex gap-px">
            {Array.from({ length: totalSteps }, (_, col) => {
              const position = col * stepSize;
              const stepNote = stepMap.get(position);
              const isActive = stepNote === note;
              const hasOtherNote = stepNote !== undefined && stepNote !== note;
              const isOnBeat = col % stepsPerBeat === 0;
              const isCurrent = col === currentCol;

              return (
                <button
                  key={col}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMouseDown(col, note, isActive);
                  }}
                  onMouseEnter={() => handleMouseEnter(col, note)}
                  className={`
                    w-7 h-3.5 rounded-sm cursor-pointer transition-colors
                    ${isCurrent ? 'ring-1 ring-purple-400' : ''}
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

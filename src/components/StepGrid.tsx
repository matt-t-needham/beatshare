import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { Song, Track, GridResolution } from '../types';
import { ticksPerStep, midiNoteToName } from '../types';
import { TrackSettings } from './TrackSettings';

interface StepGridProps {
  song: Song;
  resolution: GridResolution;
  selectedTrackId: string | null;
  currentTick: number | null;
  onSelectTrack: (id: string) => void;
  onToggleStep?: (trackId: string, position: number, note: number, duration: number) => void;
  onSetStep: (trackId: string, position: number, note: number, duration: number) => void;
  onClearStep: (trackId: string, position: number) => void;
  onMuteTrack: (trackId: string, muted: boolean) => void;
  onRemoveTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
}

export function StepGrid({
  song,
  resolution,
  selectedTrackId,
  currentTick,
  onSelectTrack,
  onSetStep,
  onClearStep,
  onMuteTrack,
  onRemoveTrack,
  onUpdateTrack,
}: StepGridProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * song.measures;

  const currentCol = currentTick !== null ? Math.floor(currentTick / stepSize) : null;
  const stepsPerBeat = resolution / song.timeSignature[1];

  // Shared label column width
  const [labelWidth, setLabelWidth] = useState(140);

  // Track which tracks have expanded settings
  const [expandedTrackIds, setExpandedTrackIds] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((trackId: string) => {
    setExpandedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  // Drag state for paint/erase
  const dragRef = useRef<{
    trackId: string;
    mode: 'paint' | 'erase';
    note: number;
    stepSize: number;
  } | null>(null);

  // Global mouseup to end drag
  useEffect(() => {
    const handleMouseUp = () => { dragRef.current = null; };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Auto-size label on double-click
  const handleAutoSize = useCallback(() => {
    if (song.tracks.length === 0) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = '12px system-ui, sans-serif';
    let maxWidth = 0;
    for (const track of song.tracks) {
      const w = ctx.measureText(track.name).width;
      if (w > maxWidth) maxWidth = w;
    }
    // Add space for buttons (M + × + chevron + gaps) ~72px + padding
    setLabelWidth(Math.max(80, Math.ceil(maxWidth) + 80));
  }, [song.tracks]);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto px-2 py-2">
      {song.tracks.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-500 text-lg">
          No tracks yet. Add one below to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {song.tracks.map(track => (
            <div key={track.id}>
              <TrackRow
                track={track}
                totalSteps={totalSteps}
                stepSize={stepSize}
                stepsPerBeat={stepsPerBeat}
                selected={track.id === selectedTrackId}
                currentCol={currentCol}
                labelWidth={labelWidth}
                expanded={expandedTrackIds.has(track.id)}
                onSelect={() => onSelectTrack(track.id)}
                onToggleExpanded={() => toggleExpanded(track.id)}
                onMute={() => onMuteTrack(track.id, !track.muted)}
                onRemove={() => onRemoveTrack(track.id)}
                onStepMouseDown={(col, isActive) => {
                  const position = col * stepSize;
                  const defaultNote = track.synth ? ((track.synth.octave + 4) * 12 + 24) : 60;
                  if (isActive) {
                    dragRef.current = { trackId: track.id, mode: 'erase', note: defaultNote, stepSize };
                    onClearStep(track.id, position);
                  } else {
                    dragRef.current = { trackId: track.id, mode: 'paint', note: defaultNote, stepSize };
                    onSetStep(track.id, position, defaultNote, stepSize);
                  }
                }}
                onStepMouseEnter={(col) => {
                  const drag = dragRef.current;
                  if (!drag || drag.trackId !== track.id) return;
                  const position = col * stepSize;
                  if (drag.mode === 'paint') {
                    onSetStep(track.id, position, drag.note, drag.stepSize);
                  } else {
                    onClearStep(track.id, position);
                  }
                }}
                onLabelResize={setLabelWidth}
                onLabelAutoSize={handleAutoSize}
              />
              {expandedTrackIds.has(track.id) && (
                <div style={{ marginLeft: labelWidth + 8 }}>
                  <TrackSettings
                    track={track}
                    onUpdate={(updates) => onUpdateTrack(track.id, updates)}
                    inline
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  totalSteps: number;
  stepSize: number;
  stepsPerBeat: number;
  selected: boolean;
  currentCol: number | null;
  labelWidth: number;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onMute: () => void;
  onRemove: () => void;
  onStepMouseDown: (col: number, isActive: boolean) => void;
  onStepMouseEnter: (col: number) => void;
  onLabelResize: (width: number) => void;
  onLabelAutoSize: () => void;
}

function TrackRow({
  track,
  totalSteps,
  stepSize,
  stepsPerBeat,
  selected,
  currentCol,
  labelWidth,
  expanded,
  onSelect,
  onToggleExpanded,
  onMute,
  onRemove,
  onStepMouseDown,
  onStepMouseEnter,
  onLabelResize,
  onLabelAutoSize,
}: TrackRowProps) {
  const activeSteps = useMemo(() => {
    const map = new Map<number, { note: number }>();
    for (const step of track.steps) {
      const col = Math.floor(step.position / stepSize);
      map.set(col, { note: step.note });
    }
    return map;
  }, [track.steps, stepSize]);

  // Resize handle drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = labelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (ev.clientX - startX));
      onLabelResize(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [labelWidth, onLabelResize]);

  return (
    <div
      className={`flex items-center gap-1 rounded px-1 py-1 ${
        selected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      }`}
      onClick={onSelect}
    >
      {/* Track label with resize handle */}
      <div
        className="shrink-0 flex items-center gap-1 relative select-none"
        style={{ width: labelWidth }}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggleExpanded(); }}
          className="w-6 h-6 text-sm rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white cursor-pointer flex items-center justify-center"
          title={expanded ? 'Collapse settings' : 'Expand settings'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onMute(); }}
          className={`w-6 h-6 text-xs rounded cursor-pointer ${
            track.muted ? 'bg-yellow-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
          }`}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          M
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="w-6 h-6 text-xs rounded bg-zinc-700 text-zinc-400 hover:bg-red-700 hover:text-white cursor-pointer"
          title="Remove track"
        >
          ×
        </button>
        <span className="text-xs text-zinc-300 truncate ml-1 flex-1">{track.name}</span>

        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500/50 active:bg-purple-500"
          onMouseDown={handleResizeStart}
          onDoubleClick={(e) => { e.stopPropagation(); onLabelAutoSize(); }}
        />
      </div>

      {/* Step cells */}
      <div className="flex gap-px" onMouseLeave={() => {}}>
        {Array.from({ length: totalSteps }, (_, col) => {
          const active = activeSteps.get(col);
          const isOnBeat = col % stepsPerBeat === 0;
          const isCurrent = col === currentCol;

          return (
            <button
              key={col}
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                onStepMouseDown(col, !!active);
              }}
              onMouseEnter={() => onStepMouseEnter(col)}
              className={`
                w-7 h-7 rounded-sm text-[9px] font-mono cursor-pointer transition-colors select-none
                ${isCurrent ? 'ring-1 ring-purple-400' : ''}
                ${active
                  ? 'bg-purple-500 hover:bg-purple-400 text-white'
                  : isOnBeat
                    ? 'bg-zinc-700 hover:bg-zinc-600'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                }
              `}
              title={active ? midiNoteToName(active.note) : `Step ${col + 1}`}
            >
              {active && track.type === 'synth' ? midiNoteToName(active.note).replace(/\d+/, '') : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

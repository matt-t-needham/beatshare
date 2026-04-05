import { useMemo, useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import type { Song, Track, GridResolution, InstalledPack } from '../types';
import { ticksPerStep, midiNoteToName } from '../types';
import { TrackSettings } from './TrackSettings';
import { classifySample, friendlyName } from '../sample-categories';

interface StepGridProps {
  song: Song;
  resolution: GridResolution;
  selectedTrackId: string | null;
  currentTick: number | null;
  soloTrackId: string | null;
  onSelectTrack: (id: string) => void;
  onToggleStep?: (trackId: string, position: number, note: number, duration: number) => void;
  onSetStep: (trackId: string, position: number, note: number, duration: number, sampleName?: string) => void;
  onClearStep: (trackId: string, position: number) => void;
  onMuteTrack: (trackId: string, muted: boolean) => void;
  onSoloTrack: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  installedPacks?: InstalledPack[];
  addTrackSlot?: React.ReactNode;
}

export function StepGrid({
  song,
  resolution,
  selectedTrackId,
  currentTick,
  soloTrackId,
  onSelectTrack,
  onSetStep,
  onClearStep,
  onMuteTrack,
  onSoloTrack,
  onRemoveTrack,
  onUpdateTrack,
  installedPacks = [],
  addTrackSlot,
}: StepGridProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * song.measures;

  const currentCol = currentTick !== null ? Math.floor(currentTick / stepSize) : null;
  const stepsPerBeat = resolution / song.timeSignature[1];

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

  // Auto-expand settings when a new track is added
  const prevTrackIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevTrackIdsRef.current;
    const currentIds = song.tracks.map(t => t.id);
    if (prevIds.length > 0 && currentIds.length > prevIds.length) {
      const newIds = currentIds.filter(id => !prevIds.includes(id));
      if (newIds.length > 0) {
        setExpandedTrackIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.add(id));
          return next;
        });
      }
    }
    prevTrackIdsRef.current = currentIds;
  }, [song.tracks]);

  // Drag state for paint/erase
  const dragRef = useRef<{
    trackId: string;
    mode: 'paint' | 'erase';
    note: number;
    stepSize: number;
    sampleName?: string;
  } | null>(null);

  // Global mouseup to end drag
  useEffect(() => {
    const handleMouseUp = () => { dragRef.current = null; };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto px-2 py-2">
      <div className="flex flex-col gap-1">
        {song.tracks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 text-lg">
            No tracks yet. Add one below to get started.
          </div>
        ) : (
          song.tracks.map(track => (
            <div key={track.id}>
              <TrackRow
                track={track}
                totalSteps={totalSteps}
                stepSize={stepSize}
                stepsPerBeat={stepsPerBeat}
                selected={track.id === selectedTrackId}
                soloed={soloTrackId === track.id}
                currentCol={currentCol}
                expanded={expandedTrackIds.has(track.id)}
                onSelect={() => onSelectTrack(track.id)}
                onToggleExpanded={() => toggleExpanded(track.id)}
                onMute={() => onMuteTrack(track.id, !track.muted)}
                onSolo={() => onSoloTrack(track.id)}
                onRemove={() => onRemoveTrack(track.id)}
                onStepMouseDown={(col, isActive) => {
                  const position = col * stepSize;
                  const defaultNote = track.synth ? ((track.synth.octave + 4) * 12 + 24) : 60;
                  const brushSample = track.type === 'sample' ? track.sample?.sampleName : undefined;
                  if (isActive) {
                    dragRef.current = { trackId: track.id, mode: 'erase', note: defaultNote, stepSize, sampleName: brushSample };
                    onClearStep(track.id, position);
                  } else {
                    dragRef.current = { trackId: track.id, mode: 'paint', note: defaultNote, stepSize, sampleName: brushSample };
                    onSetStep(track.id, position, defaultNote, stepSize, brushSample);
                  }
                }}
                onStepMouseEnter={(col) => {
                  const drag = dragRef.current;
                  if (!drag || drag.trackId !== track.id) return;
                  const position = col * stepSize;
                  if (drag.mode === 'paint') {
                    onSetStep(track.id, position, drag.note, drag.stepSize, drag.sampleName);
                  } else {
                    onClearStep(track.id, position);
                  }
                }}
                onRename={(name) => onUpdateTrack(track.id, { name })}
              />
              {expandedTrackIds.has(track.id) && (
                <div className="ml-1 mb-1">
                  <TrackSettings
                    track={track}
                    onUpdate={(updates) => onUpdateTrack(track.id, updates)}
                    inline
                    installedPacks={installedPacks}
                    songKey={song.key}
                    songScale={song.scale}
                    resolution={resolution}
                    measures={song.measures}
                    currentCol={currentCol}
                    onSetStep={(trackId, position, note, duration) => onSetStep(trackId, position, note, duration)}
                    onClearStep={onClearStep}
                  />
                </div>
              )}
            </div>
          ))
        )}
        {addTrackSlot}
      </div>
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  totalSteps: number;
  stepSize: number;
  stepsPerBeat: number;
  selected: boolean;
  soloed: boolean;
  currentCol: number | null;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onMute: () => void;
  onSolo: () => void;
  onRemove: () => void;
  onStepMouseDown: (col: number, isActive: boolean) => void;
  onStepMouseEnter: (col: number) => void;
  onRename: (name: string) => void;
}

function TrackRow({
  track,
  totalSteps,
  stepSize,
  stepsPerBeat,
  selected,
  soloed,
  currentCol,
  expanded,
  onSelect,
  onToggleExpanded,
  onMute,
  onSolo,
  onRemove,
  onStepMouseDown,
  onStepMouseEnter,
  onRename,
}: TrackRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setEditName(track.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [track.name]);

  const commitRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== track.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [editName, track.name, onRename]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setEditing(false);
  }, [commitRename]);

  const activeSteps = useMemo(() => {
    const map = new Map<number, { note: number; sampleName?: string }>();
    for (const step of track.steps) {
      const col = Math.floor(step.position / stepSize);
      map.set(col, { note: step.note, sampleName: step.sampleName });
    }
    return map;
  }, [track.steps, stepSize]);

  return (
    <div
      className={`rounded px-1 py-1 ${
        selected ? 'bg-zinc-800/70' : 'hover:bg-zinc-800/30'
      }`}
      onClick={onSelect}
    >
      {/* Top row: icons + label */}
      <div className="flex items-center gap-1 mb-1">
        <button
          onClick={e => { e.stopPropagation(); onToggleExpanded(); }}
          className="w-7 h-7 rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-white cursor-pointer flex items-center justify-center border border-zinc-600"
          title={expanded ? 'Collapse settings' : 'Expand settings'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={expanded ? 'M2 7.5L6 3.5L10 7.5' : 'M2 4.5L6 8.5L10 4.5'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onMute(); }}
          className={`w-7 h-7 rounded cursor-pointer flex items-center justify-center border ${
            track.muted ? 'bg-yellow-600 text-white border-yellow-500' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 border-zinc-600'
          }`}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          {track.muted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
          )}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onSolo(); }}
          className={`w-7 h-7 rounded cursor-pointer flex items-center justify-center text-xs font-bold border ${
            soloed ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 border-zinc-600'
          }`}
          title={soloed ? 'Un-solo' : 'Solo (play only this track)'}
        >
          S
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="w-7 h-7 rounded bg-zinc-700 text-zinc-400 hover:bg-red-700 hover:text-white cursor-pointer flex items-center justify-center text-sm border border-zinc-600"
          title="Remove track"
        >
          ×
        </button>
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            className="text-xs text-white bg-zinc-800 border border-purple-500 rounded px-1 py-0.5 min-w-0 outline-none w-28 ml-1"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs text-zinc-300 truncate cursor-default hover:text-white ml-1"
            onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
            title="Double-click to rename"
          >
            {track.name}
          </span>
        )}
      </div>

      {/* Step cells */}
      <div className="flex gap-px" onMouseLeave={() => {}}>
        {Array.from({ length: totalSteps }, (_, col) => {
          const active = activeSteps.get(col);
          const isOnBeat = col % stepsPerBeat === 0;
          const isCurrent = col === currentCol;

          // Determine colors and label — per-step for sample tracks
          const stepSampleName = active?.sampleName;
          const sampleCat = stepSampleName ? classifySample(stepSampleName) : null;

          const activeClass = sampleCat
            ? `${sampleCat.bgColor} ${sampleCat.hoverColor} text-white`
            : 'bg-purple-500 hover:bg-purple-400 text-white';

          // Inactive cell colors: slightly darker than selected row background
          const inactiveClass = selected
            ? (isOnBeat ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-zinc-700 hover:bg-zinc-600')
            : (isOnBeat ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-800 hover:bg-zinc-700');

          const stepLabel = active
            ? (sampleCat ? sampleCat.abbr : track.type === 'synth' ? midiNoteToName(active.note).replace(/\d+/, '') : '')
            : '';

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
                ${active ? activeClass : inactiveClass}
              `}
              title={active ? (stepSampleName ? friendlyName(stepSampleName) : midiNoteToName(active.note)) : `Step ${col + 1}`}
            >
              {stepLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

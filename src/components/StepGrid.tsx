import { useMemo, useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import type { Song, Track, GridResolution, InstalledPack } from '../types';
import { ticksPerStep, midiNoteToName } from '../types';
import { TrackSettings } from './TrackSettings';
import { classifySample, friendlyName, SYNTH_COLOR } from '../sample-categories';

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
  onCloneTrack: (track: Track) => void;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onMoveTrack: (fromIndex: number, toIndex: number) => void;
  installedPacks?: InstalledPack[];
  addTrackSlot?: React.ReactNode;
  zoom?: number;
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
  onCloneTrack,
  onUpdateTrack,
  onMoveTrack,
  installedPacks = [],
  addTrackSlot,
  zoom = 1,
}: StepGridProps) {
  const stepSize = ticksPerStep(resolution);
  const totalSteps = resolution * song.measures;

  const currentCol = currentTick !== null ? Math.floor(currentTick / stepSize) : null;
  const stepsPerBeat = resolution / song.timeSignature[1];
  const stepsPerBar = resolution;

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

  // Synchronized horizontal scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pianoRollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scrollFade, setScrollFade] = useState(false);
  const scrollFadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cellSize = Math.round(28 * zoom);
  const totalGridWidth = totalSteps * (cellSize + 1); // cells + gap-px

  const handleScrollbarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    stepRowRefs.current.forEach(el => {
      if (el) el.scrollLeft = scrollLeft;
    });
    pianoRollRefs.current.forEach(el => {
      if (el) el.scrollLeft = scrollLeft;
    });
    setScrollFade(true);
    if (scrollFadeTimer.current) clearTimeout(scrollFadeTimer.current);
    scrollFadeTimer.current = setTimeout(() => setScrollFade(false), 1200);
  }, []);

  // Also handle wheel on the grid area
  const handleGridWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current && e.deltaX !== 0) {
      scrollContainerRef.current.scrollLeft += e.deltaX;
    }
  }, []);

  const trackCount = song.tracks.length;

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2" onWheel={handleGridWheel}>
      <div className="flex flex-col gap-1">
        {song.tracks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="max-w-md text-center space-y-4">
              <h2 className="text-2xl font-bold text-white">Ready to make something dreadful?</h2>
              <p className="text-zinc-300 text-sm">
                BeatShare is a browser-based music sequencer, light on options and high on speed and sharing! Chuck some things together with inbuilt synth engines and open-source samples.
              </p>
              <div className="text-left space-y-3 text-sm text-zinc-400">
                <div>
                  <span className="text-zinc-200 font-medium">Sound Packs:</span> Crack open the <span className="text-purple-400">Sound Packs</span> panel down the bottom to grab drum kits and sample packs.
                </div>
                <div>
                  <span className="text-zinc-200 font-medium">Spin &amp; Spin+:</span> <span className="text-purple-400">Spin</span> will fetch you six random samples from the Open Samples repo. <span className="text-purple-400">Spin+</span> grabs a six more for when you're feeling greedy.
                </div>
                <div>
                  <span className="text-zinc-200 font-medium">Sharing &amp; Importing:</span> Hit <span className="text-purple-400">Share</span> to copy a link with your whole song baked in (it'll be long!). Save a <code className="text-purple-300">.beatshare</code> file to share it easily, then crack open one from somebody else.
                </div>
              </div>
              <p className="text-zinc-500 text-xs pt-2">
                Add a synth or sample track below to get bumping and whizzing.
              </p>
            </div>
          </div>
        ) : (
          song.tracks.map((track, idx) => (
            <div key={track.id}>
              <TrackRow
                track={track}
                index={idx}
                totalSteps={totalSteps}
                stepSize={stepSize}
                stepsPerBeat={stepsPerBeat}
                stepsPerBar={stepsPerBar}
                cellSize={cellSize}
                selected={track.id === selectedTrackId}
                soloed={soloTrackId === track.id}
                currentCol={currentCol}
                expanded={expandedTrackIds.has(track.id)}
                onSelect={() => onSelectTrack(track.id)}
                onToggleExpanded={() => toggleExpanded(track.id)}
                onMute={() => onMuteTrack(track.id, !track.muted)}
                onSolo={() => onSoloTrack(track.id)}
                onRemove={() => onRemoveTrack(track.id)}
                onClone={() => onCloneTrack(track)}
                onMoveUp={idx > 0 ? () => onMoveTrack(idx, idx - 1) : undefined}
                onMoveDown={idx < trackCount - 1 ? () => onMoveTrack(idx, idx + 1) : undefined}
                stepRowRef={el => { stepRowRefs.current[idx] = el; }}
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
                <div className="mb-1">
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
                    zoom={zoom}
                    scrollRef={el => { pianoRollRefs.current[idx] = el; }}
                  />
                </div>
              )}
            </div>
          ))
        )}
        {addTrackSlot}
      </div>

      {/* Global horizontal scrollbar */}
      {song.tracks.length > 0 && (
        <div
          ref={scrollContainerRef}
          onScroll={handleScrollbarScroll}
          className={`grid-scrollbar overflow-x-auto mt-1 transition-opacity duration-500 ${scrollFade ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          }}
        >
          <div style={{ width: totalGridWidth, height: 8 }} />
        </div>
      )}
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  index: number;
  totalSteps: number;
  stepSize: number;
  stepsPerBeat: number;
  stepsPerBar: number;
  cellSize: number;
  selected: boolean;
  soloed: boolean;
  currentCol: number | null;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onMute: () => void;
  onSolo: () => void;
  onRemove: () => void;
  onClone: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onStepMouseDown: (col: number, isActive: boolean) => void;
  onStepMouseEnter: (col: number) => void;
  onRename: (name: string) => void;
  stepRowRef?: (el: HTMLDivElement | null) => void;
}

function TrackRow({
  track,
  totalSteps,
  stepSize,
  stepsPerBeat,
  stepsPerBar,
  cellSize,
  selected,
  soloed,
  currentCol,
  expanded,
  onSelect,
  onToggleExpanded,
  onMute,
  onSolo,
  onRemove,
  onClone,
  onMoveUp,
  onMoveDown,
  onStepMouseDown,
  onStepMouseEnter,
  onRename,
  stepRowRef,
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

  // Get the track's active color (for step cells)
  const trackColor = useMemo(() => {
    if (track.type === 'sample' && track.sample?.sampleName) {
      const cat = classifySample(track.sample.sampleName);
      return { color: cat.color, hoverColor: cat.hoverColor };
    }
    return SYNTH_COLOR;
  }, [track.type, track.sample?.sampleName]);

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
          onClick={e => { e.stopPropagation(); onClone(); }}
          className="w-7 h-7 rounded bg-zinc-700 text-zinc-400 hover:bg-purple-600 hover:text-white cursor-pointer flex items-center justify-center border border-zinc-600"
          title="Clone track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
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
        <div className="flex-1" />
        {/* Up/down reorder buttons */}
        <button
          onClick={e => { e.stopPropagation(); onMoveUp?.(); }}
          disabled={!onMoveUp}
          className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-default cursor-pointer flex items-center justify-center border border-zinc-600 text-zinc-400 hover:text-zinc-200 shrink-0"
          title="Move up"
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onMoveDown?.(); }}
          disabled={!onMoveDown}
          className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-default cursor-pointer flex items-center justify-center border border-zinc-600 text-zinc-400 hover:text-zinc-200 shrink-0"
          title="Move down"
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Step cells */}
      <div ref={stepRowRef} className="flex gap-px overflow-hidden" onMouseLeave={() => {}}>
        {Array.from({ length: totalSteps }, (_, col) => {
          const active = activeSteps.get(col);
          const isOnBeat = col % stepsPerBeat === 0;
          const isBarStart = col > 0 && col % stepsPerBar === 0;
          const isCurrent = col === currentCol;

          // Per-step color: sample tracks show per-step category color, synth tracks show track color
          const stepSampleName = active?.sampleName;
          const stepColor = stepSampleName
            ? classifySample(stepSampleName)
            : null;

          const activeColor = stepColor ? stepColor.color : trackColor.color;
          const activeHover = stepColor ? stepColor.hoverColor : trackColor.hoverColor;

          const stepLabel = active
            ? (stepSampleName ? classifySample(stepSampleName).abbr : track.type === 'synth' ? midiNoteToName(active.note).replace(/\d+/, '') : '')
            : '';

          return (
            <div key={col} className="relative shrink-0" style={{ width: cellSize }}>
              {/* Bar separator line — overlaid, doesn't displace cell */}
              {isBarStart && (
                <div className="absolute left-0 top-0 bottom-0 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.18)', marginLeft: -1 }} />
              )}
              <button
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStepMouseDown(col, !!active);
                }}
                onMouseEnter={() => onStepMouseEnter(col)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: active ? activeColor : undefined,
                }}
                className={`
                  rounded-sm text-[9px] font-mono cursor-pointer transition-colors select-none text-white
                  ${isCurrent ? 'ring-1 ring-purple-400' : ''}
                  ${!active ? (selected
                    ? (isOnBeat ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-zinc-700 hover:bg-zinc-600')
                    : (isOnBeat ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-800 hover:bg-zinc-700')
                  ) : ''}
                `}
                onMouseOver={active ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = activeHover; } : undefined}
                onMouseOut={active ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = activeColor; } : undefined}
                title={active ? (stepSampleName ? friendlyName(stepSampleName) : midiNoteToName(active.note)) : `Step ${col + 1}`}
              >
                {stepLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

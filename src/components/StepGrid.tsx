import { useMemo, useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import type { Song, Track, GridResolution, InstalledPack } from '../types';
import { ticksPerStep, midiNoteToName, UNPITCHED_NOTE } from '../types';
import { TrackSettings } from './TrackSettings';
import { DrumGrid } from './DrumGrid';
import { PianoRoll } from './PianoRoll';
import { classifySample, friendlyName, SYNTH_COLOR } from '../sample-categories';
import { Tooltip } from './Tooltip';
import { IconButton } from './IconButton';
import { useDragPaint } from '../hooks/useDragPaint';

// Shared grid geometry — every row in the global grid uses these constants.
export const STEP_CELL_W = 28;        // px at zoom 1.0
export const STEP_GAP = 1;            // gap-px between cells
export const STICKY_COL_W = 360;      // total sticky left column width
export const CONTROLS_W = 200;        // sub-zone within sticky col: expanded controls
export const ROW_LABEL_W = STICKY_COL_W - CONTROLS_W; // sub-zone: per-row label (note name / lane controls)
export const CELL_GAP = 8;            // visual gap between sticky panel and the first cell

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
  onSetDrumStep: (trackId: string, position: number, sampleName: string, duration: number) => void;
  onClearDrumStep: (trackId: string, position: number, sampleName: string) => void;
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

function trackTypeLabel(track: Track): string {
  if (track.type === 'synth') return 'Syn';
  if (track.type === 'drum-machine') return 'Drm';
  return 'Smp';
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
  onSetDrumStep,
  onClearDrumStep,
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

  // Track-locked drag for paint/erase: drag.start/drag.enter route to onSetStep/onClearStep.
  // dragTrackRef gates enter events so dragging across rows does not paint other tracks.
  const dragTrackRef = useRef<string | null>(null);
  const drag = useDragPaint<{ trackId: string; position: number; note: number; sampleName?: string }>(
    ({ trackId, position, note, sampleName }) => onSetStep(trackId, position, note, stepSize, sampleName),
    ({ trackId, position }) => onClearStep(trackId, position),
  );
  const beginDrag = useCallback((trackId: string, cell: { position: number; note: number; sampleName?: string }, isActive: boolean) => {
    dragTrackRef.current = trackId;
    drag.start({ trackId, ...cell }, isActive);
  }, [drag]);
  const dragInto = useCallback((trackId: string, cell: { position: number; note: number; sampleName?: string }) => {
    if (dragTrackRef.current !== trackId) return;
    drag.enter({ trackId, ...cell });
  }, [drag]);

  // Single horizontal scroll viewport. The custom bottom scrollbar and this
  // viewport drive each other; guard with a flag to prevent feedback loops.
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const syncSource = useRef<'viewport' | 'scrollbar' | null>(null);
  const [scrollFade, setScrollFade] = useState(false);
  const scrollFadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cellSize = Math.round(STEP_CELL_W * zoom);
  const totalGridWidth = totalSteps * (cellSize + STEP_GAP);
  const fullWidth = STICKY_COL_W + CELL_GAP + totalGridWidth;

  const showScrollFade = useCallback(() => {
    setScrollFade(true);
    if (scrollFadeTimer.current) clearTimeout(scrollFadeTimer.current);
    scrollFadeTimer.current = setTimeout(() => setScrollFade(false), 1200);
  }, []);

  const handleViewportScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncSource.current === 'scrollbar') return;
    syncSource.current = 'viewport';
    if (scrollbarRef.current) {
      scrollbarRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    showScrollFade();
    requestAnimationFrame(() => { syncSource.current = null; });
  }, [showScrollFade]);

  const handleScrollbarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncSource.current === 'viewport') return;
    syncSource.current = 'scrollbar';
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    showScrollFade();
    requestAnimationFrame(() => { syncSource.current = null; });
  }, [showScrollFade]);

  const trackCount = song.tracks.length;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div
        ref={viewportRef}
        onScroll={handleViewportScroll}
        className="flex-1 overflow-x-auto overflow-y-visible no-x-scrollbar px-2 py-2 bg-zinc-950"
      >
        <div className="relative" style={{ minWidth: fullWidth, width: fullWidth }}>
          {/* Global playhead — single soft yellow bar across all rows */}
          {currentCol !== null && song.tracks.length > 0 && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: STICKY_COL_W + CELL_GAP + currentCol * (cellSize + STEP_GAP),
                width: cellSize,
                background: 'rgba(250, 204, 21, 0.18)',
                borderLeft: '1px solid rgba(250, 204, 21, 0.45)',
                borderRight: '1px solid rgba(250, 204, 21, 0.45)',
                zIndex: 5,
              }}
            />
          )}
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
              <div key={track.id} className="mb-1">
                <TrackRow
                  track={track}
                  totalSteps={totalSteps}
                  stepSize={stepSize}
                  stepsPerBeat={stepsPerBeat}
                  stepsPerBar={stepsPerBar}
                  cellSize={cellSize}
                  selected={track.id === selectedTrackId}
                  soloed={soloTrackId === track.id}
                  expanded={expandedTrackIds.has(track.id)}
                  onSelect={() => onSelectTrack(track.id)}
                  onToggleExpanded={() => toggleExpanded(track.id)}
                  onMute={() => onMuteTrack(track.id, !track.muted)}
                  onSolo={() => onSoloTrack(track.id)}
                  onRemove={() => onRemoveTrack(track.id)}
                  onClone={() => onCloneTrack(track)}
                  onMoveUp={idx > 0 ? () => onMoveTrack(idx, idx - 1) : undefined}
                  onMoveDown={idx < trackCount - 1 ? () => onMoveTrack(idx, idx + 1) : undefined}
                  onStepMouseDown={track.type === 'drum-machine' ? undefined : (col, isActive) => {
                    const position = col * stepSize;
                    const defaultNote = track.type === 'synth' ? ((track.synth.octave + 4) * 12 + 24) : UNPITCHED_NOTE;
                    const brushSample = track.type === 'sample' ? track.sample.sampleName : undefined;
                    beginDrag(track.id, { position, note: defaultNote, sampleName: brushSample }, isActive);
                  }}
                  onStepMouseEnter={track.type === 'drum-machine' ? undefined : (col) => {
                    const position = col * stepSize;
                    const defaultNote = track.type === 'synth' ? ((track.synth.octave + 4) * 12 + 24) : UNPITCHED_NOTE;
                    const brushSample = track.type === 'sample' ? track.sample.sampleName : undefined;
                    dragInto(track.id, { position, note: defaultNote, sampleName: brushSample });
                  }}
                  onRename={(name) => onUpdateTrack(track.id, { name })}
                />
                {expandedTrackIds.has(track.id) && (() => {
                  const controlsPanel = (
                    <TrackSettings
                      track={track}
                      onUpdate={(updates) => onUpdateTrack(track.id, updates)}
                      installedPacks={installedPacks}
                      resolution={resolution}
                    />
                  );
                  if (track.type === 'drum-machine') {
                    return (
                      <DrumGrid
                        track={track}
                        resolution={resolution}
                        measures={song.measures}
                        onSetDrumStep={onSetDrumStep}
                        onClearDrumStep={onClearDrumStep}
                        onUpdateTrack={(updates) => onUpdateTrack(track.id, updates)}
                        installedPacks={installedPacks}
                        zoom={zoom}
                        controlsPanel={controlsPanel}
                      />
                    );
                  }
                  return (
                    <PianoRoll
                      track={track}
                      songKey={song.key}
                      songScale={song.scale}
                      resolution={resolution}
                      measures={song.measures}
                      onSetStep={(trackId, position, note, duration) => onSetStep(trackId, position, note, duration)}
                      onClearStep={onClearStep}
                      zoom={zoom}
                      compact={track.type === 'sample'}
                      controlsPanel={controlsPanel}
                    />
                  );
                })()}
              </div>
            ))
          )}
          {addTrackSlot && (
            <div className="sticky left-0 z-10" style={{ width: 'fit-content' }}>
              {addTrackSlot}
            </div>
          )}
        </div>
      </div>

      {/* Global horizontal scrollbar */}
      {song.tracks.length > 0 && (
        <div
          ref={scrollbarRef}
          onScroll={handleScrollbarScroll}
          className={`grid-scrollbar overflow-x-auto mt-1 transition-opacity duration-500 ${scrollFade ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          }}
        >
          <div style={{ width: fullWidth, height: 8 }} />
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
  stepsPerBar: number;
  cellSize: number;
  selected: boolean;
  soloed: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onMute: () => void;
  onSolo: () => void;
  onRemove: () => void;
  onClone: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onStepMouseDown?: (col: number, isActive: boolean) => void;
  onStepMouseEnter?: (col: number) => void;
  onRename: (name: string) => void;
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
      if (!map.has(col)) {
        map.set(col, { note: step.note, sampleName: step.sampleName });
      }
    }
    return map;
  }, [track.steps, stepSize]);

  const sampleBrushName = track.type === 'sample' ? track.sample.sampleName : null;
  const trackColor = useMemo(() => {
    if (sampleBrushName) {
      const cat = classifySample(sampleBrushName);
      return { color: cat.color, hoverColor: cat.hoverColor };
    }
    if (track.type === 'drum-machine') {
      return { color: '#8855cc', hoverColor: '#9966dd' };
    }
    return SYNTH_COLOR;
  }, [track.type, sampleBrushName]);

  const typeLabel = trackTypeLabel(track);
  const rowBg = selected ? 'bg-zinc-800/70' : 'hover:bg-zinc-800/30';

  return (
    <div className={`rounded ${rowBg}`} onClick={onSelect}>
      {/* Step row: sticky left col (all controls) + cells */}
      <div className="flex">
        <div
          className="sticky left-0 z-10 flex items-center gap-1 pl-1.5 pr-2 bg-zinc-800 border-r-2 border-zinc-700 shadow-[2px_0_4px_rgba(0,0,0,0.3)] shrink-0"
          style={{ width: STICKY_COL_W, height: cellSize }}
          onClick={e => e.stopPropagation()}
        >
          <Tooltip text={expanded ? 'Collapse settings' : 'Expand settings'}>
            <button
              onClick={e => { e.stopPropagation(); onToggleExpanded(); }}
              className="w-5 h-5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white cursor-pointer flex items-center justify-center border border-zinc-600 shrink-0"
            >
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                <path
                  d={expanded ? 'M2 7.5L6 3.5L10 7.5' : 'M2 4.5L6 8.5L10 4.5'}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
          <span
            className="text-[10px] font-mono uppercase tracking-wider shrink-0 w-7"
            style={{ color: trackColor.color }}
          >
            {typeLabel}
          </span>
          {editing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="text-xs text-white bg-zinc-900 border border-purple-500 rounded px-1 py-0.5 min-w-0 outline-none flex-1"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-xs text-zinc-200 truncate cursor-text hover:text-white flex-1 min-w-0"
              onClick={(e) => { e.stopPropagation(); startEditing(); }}
              title="Click to rename"
            >
              {track.name}
            </span>
          )}
          <IconButton
            tooltip={track.muted ? 'Unmute' : 'Mute'}
            variant="mute"
            active={track.muted}
            onClick={e => { e.stopPropagation(); onMute(); }}
          >
            M
          </IconButton>
          <IconButton
            tooltip={soloed ? 'Un-solo' : 'Solo'}
            variant="solo"
            active={soloed}
            onClick={e => { e.stopPropagation(); onSolo(); }}
          >
            S
          </IconButton>
          <IconButton
            tooltip="Clone track"
            variant="action"
            onClick={e => { e.stopPropagation(); onClone(); }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </IconButton>
          <IconButton
            tooltip="Remove track"
            variant="danger"
            onClick={e => { e.stopPropagation(); onRemove(); }}
          >
            ×
          </IconButton>
          <div className="flex flex-col gap-px shrink-0">
            <Tooltip text="Move up">
              <button
                onClick={e => { e.stopPropagation(); onMoveUp?.(); }}
                disabled={!onMoveUp}
                className="w-4 h-2.5 rounded-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-default cursor-pointer flex items-center justify-center text-zinc-300"
              >
                <svg width="8" height="4" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </Tooltip>
            <Tooltip text="Move down">
              <button
                onClick={e => { e.stopPropagation(); onMoveDown?.(); }}
                disabled={!onMoveDown}
                className="w-4 h-2.5 rounded-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-default cursor-pointer flex items-center justify-center text-zinc-300"
              >
                <svg width="8" height="4" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex gap-px shrink-0" style={{ marginLeft: CELL_GAP }}>
          {Array.from({ length: totalSteps }, (_, col) => {
            const active = activeSteps.get(col);
            const isOnBeat = col % stepsPerBeat === 0;
            const isBarStart = col > 0 && col % stepsPerBar === 0;

            const stepSampleName = active?.sampleName;
            const stepColor = stepSampleName
              ? classifySample(stepSampleName)
              : null;

            const activeColor = stepColor ? stepColor.color : trackColor.color;
            const activeHover = stepColor ? stepColor.hoverColor : trackColor.hoverColor;

            const stepLabel = active
              ? (stepSampleName ? classifySample(stepSampleName).abbr : track.type === 'synth' ? midiNoteToName(active.note).replace(/\d+/, '') : track.type === 'drum-machine' ? '' : '')
              : '';

            return (
              <div key={col} className="relative shrink-0" style={{ width: cellSize }}>
                {isBarStart && (
                  <div className="absolute left-0 top-0 bottom-0 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.18)', marginLeft: -1 }} />
                )}
                <button
                  onMouseDown={onStepMouseDown ? (e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStepMouseDown(col, !!active);
                  }) : undefined}
                  onMouseEnter={onStepMouseEnter ? (() => onStepMouseEnter(col)) : undefined}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: active ? activeColor : undefined,
                  }}
                  className={`
                    rounded-sm text-[9px] font-mono cursor-pointer transition-colors select-none text-white
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
    </div>
  );
}

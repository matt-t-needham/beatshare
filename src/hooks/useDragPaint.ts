import { useCallback, useEffect, useRef } from 'react';

type DragMode = 'paint' | 'erase';

/**
 * Shared paint/erase drag state machine for grid cells.
 *
 * `start(cell, isActive)` — call on mouse-down on a cell. If the cell is
 * already active, this enters erase mode; otherwise paint mode. Calls the
 * matching callback for the initial cell.
 *
 * `enter(cell)` — call on mouse-enter while dragging. Calls the current
 * mode's callback for each newly-entered cell.
 *
 * A global mouseup listener resets the drag state.
 */
export function useDragPaint<C>(
  onPaint: (cell: C) => void,
  onErase: (cell: C) => void,
): {
  start: (cell: C, isActive: boolean) => void;
  enter: (cell: C) => void;
} {
  const modeRef = useRef<DragMode | null>(null);

  useEffect(() => {
    const onUp = () => { modeRef.current = null; };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, []);

  const start = useCallback((cell: C, isActive: boolean) => {
    if (isActive) {
      modeRef.current = 'erase';
      onErase(cell);
    } else {
      modeRef.current = 'paint';
      onPaint(cell);
    }
  }, [onPaint, onErase]);

  const enter = useCallback((cell: C) => {
    const mode = modeRef.current;
    if (!mode) return;
    if (mode === 'paint') onPaint(cell);
    else onErase(cell);
  }, [onPaint, onErase]);

  return { start, enter };
}

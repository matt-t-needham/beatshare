import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  delay?: number;
}

export function Tooltip({ text, children, delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [side, setSide] = useState<'right' | 'left'>('right');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible || !tooltipRef.current || !containerRef.current) return;
    const timer = setTimeout(() => {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      if (!tooltip || !container) return;
      const tooltipRect = tooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const padding = 8;
      const wouldOverflowRight = containerRect.right + tooltipRect.width + padding > window.innerWidth;
      setSide(wouldOverflowRight ? 'left' : 'right');
    }, 0);
    return () => clearTimeout(timer);
  }, [visible]);

  const positionClass = side === 'right'
    ? 'left-full ml-1.5 top-1/2 -translate-y-1/2'
    : 'right-full mr-1.5 top-1/2 -translate-y-1/2';

  const arrowClass = side === 'right'
    ? 'absolute w-2 h-2 bg-zinc-800 border-zinc-600 rotate-45 right-full -mr-1 top-1/2 -translate-y-1/2 border-l border-b'
    : 'absolute w-2 h-2 bg-zinc-800 border-zinc-600 rotate-45 left-full -ml-1 top-1/2 -translate-y-1/2 border-r border-t';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <span
          ref={tooltipRef}
          className={`tooltip-popup absolute z-50 px-2 py-1 text-xs text-zinc-200 bg-zinc-800 border border-zinc-600 rounded shadow-lg whitespace-nowrap pointer-events-none ${positionClass}`}
        >
          {text}
          <span className={arrowClass} />
        </span>
      )}
    </span>
  );
}

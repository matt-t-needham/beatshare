import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  delay?: number;
}

type HorizontalAlign = 'left' | 'center' | 'right';

export function Tooltip({ text, children, position = 'top', delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [align, setAlign] = useState<HorizontalAlign>('center');
  const [verticalPos, setVerticalPos] = useState<'top' | 'bottom'>(position);
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

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (!visible || !tooltipRef.current || !containerRef.current) return;

    // Use a small timeout to ensure DOM has rendered
    const timer = setTimeout(() => {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      if (!tooltip || !container) return;

      const tooltipRect = tooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Check horizontal bounds (with 8px padding)
      const leftPos = containerRect.left + (containerRect.width - tooltipRect.width) / 2;
      const rightPos = leftPos + tooltipRect.width;
      const padding = 8;

      let newAlign: HorizontalAlign = 'center';
      if (leftPos - padding < 0) {
        newAlign = 'left';
      } else if (rightPos + padding > window.innerWidth) {
        newAlign = 'right';
      }
      setAlign(newAlign);

      // Check vertical bounds
      let newVerticalPos = position;
      if (position === 'top' && tooltipRect.top - padding < 0) {
        newVerticalPos = 'bottom';
      } else if (position === 'bottom' && tooltipRect.bottom + padding > window.innerHeight) {
        newVerticalPos = 'top';
      }
      setVerticalPos(newVerticalPos);
    }, 0);

    return () => clearTimeout(timer);
  }, [visible, position]);

  const getHorizontalClasses = () => {
    switch (align) {
      case 'left':
        return 'left-0';
      case 'right':
        return 'right-0';
      case 'center':
      default:
        return 'left-1/2 -translate-x-1/2';
    }
  };

  const getVerticalClasses = () => {
    return verticalPos === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  };

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 bg-zinc-800 border-zinc-600 rotate-45';
    const alignClass = align === 'left' ? 'left-2' : align === 'right' ? 'right-2' : 'left-1/2 -translate-x-1/2';
    const verticalClass = verticalPos === 'top' ? 'top-full -mt-1 border-r border-b' : 'bottom-full -mb-1 border-l border-t';
    return `${baseClasses} ${alignClass} ${verticalClass}`;
  };

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
          className={`tooltip-popup absolute z-50 px-2 py-1 text-xs text-zinc-200 bg-zinc-800 border border-zinc-600 rounded shadow-lg whitespace-nowrap pointer-events-none ${getVerticalClasses()} ${getHorizontalClasses()}`}
        >
          {text}
          <span className={getArrowClasses()} />
        </span>
      )}
    </span>
  );
}

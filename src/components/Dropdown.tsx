import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string;
  label: ReactNode;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  triggerClassName?: string;
  triggerContent?: ReactNode;
  triggerTitle?: string;
  minWidthFromTrigger?: boolean;
}

export function Dropdown({
  value, options, onChange, triggerClassName, triggerContent, triggerTitle,
  minWidthFromTrigger = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; minWidth: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const currentLabel = options.find(o => o.value === value)?.label ?? value;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 4, minWidth: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={`${triggerClassName ?? ''} inline-flex items-center justify-between gap-1`}
        title={triggerTitle}
      >
        <span className="truncate">{triggerContent ?? currentLabel}</span>
        <svg width="8" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0 opacity-70">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="fixed z-[1000] bg-zinc-900 border border-zinc-700 rounded shadow-xl flex flex-col py-1 text-xs max-h-72 overflow-y-auto thin-scrollbar"
          style={{
            left: coords.left,
            top: coords.top,
            minWidth: minWidthFromTrigger ? coords.minWidth : undefined,
          }}
          onClick={e => e.stopPropagation()}
        >
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`shrink-0 px-2 py-1 text-left hover:bg-zinc-800 whitespace-nowrap cursor-pointer ${value === o.value ? 'text-purple-400' : 'text-zinc-200'}`}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

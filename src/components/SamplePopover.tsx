import { useState, useRef, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SampleCategory } from '../sample-categories';
import { classifySample, friendlyNames } from '../sample-categories';

interface Props {
  value?: string;
  groupedSamples: { category: SampleCategory; samples: string[] }[];
  onSelect: (sampleName: string) => void;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
}

export function SamplePopover({ value, groupedSamples, onSelect, trigger, triggerClassName, triggerTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const nameMap = useMemo(
    () => friendlyNames(groupedSamples.flatMap(g => g.samples)),
    [groupedSamples],
  );

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 4 });
    const startCat = value
      ? (groupedSamples.find(g => g.samples.includes(value))?.category.id
        ?? classifySample(value).id)
      : groupedSamples[0]?.category.id ?? null;
    setActiveCat(startCat);
  }, [open, value, groupedSamples]);

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

  const activeSamples = groupedSamples.find(g => g.category.id === activeCat)?.samples ?? [];

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={triggerClassName}
        title={triggerTitle}
      >
        {trigger}
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="fixed z-[1000] bg-zinc-900 border border-zinc-700 rounded shadow-xl flex text-xs"
          style={{ left: coords.left, top: coords.top }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col py-1 max-h-72 overflow-y-auto thin-scrollbar border-r border-zinc-700 w-36 shrink-0">
            {groupedSamples.map(({ category }) => (
              <button
                key={category.id}
                onMouseEnter={() => setActiveCat(category.id)}
                onClick={() => setActiveCat(category.id)}
                className={`shrink-0 px-2 py-1 text-left hover:bg-zinc-800 cursor-pointer whitespace-nowrap truncate ${activeCat === category.id ? 'bg-zinc-800 text-white' : 'text-zinc-300'}`}
              >
                {category.name}
              </button>
            ))}
            {groupedSamples.length === 0 && (
              <span className="px-2 py-1 text-zinc-500 italic">Empty</span>
            )}
          </div>
          <div className="flex flex-col py-1 max-h-72 overflow-y-auto thin-scrollbar w-52 shrink-0">
            {activeSamples.map(name => {
              const label = nameMap.get(name) ?? name;
              return (
                <button
                  key={name}
                  onClick={() => { onSelect(name); setOpen(false); }}
                  className={`shrink-0 px-2 py-1 text-left hover:bg-zinc-800 whitespace-nowrap truncate cursor-pointer ${value === name ? 'text-purple-400' : 'text-zinc-200'}`}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
            {activeSamples.length === 0 && (
              <span className="px-2 py-1 text-zinc-500 italic">No samples</span>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

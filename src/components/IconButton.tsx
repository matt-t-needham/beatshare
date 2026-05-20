import type { ReactNode, MouseEvent } from 'react';
import { Tooltip } from './Tooltip';

export type IconButtonVariant = 'action' | 'mute' | 'solo' | 'danger';

interface IconButtonProps {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  tooltip?: string;
  variant?: IconButtonVariant;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

function classesFor(variant: IconButtonVariant, active: boolean): string {
  // Inactive style is shared across variants — neutral grey with a hover hint
  // matched to the variant's "active" intent.
  const base = 'w-5 h-5 rounded cursor-pointer flex items-center justify-center border shrink-0';
  if (active) {
    switch (variant) {
      case 'mute':   return `${base} bg-yellow-600 text-white border-yellow-500`;
      case 'solo':   return `${base} bg-blue-600 text-white border-blue-500`;
      case 'danger': return `${base} bg-red-600 text-white border-red-500`;
      case 'action': return `${base} bg-zinc-600 text-white border-zinc-500`;
    }
  }
  switch (variant) {
    case 'danger': return `${base} bg-zinc-700 text-zinc-300 hover:bg-red-700 hover:text-white border-zinc-600`;
    case 'mute':
    case 'solo':
    case 'action':
    default:       return `${base} bg-zinc-700 text-zinc-300 hover:bg-zinc-600 border-zinc-600`;
  }
}

export function IconButton({
  onClick,
  children,
  tooltip,
  variant = 'action',
  active = false,
  disabled = false,
  className,
  ariaLabel,
}: IconButtonProps) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? tooltip}
      className={`${classesFor(variant, active)} text-[10px] font-bold leading-none disabled:opacity-30 disabled:cursor-default ${className ?? ''}`}
    >
      {children}
    </button>
  );
  return tooltip ? <Tooltip text={tooltip}>{button}</Tooltip> : button;
}

'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { Delta } from '@/lib/api';
import { cn } from '@/lib/utils';

export function DeltaBadge({
  delta,
  label,
  invertColors = false,
}: {
  delta: Delta | null | undefined;
  label?: string;
  invertColors?: boolean;
}) {
  if (!delta || delta.pct == null) return <span className="text-xs text-[var(--color-muted)]">—</span>;
  const up = delta.abs > 0;
  const down = delta.abs < 0;
  const flat = delta.abs === 0;
  const goodDirection = invertColors ? down : up;
  const color = flat
    ? 'text-[var(--color-muted)]'
    : goodDirection
      ? 'text-[var(--color-success)]'
      : 'text-[var(--color-danger)]';
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium tabular-nums', color)}>
      <Icon size={12} />
      {delta.abs > 0 ? '+' : ''}
      {delta.abs} ({delta.pct != null && delta.pct > 0 ? '+' : ''}
      {delta.pct}%){label ? ` ${label}` : ''}
    </span>
  );
}

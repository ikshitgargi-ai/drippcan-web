'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/utils';

/**
 * Always-visible scroll ticker of recent SOD listing changes.
 * Auto-refreshes every 60s. Hidden on small mobile to save space.
 */
export function LiveTicker() {
  const digest = useQuery({
    queryKey: ['ticker-digest'],
    queryFn: () => api.listingDigest(7),
    refetchInterval: 60_000,
  });

  const events = (digest.data?.changes ?? []).slice(0, 30);

  if (!events.length) return null;

  return (
    <div className="hidden sm:flex items-center gap-3 h-8 px-3 bg-[var(--color-background)] border-b border-[var(--color-card-border)] overflow-hidden">
      <div className="shrink-0 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-bold">
        <ActivityIcon size={11} className="text-[var(--color-success)]" />
        Live SOD
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-5 animate-ticker whitespace-nowrap">
          {[...events, ...events].map((e, i) => (
            <Link
              key={i}
              href={e.is_tracked ? `/skus/${e.sku}` : '/intel'}
              className="flex items-center gap-2 text-xs hover:text-[var(--color-accent)]"
            >
              <span className={`change-chip change-${e.change_type} text-[10px] !py-0.5`}>
                {e.change_type.replace('_', ' ')}
              </span>
              <span className={e.is_tracked ? 'text-[var(--color-accent)] font-semibold' : ''}>
                {(e.product_name || `SKU ${e.sku}`).slice(0, 38)}
              </span>
              <span className="text-[var(--color-muted)]">{relativeTime(e.change_date)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

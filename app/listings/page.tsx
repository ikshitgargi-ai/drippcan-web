'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, ArrowLeftRight, Flag, Circle, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { formatDate } from '@/lib/utils';

type ChangeFilter = 'all' | 'listings' | 'delistings' | 'flips';

/**
 * Listings & Delistings feed.
 *
 * This is the firehose of LCBO listing changes — every NEW_LISTING, DELISTED,
 * RELISTED, STATUS_FLIP in the last N days from SOD. Mobile-first card layout,
 * prominent counts, filter pills.
 */
export default function ListingsPage() {
  const [days, setDays] = useState(14);
  const [filter, setFilter] = useState<ChangeFilter>('all');
  // Default tracked-only: the SOD consignment file carries ~50 junk SKUs
  // that would otherwise flood the feed. Toggle shows the full catalog.
  const [trackedOnly, setTrackedOnly] = useState(true);

  const digest = useQuery({
    queryKey: ['listing-digest', days, trackedOnly],
    queryFn: () => api.listingDigest(days, trackedOnly),
  });

  const counts = digest.data?.counts ?? [];
  const getCount = (t: string) => counts.find((c) => c.change_type === t)?.count ?? 0;
  const newCount = getCount('NEW_LISTING') + getCount('RELISTED');
  const delistedCount = getCount('DELISTED');
  const flipCount = getCount('STATUS_FLIP');

  const filteredChanges = (digest.data?.changes ?? []).filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'listings') return c.change_type === 'NEW_LISTING' || c.change_type === 'RELISTED';
    if (filter === 'delistings') return c.change_type === 'DELISTED';
    if (filter === 'flips') return c.change_type === 'STATUS_FLIP';
    return true;
  });

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="muted-small font-semibold uppercase tracking-wider">SOD Live Feed</span>
        </div>
        <h1>Listings &amp; Delistings</h1>
        <p className="text-muted text-sm">
          Every listing change at LCBO in the last {days} days, from the Sale-of-Data feed.
        </p>
      </header>

      <FreshnessBanner />

      {/* KPI cards — 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigStat
          label="New / Relisted"
          value={newCount}
          icon={<TrendingUp size={18} />}
          color="var(--color-success)"
          onClick={() => setFilter('listings')}
          active={filter === 'listings'}
        />
        <BigStat
          label="Delisted"
          value={delistedCount}
          icon={<TrendingDown size={18} />}
          color="var(--color-danger)"
          onClick={() => setFilter('delistings')}
          active={filter === 'delistings'}
        />
        <BigStat
          label="Status Flips"
          value={flipCount}
          icon={<ArrowLeftRight size={18} />}
          color="var(--color-warning)"
          onClick={() => setFilter('flips')}
          active={filter === 'flips'}
        />
        <BigStat
          label="All Changes"
          value={newCount + delistedCount + flipCount}
          icon={<Circle size={18} />}
          color="var(--color-accent)"
          onClick={() => setFilter('all')}
          active={filter === 'all'}
        />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1 safe-bottom-x">
        {([7, 14, 30, 90] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-11 ${
              days === d
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)] text-[var(--color-foreground)]'
            }`}
          >
            Last {d}d
          </button>
        ))}
        <button
          onClick={() => setTrackedOnly((v) => !v)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 min-h-11 ${
            trackedOnly
              ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
              : 'bg-[var(--color-card)] border border-[var(--color-card-border)] text-[var(--color-foreground)]'
          }`}
        >
          <Filter size={14} />
          {trackedOnly ? 'Our SKUs only' : 'All LCBO SKUs'}
        </button>
      </div>

      {/* Feed */}
      <div className="space-y-2.5">
        {digest.isLoading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        {filteredChanges.length === 0 && !digest.isLoading && (
          <div className="m-card text-center py-8 text-muted">
            No {filter === 'all' ? '' : filter} changes in the last {days} days.
          </div>
        )}
        {filteredChanges.map((c, i) => (
          <div
            key={i}
            className={`m-card ${
              c.is_tracked ? 'border-[var(--color-accent)]/40 bg-[rgba(212,165,116,0.04)]' : ''
            }`}
          >
            <div className="m-card-header">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`change-chip change-${c.change_type}`}>
                    {c.change_type.replace('_', ' ')}
                  </span>
                  {c.is_tracked && (
                    <span className="change-chip change-BASELINE">
                      <Flag size={11} /> OURS
                    </span>
                  )}
                </div>
                <div className="m-card-title mt-1.5">
                  {c.product_name || <span className="text-muted italic">Unknown product</span>}
                </div>
                <div className="m-card-meta mt-0.5">
                  {c.brand ? `${c.brand} · ` : ''}
                  <span className="font-mono">SKU {c.sku}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted">{formatDate(c.change_date)}</div>
                <div className="text-sm mt-1 font-semibold tabular-nums">
                  {(c.old_status || '—') + ' → ' + (c.new_status || '—')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredChanges.length > 0 && (
        <div className="text-center text-xs text-muted pt-2">
          Showing {filteredChanges.length} of {digest.data?.changes.length ?? 0} changes
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  icon,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`m-card text-left transition-all ${
        active ? 'border-2' : 'border'
      }`}
      style={{
        borderColor: active ? color : 'var(--color-card-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-3xl font-bold mt-1.5 tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </div>
    </button>
  );
}

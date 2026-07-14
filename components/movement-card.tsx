'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendingUp, MinusCircle, Store as StoreIcon, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

/**
 * MovementCard — authoritative store/listing/new-store counts. Renders a
 * compact 3-stat header with an expandable detail panel. Window is
 * configurable; default 7 days.
 */
export function MovementCard({
  defaultDays = 7,
}: {
  defaultDays?: number;
}) {
  const [days, setDays] = useState(defaultDays);
  const [expanded, setExpanded] = useState(false);

  const movement = useQuery({
    queryKey: ['movement', days],
    queryFn: () => {
      const today = new Date();
      const start = new Date(today.getTime() - days * 86400 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return api.movement({ start: fmt(start), end: fmt(today) });
    },
    refetchInterval: 60_000,
  });

  const m = movement.data;

  return (
    <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--color-card-border)]">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Movement</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Last</span>
          {[1, 7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 rounded ${
                days === d
                  ? 'bg-[var(--color-accent)] text-[#2a1f0f] font-semibold'
                  : 'text-muted hover:text-[var(--color-foreground)]'
              }`}
            >
              {d === 1 ? 'today' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Three-stat compact view */}
      <div className="grid grid-cols-3 divide-x divide-[var(--color-card-border)]">
        <Stat
          label="LCBO universe"
          value={formatNumber(
            m?.store_universe.union_total_stores ?? m?.store_universe.lcbo_universe_total ?? 0
          )}
          sub={
            m
              ? `${formatNumber(m.store_universe.carrying_us_anywhere ?? m.store_universe.stores_carrying_our_skus)} carry us`
              : 'loading…'
          }
          icon={<StoreIcon size={14} className="text-[var(--color-muted)]" />}
        />
        <Stat
          label="New listings"
          value={formatNumber(m?.listings.new_in_range ?? 0)}
          sub={`vs ${m?.listings.delisted_in_range ?? 0} delisted`}
          icon={<TrendingUp size={14} className="text-[var(--color-success)]" />}
          highlight={(m?.listings.new_in_range ?? 0) > 0 ? 'success' : undefined}
        />
        <Stat
          label="New stores"
          value={formatNumber(m?.new_stores.added_in_range ?? 0)}
          sub={`first-seen in ${days}d`}
          icon={<MinusCircle size={14} className="text-[var(--color-muted)]" />}
        />
      </div>

      {/* Source-drift hint badge if any disagreements */}
      {m && (m.store_universe.carrying_only_lcbo ?? 0) + (m.store_universe.carrying_only_sod ?? 0) > 0 && (
        <div
          className="px-4 py-2 text-xs border-t border-[var(--color-card-border)] bg-[rgba(212,165,116,0.04)] flex items-center gap-2"
        >
          <GitBranch size={12} className="text-[var(--color-accent)]" />
          <span className="flex-1">
            <span className="text-[var(--color-danger)] font-semibold">
              {m.store_universe.carrying_only_lcbo}
            </span>{' '}
            stores carry us only on lcbo.com,{' '}
            <span className="text-[var(--color-warning)] font-semibold">
              {m.store_universe.carrying_only_sod}
            </span>{' '}
            only in SOD
          </span>
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-2 text-xs text-muted hover:text-[var(--color-foreground)] flex items-center justify-center gap-1 border-t border-[var(--color-card-border)]"
      >
        {expanded ? 'Hide' : 'Show'} detail
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Detail panel */}
      {expanded && m && (
        <div className="px-4 py-3 space-y-4 border-t border-[var(--color-card-border)] bg-[rgba(0,0,0,0.15)]">
          {/* Per-SKU new listings */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              New listings by SKU
            </div>
            {m.listings.per_sku.length === 0 ? (
              <div className="text-xs text-muted">
                No new listings detected on tracked SKUs in this window.
              </div>
            ) : (
              <div className="space-y-1">
                {m.listings.per_sku.map((p) => (
                  <div key={p.sku} className="flex items-center justify-between text-xs">
                    <span>
                      <span className="text-muted">{p.brand}</span> {p.product_name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      +{p.new_listings}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Store coverage */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Distribution coverage
            </div>
            <div className="space-y-1 text-xs">
              <Row
                label="LCBO total"
                value={formatNumber(m.store_universe.lcbo_universe_total)}
              />
              <Row
                label="Carrying ≥1 of our SKUs"
                value={`${formatNumber(m.store_universe.stores_carrying_our_skus)} (${m.store_universe.carrying_pct}%)`}
              />
              <Row
                label="No listing yet"
                value={formatNumber(m.store_universe.stores_without_our_skus)}
                warn
              />
              {m.store_universe.stores_in_sod_not_in_crm > 0 && (
                <Row
                  label="In SOD but not in our directory"
                  value={formatNumber(m.store_universe.stores_in_sod_not_in_crm)}
                  warn
                />
              )}
            </div>
          </div>

          {/* Recent new-listing samples */}
          {m.listings.sample_new_listings.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
                Recent new listings (sample)
              </div>
              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {m.listings.sample_new_listings.slice(0, 12).map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-muted shrink-0">{s.date}</span>
                    <span className="flex-1 truncate">
                      {s.product_name || s.sku}
                    </span>
                    <span className="font-mono shrink-0">#{s.store_number ?? '?'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New stores list */}
          {m.new_stores.added_in_range > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
                New LCBO stores
              </div>
              <div className="space-y-1 text-xs">
                {m.new_stores.store_list.slice(0, 10).map((s) => (
                  <div key={s.store_number} className="flex items-center justify-between">
                    <span>Store #{s.store_number}</span>
                    <span className="text-muted">{s.first_seen_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  highlight?: 'success' | 'warning' | 'danger';
}) {
  const valueColor =
    highlight === 'success'
      ? 'var(--color-success)'
      : highlight === 'warning'
        ? 'var(--color-warning)'
        : highlight === 'danger'
          ? 'var(--color-danger)'
          : 'var(--color-foreground)';
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color: valueColor }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: warn ? 'var(--color-warning)' : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

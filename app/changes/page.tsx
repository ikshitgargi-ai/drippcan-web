'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, PackagePlus, Download } from 'lucide-react';
import { api, type ChangeRow } from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { TierChip, AttributionChip } from '@/components/dripp-bits';
import { formatNumber, formatDate } from '@/lib/utils';

const DAY_PRESETS = [7, 14, 30, 60] as const;

/**
 * CHANGES — new listings, delistings and restocks in the territory over the
 * last X days, from BOTH engines (SOD daily diff + lcbo.com live events).
 * Each row is tagged with tier, route day and attribution: did a rep
 * touchpoint precede the listing (rep_converted) or not (organic)?
 */
export default function ChangesPage() {
  const [days, setDays] = useState<number>(7);
  const [sku, setSku] = useState<string>('');

  const changes = useQuery({
    queryKey: ['changes', days, sku],
    queryFn: () => api.changes(days, sku || undefined),
    retry: 1,
  });

  // The backend sends one flat list tagged with `kind` — group it here.
  const data = changes.data;
  const allRows = data?.rows ?? [];
  const newListings = allRows.filter((r) => r.kind === 'new_listing');
  const delistings = allRows.filter((r) => r.kind === 'delisting');
  const restocks = allRows.filter((r) => r.kind === 'restock');

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <TrendingUp size={24} className="text-[var(--color-accent)]" />
            Changes
          </h1>
          <p className="text-sm text-muted">
            New listings, delistings and restocks in the territory: SOD diff
            plus lcbo.com live events, tagged with attribution.
          </p>
        </div>
        <a
          href={api.exportChangesXlsxUrl(days)}
          className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[#1a1f29]"
        >
          <Download size={14} />
          .xlsx
        </a>
      </header>

      {/* X-day presets + SKU filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {DAY_PRESETS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              days === d
                ? 'bg-[var(--color-accent)] text-[#2a1f0f] border-[var(--color-accent)]'
                : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
            }`}
          >
            {d} days
          </button>
        ))}
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="select !min-h-0 h-9 text-xs ml-auto"
          aria-label="Filter by SKU"
        >
          <option value="">Both SKUs</option>
          {TRACKED_SKUS.map((s) => (
            <option key={s.sku} value={s.sku}>
              {s.brand}
            </option>
          ))}
        </select>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile
          label="New listings"
          value={data?.summary?.new_listings ?? newListings.length}
          tone="success"
          loading={!changes.data}
        />
        <SummaryTile
          label="Delistings"
          value={data?.summary?.delistings ?? delistings.length}
          tone="danger"
          loading={!changes.data}
        />
        <SummaryTile
          label="Restocks"
          value={data?.summary?.restocks ?? restocks.length}
          tone="accent"
          loading={!changes.data}
        />
      </div>

      {changes.isError && (
        <div className="m-card text-center text-muted py-8 text-sm">
          Changes are not reachable right now. If the backend just woke up
          (free tier), try again in a minute.
        </div>
      )}

      {/* Gate on DATA, not isLoading — a paused/offline query must show a
          skeleton, never a false "no changes". */}
      {!changes.data &&
        !changes.isError &&
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}

      {changes.data && (
        <>
          <ChangeSection
            title={`New listings (${formatNumber(newListings.length)})`}
            icon={<TrendingUp size={16} className="text-[var(--color-success)]" />}
            rows={newListings}
            empty={`No new listings in the last ${days} days.`}
          />
          <ChangeSection
            title={`Delistings (${formatNumber(delistings.length)})`}
            icon={<TrendingDown size={16} className="text-[var(--color-danger)]" />}
            rows={delistings}
            empty={`No delistings in the last ${days} days.`}
          />
          <ChangeSection
            title={`Restocks (${formatNumber(restocks.length)})`}
            icon={<PackagePlus size={16} className="text-[var(--color-accent)]" />}
            rows={restocks}
            empty={`No restocks in the last ${days} days.`}
          />
          {data?.since && (
            <div className="text-[11px] text-muted">
              window since {formatDate(data.since)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'accent';
  loading: boolean;
}) {
  const color =
    tone === 'success'
      ? 'var(--color-success)'
      : tone === 'danger'
        ? 'var(--color-danger)'
        : 'var(--color-accent)';
  return (
    <div className="m-card dense text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {loading ? '…' : formatNumber(value)}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function skuLabel(sku: string): string {
  return TRACKED_SKUS.find((s) => s.sku === sku)?.brand ?? sku;
}

function ChangeSection({
  title,
  icon,
  rows,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: ChangeRow[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {rows.length === 0 && (
        <div className="m-card dense text-center text-muted text-xs py-4">{empty}</div>
      )}
      {rows.map((r, i) => (
        <Link
          key={`${r.sku}-${r.store_number}-${r.date}-${r.source}-${i}`}
          href={`/stores/${r.store_number}`}
          className="m-card dense block"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold">#{r.store_number}</span>
                <span className="text-sm">{r.brand || skuLabel(r.sku)}</span>
                <TierChip tier={r.tier} />
                {r.route_day != null && (
                  <span className="change-chip change-STATUS_FLIP">Day {r.route_day}</span>
                )}
                <AttributionChip tag={r.attribution ?? null} />
              </div>
              <div className="text-xs text-muted truncate mt-0.5">
                {r.product_name || ''}
                {r.kind === 'restock' && r.old_qty != null && r.new_qty != null
                  ? ` · ${formatNumber(r.old_qty)} → ${formatNumber(r.new_qty)} on lcbo.com`
                  : ''}
                {` · via ${r.source === 'live' ? 'lcbo.com' : 'SOD'}`}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted tabular-nums">
              {formatDate(r.date)}
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

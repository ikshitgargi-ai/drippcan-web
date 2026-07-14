'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scale, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ReconcileFlag, type ReconcileRow } from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { FlagChip, FLAG_META } from '@/components/dripp-bits';
import { formatNumber, formatDate, formatDateTime, relativeTime } from '@/lib/utils';

const DAY_PRESETS = [7, 14, 30, 60] as const;

const FLAG_ORDER: ReconcileFlag[] = [
  'MISSING_FROM_SOD',
  'REP_MISMATCH',
  'SOD_LAGS_LIVE',
  'LIVE_LAGS_SOD',
  'MISSING_FROM_LIVE',
  'MATCH',
];

/**
 * 3-WAY RECONCILIATION — SOD vs lcbo.com vs rep-observed, per (SKU, store)
 * across the territory. This is how "sometimes difference between SOD,
 * lcbo.com and real bottles" becomes visible instead of silent money loss.
 * Never hides a diff; surfaces last-checked timestamps for every source.
 */
export default function ReconcilePage() {
  const [days, setDays] = useState<number>(7);
  const [flagFilter, setFlagFilter] = useState<ReconcileFlag | 'all'>('all');
  const [skuFilter, setSkuFilter] = useState<string>('');
  const qc = useQueryClient();

  const reconcile = useQuery({
    queryKey: ['reconcile', days],
    queryFn: () => api.reconcile(days),
    retry: 1,
  });

  // On-demand polite lcbo.com scrape (both SKUs, 3s apart) → re-reconcile.
  const refresh = useMutation({
    mutationFn: () => api.liveRefresh(),
    onSuccess: (res) => {
      toast.success(
        res.row_count != null
          ? `lcbo.com refreshed: ${formatNumber(res.row_count)} store rows`
          : 'lcbo.com refresh started',
      );
      qc.invalidateQueries({ queryKey: ['reconcile'] });
      qc.invalidateQueries({ queryKey: ['territory-book'] });
      qc.invalidateQueries({ queryKey: ['top100'] });
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const rows = useMemo(() => reconcile.data?.rows ?? [], [reconcile.data]);

  const flagCounts = useMemo(() => {
    const counts = {} as Record<ReconcileFlag, number>;
    for (const f of FLAG_ORDER) counts[f] = reconcile.data?.summary?.[f] ?? 0;
    if (!reconcile.data?.summary) {
      for (const r of rows) counts[r.flag] = (counts[r.flag] ?? 0) + 1;
    }
    return counts;
  }, [reconcile.data, rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (flagFilter === 'all' || r.flag === flagFilter) &&
          (!skuFilter || r.sku === skuFilter),
      ),
    [rows, flagFilter, skuFilter],
  );

  // Last-checked per source, derived from the per-SKU `sources` block plus
  // the newest rep observation on any row — a diff must never be silent.
  const lastChecked = useMemo(() => {
    const src = reconcile.data?.sources;
    if (!src && rows.length === 0) return null;
    const maxOf = (vals: Array<string | null | undefined>) => {
      let best: string | null = null;
      for (const v of vals) if (v && (!best || v > best)) best = v;
      return best;
    };
    return {
      sod: maxOf(Object.values(src ?? {}).map((s) => s.sod_latest_snapshot)),
      live: maxOf(Object.values(src ?? {}).map((s) => s.live_checked_at)),
      rep: maxOf(rows.map((r) => r.rep_observed_at)),
    };
  }, [reconcile.data, rows]);

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <Scale size={24} className="text-[var(--color-accent)]" />
            Reconcile
          </h1>
          <p className="text-sm text-muted">
            SOD vs lcbo.com vs rep-observed, per SKU per store. Diffs are
            never hidden. Every mismatch here is money on the table.
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5 items-end">
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw size={14} className={refresh.isPending ? 'animate-spin' : ''} />
            {refresh.isPending ? 'Scraping…' : 'Refresh live'}
          </button>
          <a
            href={api.exportReconcileXlsxUrl()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[#1a1f29]"
          >
            <Download size={14} />
            .xlsx
          </a>
        </div>
      </header>

      {/* Rep-observation window presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">Rep observations within</span>
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
            {d}d
          </button>
        ))}
        <select
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
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

      {/* Last-checked per source — a diff must never be silent */}
      {lastChecked && (
        <div className="m-card dense text-[11px] text-muted flex flex-wrap gap-x-4 gap-y-1">
          <span>
            SOD snapshot:{' '}
            <span className="text-[var(--color-foreground)]">
              {lastChecked.sod ? formatDate(lastChecked.sod) : 'never'}
            </span>
          </span>
          <span>
            lcbo.com:{' '}
            <span className="text-[var(--color-foreground)]">
              {lastChecked.live ? formatDateTime(lastChecked.live) : 'never'}
            </span>
          </span>
          <span>
            Rep observed:{' '}
            <span className="text-[var(--color-foreground)]">
              {lastChecked.rep ? formatDateTime(lastChecked.rep) : 'none yet'}
            </span>
          </span>
        </div>
      )}

      {/* Flag filter chips with counts */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        <button
          onClick={() => setFlagFilter('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            flagFilter === 'all'
              ? 'bg-[var(--color-accent)] text-[#2a1f0f] border-[var(--color-accent)]'
              : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
          }`}
        >
          All <span className="opacity-70 tabular-nums">{formatNumber(rows.length)}</span>
        </button>
        {FLAG_ORDER.map((f) => (
          <button
            key={f}
            onClick={() => setFlagFilter(flagFilter === f ? 'all' : f)}
            title={FLAG_META[f].explain}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              background: flagFilter === f ? FLAG_META[f].bg : 'var(--color-card)',
              color: FLAG_META[f].fg,
              borderColor:
                flagFilter === f ? FLAG_META[f].fg : 'var(--color-card-border)',
            }}
          >
            {FLAG_META[f].label}{' '}
            <span className="opacity-70 tabular-nums">{formatNumber(flagCounts[f] ?? 0)}</span>
          </button>
        ))}
      </div>

      {/* Gate on DATA, not isLoading — a paused/offline query must show a
          skeleton, never a false "0 rows" (a diff may be hiding behind it). */}
      {!reconcile.data &&
        !reconcile.isError &&
        Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12" />)}

      {reconcile.isError && (
        <div className="m-card text-center text-muted py-8 text-sm">
          Reconciliation is not reachable right now. If the backend just woke
          up (free tier), try again in a minute.
        </div>
      )}

      {reconcile.data && (
        <>
          <div className="text-xs text-muted">
            {formatNumber(filtered.length)} of {formatNumber(rows.length)} rows
          </div>

          {/* The 3-way table — scrolls inside its own container on mobile */}
          <div className="m-card !p-0 overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-left text-muted border-b border-[var(--color-card-border)]">
                  <th className="px-3 py-2.5 font-semibold">Store</th>
                  <th className="px-3 py-2.5 font-semibold">SKU</th>
                  <th className="px-3 py-2.5 font-semibold text-right">SOD</th>
                  <th className="px-3 py-2.5 font-semibold text-right">lcbo.com</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Rep saw</th>
                  <th className="px-3 py-2.5 font-semibold">Flag</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <ReconcileTr key={`${r.sku}-${r.store_number}`} row={r} />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center text-muted py-8 text-sm">
                {rows.length === 0
                  ? 'No reconciliation rows yet. Run a live refresh once SOD has synced.'
                  : 'No rows match the current filters.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function skuLabel(sku: string): string {
  return TRACKED_SKUS.find((s) => s.sku === sku)?.brand ?? sku;
}

function ReconcileTr({ row }: { row: ReconcileRow }) {
  return (
    <tr className="border-b border-[var(--color-card-border)] last:border-0">
      <td className="px-3 py-2.5 align-top">
        <Link
          href={`/stores/${row.store_number}`}
          className="font-semibold hover:text-[var(--color-accent)]"
        >
          #{row.store_number}
        </Link>
        {(row.account || row.city) && (
          <div className="text-muted truncate max-w-[160px]">
            {[row.account, row.city].filter(Boolean).join(', ')}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 align-top font-medium">{skuLabel(row.sku)}</td>
      <td className="px-3 py-2.5 align-top text-right tabular-nums">
        <div className="font-semibold">
          {row.sod_on_hand != null ? formatNumber(row.sod_on_hand) : '—'}
        </div>
        {row.sod_snapshot_date && (
          <div className="text-[10px] text-muted">{row.sod_snapshot_date}</div>
        )}
      </td>
      <td className="px-3 py-2.5 align-top text-right tabular-nums">
        <div className="font-semibold text-[var(--color-accent)]">
          {row.live_qty != null ? formatNumber(row.live_qty) : '—'}
        </div>
        {row.live_checked_at && (
          <div className="text-[10px] text-muted">{relativeTime(row.live_checked_at)}</div>
        )}
      </td>
      <td className="px-3 py-2.5 align-top text-right tabular-nums">
        <div className="font-semibold">
          {row.rep_units != null
            ? formatNumber(row.rep_units)
            : row.rep_on_shelf === true
              ? 'on shelf'
              : row.rep_on_shelf === false
                ? '0'
                : '—'}
        </div>
        {row.rep_observed_at && (
          <div className="text-[10px] text-muted">
            {relativeTime(row.rep_observed_at)}
            {row.rep ? ` · ${row.rep}` : ''}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 align-top">
        <FlagChip flag={row.flag} />
      </td>
    </tr>
  );
}

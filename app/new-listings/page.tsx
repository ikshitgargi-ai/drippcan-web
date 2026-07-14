'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendingUp, Calendar, RefreshCw, Eye, AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';

/**
 * New Listings by Date Range — per-SKU snapshot-diff view.
 *
 * For each tracked SKU: compare two SOD snapshots (start vs end) and find
 * stores that became Listed in the window. Cross-check each one against
 * lcbo.com inventory_history (qty>0 in window) and rep_listing_observations
 * to catch listings SOD might have hidden.
 *
 * Three discovery sources per row:
 *   - SOD: caught by SOD's listing-status diff
 *   - lcbo_only: SOD missed it but lcbo.com saw stock (commission claim)
 *   - rep_only: rep flagged it on shelf, no SOD or lcbo confirmation
 */
export default function NewListingsPage() {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Default to 30-day window
  const [start, setStart] = useState(fmt(new Date(today.getTime() - 30 * 86400 * 1000)));
  const [end, setEnd] = useState(fmt(today));
  const [skuFilter, setSkuFilter] = useState<string>('');
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [strictMode, setStrictMode] = useState(true);  // ON by default — only verified rows
  const [freshLcbo, setFreshLcbo] = useState(false);  // off by default — adds 30-60s when on

  const audit = useQuery({
    queryKey: ['new-listings-by-range', start, end, skuFilter, strictMode, freshLcbo],
    queryFn: () =>
      api.newListingsByRange({
        start,
        end,
        sku: skuFilter || undefined,
        include_lcbo: true,
        strict_mode: strictMode,
        fresh_lcbo: freshLcbo,
      }),
    refetchInterval: 5 * 60_000, // every 5 min
  });

  const coverage = useQuery({
    queryKey: ['sod-history-coverage'],
    queryFn: () => api.sodHistoryCoverage(),
    staleTime: 5 * 60_000,
  });

  const tracked = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  // Quick-window presets
  const presets = useMemo(
    () => [
      { label: '10d', days: 10 },
      { label: '20d', days: 20 },
      { label: '30d', days: 30 },
      { label: '60d', days: 60 },
      { label: '90d', days: 90 },
      { label: 'YTD', days: Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function applyPreset(days: number) {
    setStart(fmt(new Date(today.getTime() - days * 86400 * 1000)));
    setEnd(fmt(today));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <TrendingUp size={24} className="text-[var(--color-accent)]" />
          New Listings by Date Range
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Per-SKU snapshot diff between any two dates. Cross-checks SOD + lcbo.com
          + rep observations so listings hidden from SOD still get caught.
        </p>
      </header>

      {/* SOD history coverage banner — tells operator how far back they can
          compare without uploading a historical ZIP. */}
      {coverage.data?.overall_earliest && (
        <div className="m-card flex items-start gap-3 border-[rgba(120,200,140,0.3)] bg-[rgba(120,200,140,0.04)]">
          <Calendar size={16} className="text-[var(--color-success)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-semibold text-[var(--color-foreground)]">
              SOD history coverage:{' '}
              <span className="font-mono">{coverage.data.overall_earliest}</span> →{' '}
              <span className="font-mono">{coverage.data.overall_latest}</span>{' '}
              ({coverage.data.overall_days} days)
            </div>
            <div className="text-muted mt-0.5">
              Diffs INSIDE this range work without any upload. For windows that
              start before <strong>{coverage.data.overall_earliest}</strong>, upload a
              historical SOD ZIP via{' '}
              <Link href="/sod-compare" className="text-[var(--color-accent)] underline">
                /sod-compare
              </Link>{' '}
              first.
            </div>
          </div>
        </div>
      )}

      {/* Window controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Window</CardTitle>
          <CardDescription>
            Compares the SOD snapshot at-or-before each date. Window:{' '}
            {audit.data?.window.days} days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 rounded text-xs border border-[var(--color-card-border)] hover:bg-[var(--color-accent)] hover:text-[#2a1f0f] transition-colors"
              >
                Last {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="select"
                max={end}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="select"
                min={start}
                max={fmt(today)}
              />
            </Field>
            <Field label="SKU filter">
              <select
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                className="select"
              >
                <option value="">All tracked SKUs</option>
                {trackedList.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.brand} — {p.product_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(e) => setStrictMode(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">Strict mode</span>{' '}
                <span className="text-muted">(recommended)</span>
                <div className="text-[10px] text-muted mt-0.5">
                  Only count stores that have a verified NEW_LISTING/RELISTED
                  event in the change log OR independent confirmation from
                  lcbo.com / a rep. Filters out stores that appear in the
                  snapshot diff but are likely just day-1 baseline gaps
                  (already listed before our SOD ingest started).
                </div>
              </div>
            </label>
            {audit.data && (audit.data.summary.total_unconfirmed ?? 0) > 0 && (
              <div className="mt-2 text-xs text-[var(--color-warning)]">
                ⚠ With strict mode OFF, you&apos;d see{' '}
                <strong>{audit.data.summary.total_unconfirmed}</strong>{' '}
                additional rows the change log doesn&apos;t back up.
              </div>
            )}
          </div>
          {/* Fresh-lcbo toggle — kicks off live scrape before diff */}
          <div className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={freshLcbo}
                onChange={(e) => setFreshLcbo(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">Live lcbo.com cross-check</span>{' '}
                <span className="text-[var(--color-warning)]">(adds 30-60 sec)</span>
                <div className="text-[10px] text-muted mt-0.5">
                  Run a fresh lcbo.com inventory scrape for all 8 tracked SKUs
                  BEFORE the diff. Cross-check uses live-as-of-now data instead
                  of the most recent 30-min cron&apos;s snapshot. Slower but
                  produces the strongest possible verification when you&apos;re
                  filing commission claims.
                </div>
              </div>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => audit.refetch()}
              disabled={audit.isFetching}
            >
              <RefreshCw size={14} className={audit.isFetching ? 'animate-spin' : ''} />
              {audit.isFetching ? 'Computing…' : 'Re-run'}
            </Button>
            <a
              href={
                (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') +
                `/api/admin/new-listings-by-range?format=csv` +
                `&start=${start}&end=${end}` +
                (skuFilter ? `&sku=${skuFilter}` : '') +
                `&strict_mode=${strictMode ? '1' : '0'}` +
                (freshLcbo ? '&fresh_lcbo=1' : '')
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
              title="Each row carries verification evidence — confirmed_new, has_change_event, last_listed_before_window, evidence text"
            >
              <Download size={14} /> Download CSV
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="New listings (union)"
          value={formatNumber(audit.data?.summary.total_new_listings ?? 0)}
          highlight="success"
          help="Total stores added across all SKUs. Counts every source."
        />
        <StatCard
          label="lcbo.com confirmed"
          value={formatNumber(audit.data?.summary.lcbo_confirmed_new ?? 0)}
          help="New listings where lcbo.com saw qty>0 in window — triple-verified"
        />
        <StatCard
          label="Listings lost"
          value={formatNumber(audit.data?.summary.total_lost_listings ?? 0)}
          highlight={audit.data?.summary.total_lost_listings ? 'warning' : undefined}
        />
        <StatCard
          label="Net change"
          value={formatNumber(audit.data?.summary.net_change ?? 0)}
          highlight={(audit.data?.summary.net_change ?? 0) >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Per-SKU table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-SKU breakdown</CardTitle>
          <CardDescription>
            Click a row to see the actual stores added.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-full text-xs">
            <thead>
              <tr>
                <th></th>
                <th>SKU</th>
                <th>Product</th>
                <th>Listed @ start</th>
                <th>Listed @ end</th>
                <th>SOD new</th>
                <th>lcbo-only new</th>
                <th>Rep-only new</th>
                <th>Total new</th>
                <th>Lost</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.per_sku.map((r) => {
                const isOpen = expandedSku === r.sku;
                return (
                  <>
                    <tr
                      key={r.sku}
                      onClick={() => setExpandedSku(isOpen ? null : r.sku)}
                      className="cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <td className="w-6">
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </td>
                      <td className="font-mono">{r.sku}</td>
                      <td>
                        <span className="text-muted">{r.brand}</span> {r.product_name}
                      </td>
                      <td className="tabular-nums">{r.start_listed_count}</td>
                      <td className="tabular-nums">{r.end_listed_count}</td>
                      <td className="tabular-nums">{r.sod_new_count}</td>
                      <td
                        className="tabular-nums font-semibold"
                        style={{ color: r.lcbo_only_new_count > 0 ? 'var(--color-danger)' : undefined }}
                      >
                        {r.lcbo_only_new_count}
                      </td>
                      <td className="tabular-nums">{r.rep_only_new_count}</td>
                      <td
                        className="tabular-nums font-semibold"
                        style={{ color: r.union_new_count > 0 ? 'var(--color-success)' : undefined }}
                      >
                        {r.union_new_count}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{ color: r.sod_lost_count > 0 ? 'var(--color-warning)' : undefined }}
                      >
                        {r.sod_lost_count}
                      </td>
                      <td
                        className="tabular-nums font-bold"
                        style={{
                          color:
                            r.net_change > 0
                              ? 'var(--color-success)'
                              : r.net_change < 0
                                ? 'var(--color-danger)'
                                : undefined,
                        }}
                      >
                        {r.net_change > 0 ? `+${r.net_change}` : r.net_change}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.sku}-detail`} className="bg-[rgba(0,0,0,0.15)]">
                        <td colSpan={11} className="p-3">
                          <div className="text-[10px] text-muted mb-2">
                            Snapshots compared: {r.start_snapshot_date ?? '—'} →{' '}
                            {r.end_snapshot_date ?? '—'}
                          </div>
                          {r.start_was_clipped && (
                            <div className="m-card mb-3 border-[rgba(253,203,110,0.4)] bg-[rgba(253,203,110,0.06)] flex items-start gap-2">
                              <AlertTriangle size={14} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                              <div className="text-xs">
                                <div className="font-semibold mb-1">
                                  Cannot compute diff for this SKU
                                </div>
                                <div className="text-muted">
                                  {r.message ??
                                    `Our SOD ingest started on ${r.earliest_available_snapshot ?? 'unknown date'} — the requested start predates our history.`}
                                </div>
                                <Link
                                  href="/sod-compare"
                                  className="text-[var(--color-accent)] underline text-xs mt-2 inline-block"
                                >
                                  → Upload a historical SOD ZIP via /sod-compare
                                </Link>
                              </div>
                            </div>
                          )}
                          {r.new_stores.length === 0 ? (
                            <div className="text-xs text-muted py-2">
                              No new stores in this window.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold flex items-center gap-2">
                                <span>New stores ({r.new_stores.length})</span>
                                {r.confirmed_new_count != null && r.unconfirmed_count != null && (
                                  <span className="font-normal text-muted normal-case tracking-normal">
                                    · {r.confirmed_new_count} confirmed
                                    {r.unconfirmed_count > 0 && (
                                      <span className="text-[var(--color-warning)]">
                                        {' '}+ {r.unconfirmed_count} unconfirmed
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {r.new_stores.map((s) => (
                                  <Link
                                    key={`${s.store_number}-${s.discovered_via}`}
                                    href={`/stores/${s.store_number}`}
                                    className={`text-xs font-mono px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-[var(--color-accent)] hover:text-[#2a1f0f] ${
                                      !s.confirmed_new
                                        ? 'bg-[rgba(255,255,255,0.03)] text-muted line-through opacity-60'
                                        : s.discovered_via === 'lcbo_only'
                                          ? 'bg-[rgba(239,75,75,0.12)] text-[var(--color-danger)]'
                                          : s.discovered_via === 'rep_only'
                                            ? 'bg-[rgba(120,200,140,0.12)] text-[var(--color-success)]'
                                            : s.has_change_event
                                              ? 'bg-[rgba(120,200,140,0.10)] text-[var(--color-success)]'
                                              : 'bg-[rgba(255,255,255,0.05)]'
                                    }`}
                                    title={s.evidence ?? `Discovered via: ${s.discovered_via}`}
                                  >
                                    #{s.store_number}
                                    {s.has_change_event && <span title="NEW_LISTING event recorded">●</span>}
                                    {s.lcbo_confirmed && <span title="lcbo.com confirmed">✓</span>}
                                    {s.rep_confirmed && <Eye size={10} />}
                                    {!s.confirmed_new && <span title="No transition event — likely baseline gap">⚠</span>}
                                  </Link>
                                ))}
                              </div>
                              {r.lost_stores.length > 0 && (
                                <>
                                  <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mt-3">
                                    Lost stores ({r.lost_stores.length})
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {r.lost_stores.map((sn) => (
                                      <Link
                                        key={sn}
                                        href={`/stores/${sn}`}
                                        className="text-xs font-mono px-2 py-1 rounded bg-[rgba(253,203,110,0.12)] text-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-[#2a1f0f]"
                                      >
                                        #{sn}
                                      </Link>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          {audit.isLoading && (
            <div className="py-8 text-center text-muted text-sm">
              Computing snapshot diff…
            </div>
          )}
        </CardContent>
      </Card>

      {/* How-to-read */}
      {audit.data?.how_to_read && (
        <div className="m-card flex items-start gap-3 border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
          <AlertTriangle size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="text-xs text-muted">{audit.data.how_to_read}</div>
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-muted flex flex-wrap gap-3">
        <span>
          <span className="inline-block w-3 h-3 rounded bg-[rgba(120,200,140,0.10)] align-middle mr-1" />
          ● Confirmed new — change event recorded
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded bg-[rgba(239,75,75,0.12)] align-middle mr-1" />
          lcbo.com only (commission claim)
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded bg-[rgba(120,200,140,0.12)] align-middle mr-1" />
          Rep observation only
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded bg-[rgba(255,255,255,0.05)] align-middle mr-1" />
          ⚠ Unconfirmed — likely baseline gap (hover for evidence)
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  help,
}: {
  label: string;
  value: string;
  highlight?: 'success' | 'danger' | 'warning';
  help?: string;
}) {
  const color =
    highlight === 'success'
      ? 'var(--color-success)'
      : highlight === 'danger'
        ? 'var(--color-danger)'
        : highlight === 'warning'
          ? 'var(--color-warning)'
          : 'var(--color-foreground)';
  return (
    <div className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]" title={help}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      {help && <div className="text-[10px] text-muted mt-1">{help}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}

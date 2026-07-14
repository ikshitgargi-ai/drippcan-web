'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Crown,
  AlertTriangle,
  TrendingUp,
  Download,
  Filter,
} from 'lucide-react';
import { api } from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { OwnerGate } from '@/components/owner-gate';
import { Top100Board } from '@/components/top100-board';
import { SkuTrendChart } from '@/components/sku-trend-chart';
import { TierChip, AttributionChip } from '@/components/dripp-bits';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, formatDate, statusBadgeClass, statusLabel } from '@/lib/utils';

const OWNER = { owner: true } as const;
const DAY_PRESETS = [7, 14, 30, 60] as const;

/**
 * OWNER DASHBOARD — the brand's limited view. Every fetch on this page sends
 * X-View: owner so the BACKEND strips rep identity (all reps appear as
 * "Rep") and internal notes before the JSON leaves the server. This page is
 * a window, not the lock: the anonymization is server-side.
 *
 * Owner sees: SKU totals + trend, OOS risk, new listings (X-day picker),
 * the top-100 board (their two writable actions), the conversion funnel,
 * and anonymized downloads.
 */
export default function OwnerPage() {
  return (
    <div className="space-y-4 pb-24">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Crown size={24} className="text-[var(--color-accent)]" />
          Owner Dashboard
        </h1>
        <p className="text-sm text-muted">
          Dripp Cann Spirits — Phoenix &amp; Dayaa at LCBO.
        </p>
      </header>
      <OwnerGate>
        <OwnerDashboard />
      </OwnerGate>
    </div>
  );
}

function OwnerDashboard() {
  return (
    <div className="space-y-6">
      <SkuTotals />
      <TrendSection />
      <OosSection />
      <NewListingsSection />
      <ConversionSection />
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Top-100 priority board</h2>
        <p className="text-xs text-muted">
          Reorder priority with the arrows and set the status per store as
          listings and orders land. These two actions are yours, and every
          change is recorded.
        </p>
        <Top100Board owner />
      </section>
      <DownloadsSection />
    </div>
  );
}

/* ===== SKU totals — store count + on-hand per SKU ===== */
function SkuTotals() {
  const dash = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.crmDashboard(OWNER),
    retry: 1,
  });

  const rollup = dash.data?.tracked_sku_rollup ?? [];

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Your SKUs</h2>
      {!dash.data && !dash.isError && <div className="skeleton h-24" />}
      {dash.isError && (
        <div className="m-card text-center text-muted py-6 text-sm">
          Totals are not reachable right now. Try again in a minute (the
          free-tier server may be waking up).
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rollup.map((r) => (
          <div key={r.sku} className="m-card">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{r.product_name}</div>
                <div className="text-xs text-muted">
                  {r.brand} · <span className="font-mono">{r.sku}</span>
                </div>
              </div>
              {r.current_status && (
                <span className={statusBadgeClass(r.current_status)}>
                  {statusLabel(r.current_status)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] px-3 py-2">
                <div className="text-xl font-bold tabular-nums text-[var(--color-accent)]">
                  {formatNumber(r.store_count)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">stores</div>
              </div>
              <div className="rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] px-3 py-2">
                <div className="text-xl font-bold tabular-nums">
                  {formatNumber(r.total_on_hand)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  bottles on hand
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {dash.data?.latest_snapshot && (
        <div className="text-[11px] text-muted">
          LCBO inventory snapshot: {formatDate(dash.data.latest_snapshot)}
        </div>
      )}
    </section>
  );
}

/* ===== Trend — listed-store history per SKU ===== */
function TrendSection() {
  const [sku, setSku] = useState<string>(TRACKED_SKUS[0].sku);
  const trend = useQuery({
    queryKey: ['owner-sku-trend', sku],
    queryFn: () => api.skuTrend(sku, 90, OWNER),
    retry: 1,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} className="text-[var(--color-accent)]" />
              Store-count trend
            </CardTitle>
            <CardDescription>Listed stores over the last 90 days.</CardDescription>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {TRACKED_SKUS.map((s) => (
              <button
                key={s.sku}
                onClick={() => setSku(s.sku)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  sku === s.sku
                    ? 'bg-[var(--color-accent)] text-[#2a1f0f] border-[var(--color-accent)]'
                    : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
                }`}
              >
                {s.brand}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trend.isError ? (
          <div className="text-center text-muted py-8 text-sm">
            Trend unavailable right now. Try again in a minute.
          </div>
        ) : (
          <SkuTrendChart trend={trend.data} />
        )}
      </CardContent>
    </Card>
  );
}

/* ===== OOS risk — stores about to run dry ===== */
function OosSection() {
  const oos = useQuery({
    queryKey: ['owner-oos'],
    queryFn: () => api.oosRisk({}, OWNER),
    retry: 1,
  });

  const rows = oos.data ?? [];

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <AlertTriangle size={18} className="text-[var(--color-warning)]" />
        Out-of-stock risk
      </h2>
      {!oos.data && !oos.isError && <div className="skeleton h-16" />}
      {oos.isError && (
        <div className="m-card dense text-center text-muted text-xs py-4">
          OOS list unavailable right now.
        </div>
      )}
      {oos.data && rows.length === 0 && (
        <div className="m-card dense text-center text-muted text-xs py-4">
          No stores at OOS risk right now.
        </div>
      )}
      {rows.slice(0, 25).map((r) => (
        <div key={`${r.sku}-${r.store_number}`} className="m-card dense">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="font-semibold">#{r.store_number}</span>
              {(r.account || r.city) && (
                <span className="text-xs text-muted ml-1.5">
                  {[r.account, r.city].filter(Boolean).join(', ')}
                </span>
              )}
              <div className="text-xs text-muted">{r.product_name}</div>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`font-bold tabular-nums ${
                  r.severity === 'critical'
                    ? 'text-[var(--color-danger)]'
                    : 'text-[var(--color-warning)]'
                }`}
              >
                {formatNumber(r.on_hand)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted">on hand</div>
            </div>
          </div>
        </div>
      ))}
      {rows.length > 25 && (
        <div className="text-[11px] text-muted">
          Showing 25 of {formatNumber(rows.length)}. The full list is in the downloads below.
        </div>
      )}
    </section>
  );
}

/* ===== New listings with X-day picker ===== */
function NewListingsSection() {
  const [days, setDays] = useState<number>(14);
  const changes = useQuery({
    queryKey: ['owner-changes', days],
    queryFn: () => api.changes(days, undefined, OWNER),
    retry: 1,
  });

  // The backend sends one flat list tagged with `kind` — group it here.
  const allRows = changes.data?.rows ?? [];
  const newListings = allRows.filter((r) => r.kind === 'new_listing');
  const delistings = allRows.filter((r) => r.kind === 'delisting');

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Filter size={18} className="text-[var(--color-success)]" />
          New listings
        </h2>
        <div className="flex gap-1.5">
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
        </div>
      </div>
      {!changes.data && !changes.isError && <div className="skeleton h-16" />}
      {changes.isError && (
        <div className="m-card dense text-center text-muted text-xs py-4">
          Listings feed unavailable right now.
        </div>
      )}
      {changes.data && (
        <>
          <div className="text-xs text-muted">
            {formatNumber(newListings.length)} new listings and{' '}
            {formatNumber(delistings.length)} delistings in the last {days} days.
          </div>
          {newListings.length === 0 && (
            <div className="m-card dense text-center text-muted text-xs py-4">
              No new listings in this window yet.
            </div>
          )}
          {newListings.map((r, i) => (
            <div
              key={`${r.sku}-${r.store_number}-${r.source}-${i}`}
              className="m-card dense flex items-center justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold">#{r.store_number}</span>
                  <span className="text-sm">
                    {r.brand || (TRACKED_SKUS.find((s) => s.sku === r.sku)?.brand ?? r.sku)}
                  </span>
                  <TierChip tier={r.tier} />
                  <AttributionChip tag={r.attribution ?? null} />
                </div>
                {r.product_name && (
                  <div className="text-xs text-muted truncate">{r.product_name}</div>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted tabular-nums">
                {formatDate(r.date)}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

/* ===== Conversion — touchpoints vs listings since launch ===== */
function ConversionSection() {
  const [days, setDays] = useState<number>(30);
  const conversion = useQuery({
    queryKey: ['owner-conversion', days],
    queryFn: () => api.conversion(days, OWNER),
    retry: 1,
  });

  const c = conversion.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Field conversion</CardTitle>
            <CardDescription>
              How many new listings followed a field visit
              {c?.launch_date ? ` (since launch ${formatDate(c.launch_date)})` : ''}.
            </CardDescription>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {DAY_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  days === d
                    ? 'bg-[var(--color-accent)] text-[#2a1f0f] border-[var(--color-accent)]'
                    : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!conversion.data && !conversion.isError && <div className="skeleton h-16" />}
        {conversion.isError && (
          <div className="text-center text-muted py-4 text-xs">
            Conversion stats unavailable right now.
          </div>
        )}
        {c && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Store visits" value={c.touchpoints} />
              <Stat label="Stores visited" value={c.stores_touched} />
              <Stat label="New listings" value={c.new_listings} />
              {/* conversion_rate is already a percentage (0-100) on the backend */}
              <Stat
                label="Conversion"
                value={c.conversion_rate != null ? `${Math.round(c.conversion_rate)}%` : '—'}
              />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgba(18,194,140,0.6)]" />
                Rep converted{' '}
                <span className="font-semibold tabular-nums">{formatNumber(c.rep_converted)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgba(255,255,255,0.25)]" />
                Organic{' '}
                <span className="font-semibold tabular-nums">{formatNumber(c.organic)}</span>
              </span>
            </div>
            {c.per_store.length > 0 && (
              <div className="space-y-1.5">
                {c.per_store.slice(0, 15).map((row, i) => (
                  <div
                    key={`${row.store_number}-${row.sku}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs p-2 rounded bg-[var(--color-background)] border border-[var(--color-card-border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">#{row.store_number}</span>
                      {(row.account || row.city) && (
                        <span className="text-muted ml-1.5 truncate">
                          {[row.account, row.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {/* touch_description is already owner-sanitized server-side */}
                      {row.touch_description && (
                        <div className="text-muted">{row.touch_description}</div>
                      )}
                    </div>
                    <AttributionChip tag={row.attribution} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] px-3 py-2">
      <div className="text-lg font-bold tabular-nums">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

/* ===== Downloads — anonymized xlsx exports =====
 * Only the four owner-allowlisted exports appear here. Field visits
 * (visits.xlsx) is INTERNAL: it reads the activities table directly, so the
 * server cannot anonymize it — the backend's fail-closed allowlist 403s it
 * in owner view on purpose. Do not add it back. */
function DownloadsSection() {
  const links = [
    { label: 'Top-100 board', href: api.exportTop100XlsxUrl(OWNER) },
    { label: 'Territory book', href: api.exportTerritoryXlsxUrl(OWNER) },
    { label: 'Changes (30 days)', href: api.exportChangesXlsxUrl(30, OWNER) },
    { label: 'Inventory reconcile', href: api.exportReconcileXlsxUrl(OWNER) },
  ];
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Downloads</h2>
      <p className="text-xs text-muted">
        Excel exports of everything above. Rep identities are anonymized.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="m-card dense flex items-center justify-between gap-2 hover:border-[var(--color-accent)]"
          >
            <span className="text-sm font-medium">{l.label}</span>
            <Download size={15} className="text-[var(--color-accent)] shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}

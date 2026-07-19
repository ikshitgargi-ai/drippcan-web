'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Download,
  Search,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  api,
  type ViewOpts,
  type ListingRow,
  type ListingAddedRow,
  type SourceHealthRow,
  type ListingSource,
} from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { useOwnerMode } from '@/lib/owner-mode';
import { AttributionChip } from '@/components/dripp-bits';
import { formatNumber, formatDate } from '@/lib/utils';

/**
 * LISTINGS — the canonical listing ledger.
 *
 * This reads the immutable, source-independent listing_ledger (folded into
 * store_listings) on the backend, NOT the live SOD file. It is the answer to
 * "what is listed / what was added over X days" that survives a total SOD loss.
 *
 * Two tabs:
 *   • Current — every store×SKU with status, first-listed date and which
 *     sources ever confirmed it (SOD / live / rep / manual).
 *   • Added   — every LISTED event in a 7/30/60/90-day window, newest first,
 *     with attribution (rep-converted vs organic).
 *
 * A source-health strip up top is the early warning that a feed has gone
 * quiet. Owner sessions get the same table read-only (allowlisted, sanitized
 * server-side); the internal source-health strip is hidden for them.
 *
 * The backend ledger endpoints may not be deployed yet — every section
 * degrades to a calm empty state rather than erroring.
 */

const DAY_PRESETS = [7, 30, 60, 90] as const;
type Tab = 'current' | 'added';
type StatusFilter = 'all' | 'listed' | 'delisted';

export default function ListingsPage() {
  const [tab, setTab] = useState<Tab>('current');
  const ownerMode = useOwnerMode();
  const viewOpts: ViewOpts | undefined = ownerMode ? { owner: true } : undefined;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <ClipboardList size={24} className="text-[var(--color-accent)]" />
            Listings
          </h1>
          <p className="text-sm text-muted">
            The canonical listing ledger — every listing we have ever confirmed, from
            any source. Rebuilt from an immutable event log, so it holds even if SOD
            is lost.
          </p>
        </div>
        <a
          href={api.exportListingsXlsxUrl(viewOpts)}
          className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[var(--color-hover)]"
        >
          <Download size={14} />
          .xlsx
        </a>
      </header>

      {/* Source-health strip — internal early-warning; hidden in owner mode. */}
      {!ownerMode && <SourceHealthStrip />}

      {/* Tab switch */}
      <div className="flex items-center gap-2">
        <TabButton active={tab === 'current'} onClick={() => setTab('current')}>
          Current listings
        </TabButton>
        <TabButton active={tab === 'added'} onClick={() => setTab('added')}>
          Added
        </TabButton>
      </div>

      {tab === 'current' ? (
        <CurrentTab viewOpts={viewOpts} ownerMode={ownerMode} />
      ) : (
        <AddedTab viewOpts={viewOpts} ownerMode={ownerMode} />
      )}
    </div>
  );
}

/* ===================== Source health strip ===================== */

function SourceHealthStrip() {
  const health = useQuery({
    queryKey: ['listings-source-health'],
    queryFn: () => api.listingsSourceHealth(),
    retry: 1,
    refetchInterval: 120_000,
  });

  // Endpoint not deployed yet, or backend asleep — stay quiet, don't alarm.
  if (health.isError) return null;
  if (!health.data) {
    return <div className="skeleton h-14" />;
  }

  const sources = health.data.sources ?? [];
  if (sources.length === 0) return null;

  const anyStale = sources.some(isSourceStale);

  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted font-semibold">
        <ShieldCheck size={13} className="text-[var(--color-accent)]" />
        Source health
        {anyStale && (
          <span className="normal-case tracking-normal text-[var(--color-warning)] font-medium">
            · a feed has gone quiet
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sources.map((s) => (
          <SourceHealthCard key={s.source} row={s} />
        ))}
      </div>
    </section>
  );
}

function SourceHealthCard({ row }: { row: SourceHealthRow }) {
  const stale = isSourceStale(row);
  const ds = row.days_since ?? daysSinceDate(row.last_observed_date);
  const meta = sourceMeta(row.source);
  return (
    <div className="m-card dense">
      <div className="flex items-center justify-between gap-1.5">
        <SourceBadge source={row.source} />
        {stale ? (
          <AlertTriangle size={14} className="text-[var(--color-warning)]" />
        ) : (
          <CheckCircle2 size={14} className="text-[var(--color-success)]" />
        )}
      </div>
      <div className="mt-1.5 text-xs" style={{ color: stale ? 'var(--color-warning)' : undefined }}>
        {row.last_observed_date ? (
          <>
            last seen {formatDate(row.last_observed_date)}
            {ds != null && (
              <span className="text-muted"> · {ds === 0 ? 'today' : `${ds}d ago`}</span>
            )}
          </>
        ) : (
          <span className="text-muted">never seen</span>
        )}
      </div>
      <div className="text-[11px] text-muted">
        {formatNumber(row.rows_last_7d)} {meta.unit} in 7d
      </div>
    </div>
  );
}

/* ===================== Current listings tab ===================== */

function CurrentTab({
  viewOpts,
  ownerMode,
}: {
  viewOpts: ViewOpts | undefined;
  ownerMode: boolean;
}) {
  const [sku, setSku] = useState<string>('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');

  const listings = useQuery({
    queryKey: ['listings', ownerMode],
    queryFn: () => api.listings(viewOpts),
    retry: 1,
  });

  const data = listings.data;
  const allRows = data?.rows ?? [];

  const listedCount =
    data?.summary?.listed ?? allRows.filter((r) => isListed(r.status)).length;
  const delistedCount =
    data?.summary?.delisted ?? allRows.filter((r) => !isListed(r.status)).length;

  const bySku = Array.isArray(data?.summary?.by_sku) ? data!.summary.by_sku : [];
  const bySource =
    data?.summary?.by_source && typeof data.summary.by_source === 'object'
      ? Object.entries(data.summary.by_source)
      : [];

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (sku && r.sku !== sku) return false;
      if (status === 'listed' && !isListed(r.status)) return false;
      if (status === 'delisted' && isListed(r.status)) return false;
      if (needle) {
        const hay = `${r.store_number} ${r.account ?? ''} ${r.city ?? ''} ${
          r.product_name ?? ''
        } ${r.brand ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [allRows, sku, status, q]);

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="Listed" value={listedCount} tone="success" loading={!data} />
        <SummaryTile label="Delisted" value={delistedCount} tone="danger" loading={!data} />
        <SummaryTile
          label="Latest add"
          text={data?.summary?.latest_add ? formatDate(data.summary.latest_add) : '—'}
          tone="accent"
          loading={!data}
        />
      </div>

      {/* by-source / by-sku mini breakdowns */}
      {(bySource.length > 0 || bySku.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {bySource.map(([src, n]) => (
            <span key={src} className="flex items-center gap-1.5">
              <SourceBadge source={src} />
              <span className="tabular-nums font-semibold">{formatNumber(n as number)}</span>
            </span>
          ))}
          {bySku.map((s) => (
            <span key={s.sku} className="text-muted">
              {s.brand ?? skuLabel(s.sku)}{' '}
              <span className="tabular-nums font-semibold text-[var(--color-foreground)]">
                {formatNumber(s.listed)}
              </span>{' '}
              listed
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5">
          <FilterPill active={status === 'all'} onClick={() => setStatus('all')}>
            All
          </FilterPill>
          <FilterPill active={status === 'listed'} onClick={() => setStatus('listed')}>
            Listed
          </FilterPill>
          <FilterPill active={status === 'delisted'} onClick={() => setStatus('delisted')}>
            Delisted
          </FilterPill>
        </div>
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="select !min-h-0 h-9 text-xs"
          aria-label="Filter by SKU"
        >
          <option value="">Both SKUs</option>
          {TRACKED_SKUS.map((s) => (
            <option key={s.sku} value={s.sku}>
              {s.brand}
            </option>
          ))}
        </select>
        <label className="relative flex-1 min-w-[140px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Store #, account, city…"
            className="select !min-h-0 h-9 text-xs w-full pl-8"
            aria-label="Search listings"
          />
        </label>
      </div>

      {/* States */}
      {listings.isError && (
        <div className="m-card text-center text-muted py-8 text-sm">
          The listing ledger is not reachable yet. If the backend just woke up
          (free tier) try again in a minute; if the ledger endpoints have not
          shipped, they will appear here automatically once deployed.
        </div>
      )}
      {!data &&
        !listings.isError &&
        Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14" />)}

      {data && rows.length === 0 && (
        <div className="m-card text-center text-muted py-8 text-sm">
          No listings match this filter.
        </div>
      )}

      {/* Canonical table (collapses to cards <640px) */}
      {data && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table table-to-cards">
            <thead>
              <tr>
                <th>Store</th>
                <th>Product</th>
                <th>Status</th>
                <th>First listed</th>
                <th>Last confirmed</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.sku}-${r.store_number}`}>
                  <td data-label="Store">
                    <Link
                      href={`/stores/${r.store_number}`}
                      className="font-semibold hover:text-[var(--color-accent)]"
                    >
                      #{r.store_number}
                    </Link>
                    {(r.account || r.city) && (
                      <span className="block text-xs text-muted truncate max-w-[220px]">
                        {[r.account, r.city].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </td>
                  <td data-label="Product">
                    <span className="font-medium">{r.brand || skuLabel(r.sku)}</span>
                    {r.product_name && (
                      <span className="block text-xs text-muted truncate max-w-[220px]">
                        {r.product_name}
                      </span>
                    )}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={r.status} />
                  </td>
                  <td data-label="First listed" className="tabular-nums">
                    {formatDate(r.first_listed_date)}
                  </td>
                  <td data-label="Last confirmed" className="tabular-nums">
                    {formatDate(r.last_confirmed_date)}
                    {r.days_since_confirmed != null && (
                      <span className="text-xs text-muted ml-1">
                        ({r.days_since_confirmed === 0 ? 'today' : `${r.days_since_confirmed}d`})
                      </span>
                    )}
                  </td>
                  <td data-label="Sources">
                    <span className="flex flex-wrap gap-1 justify-end sm:justify-start">
                      {splitSources(r.sources_seen).map((src) => (
                        <SourceBadge key={src} source={src} />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>
            {formatNumber(rows.length)}
            {rows.length !== allRows.length ? ` of ${formatNumber(allRows.length)}` : ''} rows
          </span>
          {data.summary?.first_ever && <span>tracking since {formatDate(data.summary.first_ever)}</span>}
        </div>
      )}
    </div>
  );
}

/* ===================== Added tab ===================== */

function AddedTab({
  viewOpts,
  ownerMode,
}: {
  viewOpts: ViewOpts | undefined;
  ownerMode: boolean;
}) {
  const [days, setDays] = useState<number>(30);
  const since = useMemo(() => sinceFromDays(days), [days]);

  const added = useQuery({
    queryKey: ['listings-added', since, ownerMode],
    queryFn: () => api.listingsAdded(since, viewOpts),
    retry: 1,
  });

  const data = added.data;
  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])];
    // Guarantee newest-first even if the backend order drifts.
    list.sort((a, b) => (a.observed_date < b.observed_date ? 1 : -1));
    return list;
  }, [data]);

  const repConverted =
    data?.summary?.rep_converted ??
    rows.filter((r) => r.attribution === 'rep_converted').length;
  const organic =
    data?.summary?.organic ?? rows.filter((r) => r.attribution === 'organic').length;

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {DAY_PRESETS.map((d) => (
          <FilterPill key={d} active={days === d} onClick={() => setDays(d)}>
            Last {d}d
          </FilterPill>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile
          label="Added"
          value={data?.count ?? rows.length}
          tone="success"
          loading={!data}
        />
        <SummaryTile label="Rep converted" value={repConverted} tone="accent" loading={!data} />
        <SummaryTile label="Organic" value={organic} tone="neutral" loading={!data} />
      </div>

      {added.isError && (
        <div className="m-card text-center text-muted py-8 text-sm">
          The added-listings feed is not reachable yet. This reads the ledger, so
          it works even when SOD is down — it will populate here once the backend
          ledger endpoints are live.
        </div>
      )}
      {!data &&
        !added.isError &&
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}

      {data && rows.length === 0 && (
        <div className="m-card text-center text-muted py-8 text-sm">
          No listings added in the last {days} days.
        </div>
      )}

      {data && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <AddedRowCard key={`${r.sku}-${r.store_number}-${r.observed_date}-${r.source}-${i}`} row={r} />
          ))}
        </div>
      )}

      {data?.since && (
        <div className="text-[11px] text-muted">window since {formatDate(data.since)}</div>
      )}
    </div>
  );
}

function AddedRowCard({ row }: { row: ListingAddedRow }) {
  return (
    <Link href={`/stores/${row.store_number}`} className="m-card dense block">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold">#{row.store_number}</span>
            <span className="text-sm">{row.brand || skuLabel(row.sku)}</span>
            <SourceBadge source={row.source} />
            <AttributionChip tag={row.attribution} />
          </div>
          <div className="text-xs text-muted truncate mt-0.5">
            {[row.account, row.city].filter(Boolean).join(', ')}
            {row.product_name ? `${row.account || row.city ? ' · ' : ''}${row.product_name}` : ''}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted tabular-nums">
          {formatDate(row.observed_date)}
        </div>
      </div>
    </Link>
  );
}

/* ===================== Shared bits ===================== */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
        active
          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
          : 'bg-[var(--color-card)] border-[var(--color-card-border)] text-[var(--color-foreground)]'
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-primary-fg)] border-[var(--color-accent)]'
          : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryTile({
  label,
  value,
  text,
  tone,
  loading,
}: {
  label: string;
  value?: number;
  text?: string;
  tone: 'success' | 'danger' | 'accent' | 'neutral';
  loading: boolean;
}) {
  const color =
    tone === 'success'
      ? 'var(--color-success)'
      : tone === 'danger'
        ? 'var(--color-danger)'
        : tone === 'accent'
          ? 'var(--color-accent)'
          : 'var(--color-foreground)';
  return (
    <div className="m-card dense text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {loading ? '…' : text != null ? text : formatNumber(value ?? 0)}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const listed = isListed(status);
  return (
    <span className={`badge ${listed ? 'badge-listed' : 'badge-delisted'}`}>
      {listed ? 'Listed' : 'Delisted'}
    </span>
  );
}

const SOURCE_META: Record<ListingSource, { label: string; bg: string; fg: string; unit: string }> = {
  sod: { label: 'SOD', bg: 'rgba(216,173,88,0.15)', fg: '#e8c98d', unit: 'events' },
  live: { label: 'Live', bg: 'rgba(109,167,255,0.15)', fg: '#6da7ff', unit: 'events' },
  rep: { label: 'Rep', bg: 'rgba(45,212,168,0.15)', fg: '#4be0bb', unit: 'logs' },
  manual: { label: 'Manual', bg: 'rgba(64,142,255,0.15)', fg: '#408eff', unit: 'entries' },
};

function sourceMeta(source: string) {
  const key = String(source).trim().toLowerCase() as ListingSource;
  return SOURCE_META[key] ?? { label: source, bg: 'rgba(255,255,255,0.06)', fg: '#9fa8bb', unit: 'events' };
}

function SourceBadge({ source }: { source: string }) {
  const meta = sourceMeta(source);
  return (
    <span className="change-chip" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

/* ===================== helpers ===================== */

function isListed(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toUpperCase() === 'LISTED';
}

function splitSources(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function skuLabel(sku: string): string {
  return TRACKED_SKUS.find((s) => s.sku === sku)?.brand ?? sku;
}

/** YYYY-MM-DD floor N days before now (UTC) — the `since` for /api/listings/added. */
function sinceFromDays(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function daysSinceDate(d: string | null | undefined): number | null {
  if (!d) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00Z` : d;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / 86400000));
}

/** SOD and the live scrape are daily feeds — quiet > 2 days means possibly lost.
 *  Rep/manual are naturally sparse, so we never flag them stale. */
function isSourceStale(row: SourceHealthRow): boolean {
  if (row.stale != null) return row.stale;
  const feed = row.source === 'sod' || row.source === 'live';
  if (!feed) return false;
  const ds = row.days_since ?? daysSinceDate(row.last_observed_date);
  return ds == null || ds > 2;
}

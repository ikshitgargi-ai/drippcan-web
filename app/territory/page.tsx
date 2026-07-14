'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Search, Download, Compass, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { api, type TerritoryStoreRow } from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TierChip, OwnerStatusChip } from '@/components/dripp-bits';
import { formatNumber, relativeTime, statusBadgeClass, statusLabel } from '@/lib/utils';

const TIERS = ['all', 'routed', 'territory', 'discovered'] as const;

/**
 * TERRITORY — the store book we actually work: 73 routed + wider-GTA
 * territory stores + anything discovered later on lcbo.com. Each row shows
 * the latest SKU presence (from SOD) and the last touchpoint, so a rep can
 * see at a glance where Phoenix & Dayaa stand across the whole book.
 */
export default function TerritoryPage() {
  const [tier, setTier] = useState<(typeof TIERS)[number]>('all');
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');

  // Fetch the whole book once; filter client-side (189 rows — instant on mobile).
  const territory = useQuery({
    queryKey: ['territory-book'],
    queryFn: () => api.territory(),
    retry: 1,
  });

  const rows = useMemo(() => territory.data?.stores ?? [], [territory.data]);

  const cities = useMemo(() => {
    const set = new Map<string, number>();
    for (const r of rows) {
      if (r.city) set.set(r.city, (set.get(r.city) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tier !== 'all' && r.tier !== tier) return false;
      if (city && r.city !== city) return false;
      if (needle) {
        const hay =
          `${r.store_number} ${r.account ?? ''} ${r.address ?? ''} ${r.city ?? ''} ${r.postal ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, tier, city, q]);

  // The backend sends a flat store list — tier counts are derived here.
  const byTier = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    return counts;
  }, [rows]);

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <MapPin size={24} className="text-[var(--color-accent)]" />
            Territory
          </h1>
          <p className="text-sm text-muted">
            The store book: routed stops, wider-GTA territory, and stores
            discovered on lcbo.com. SKU presence + last touch per store.
          </p>
        </div>
        <a
          href={api.exportTerritoryXlsxUrl()}
          className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[#1a1f29]"
        >
          <Download size={14} />
          .xlsx
        </a>
      </header>

      {/* Tier summary + filter chips */}
      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => {
          const count =
            t === 'all' ? territory.data?.count ?? rows.length : byTier[t] ?? 0;
          const sel = tier === t;
          return (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                sel
                  ? 'bg-[var(--color-accent)] text-[#2a1f0f] border-[var(--color-accent)]'
                  : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}{' '}
              <span className="opacity-70 tabular-nums">{formatNumber(count)}</span>
            </button>
          );
        })}
      </div>

      {/* Search + city */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Store #, name, address, postal…"
            className="select w-full !pl-9"
            aria-label="Search territory stores"
          />
        </div>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="select"
          aria-label="Filter by city"
        >
          <option value="">All cities</option>
          {cities.map(([c, n]) => (
            <option key={c} value={c}>
              {c} ({n})
            </option>
          ))}
        </select>
      </div>

      {/* Discovery — GTA stores not yet in the book */}
      <DiscoveryCard />

      {/* Store list — gate on DATA, not isLoading: a paused/offline query
          must show skeletons, never a false "empty book". */}
      {!territory.data &&
        !territory.isError &&
        Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
      {territory.isError && (
        <div className="m-card text-center text-muted py-8 text-sm">
          Territory book is not reachable right now. If the backend just woke
          up (free tier), try again in a minute.
        </div>
      )}
      {territory.data && (
        <>
          <div className="text-xs text-muted">
            {formatNumber(filtered.length)} of {formatNumber(rows.length)} stores
          </div>
          <div className="space-y-2">
            {filtered.map((r) => (
              <TerritoryRow key={r.store_number} row={r} />
            ))}
          </div>
          {filtered.length === 0 && rows.length > 0 && (
            <div className="m-card text-center text-muted py-8 text-sm">
              No stores match the current filters.
            </div>
          )}
          {rows.length === 0 && (
            <div className="m-card text-center text-muted py-8 text-sm">
              The territory book is empty. The 189-store seed has to be
              ingested on the backend first (POST /api/territory/ingest).
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TerritoryRow({ row }: { row: TerritoryStoreRow }) {
  return (
    <Link href={`/stores/${row.store_number}`} className="m-card block">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold">#{row.store_number}</span>
            {row.account && <span className="text-sm truncate">{row.account}</span>}
          </div>
          <div className="text-xs text-muted truncate mt-0.5">
            {[row.address, row.city, row.postal].filter(Boolean).join(', ')}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <TierChip tier={row.tier} />
            {row.class && <span className="change-chip change-BASELINE">{row.class}</span>}
            {row.route_day != null && (
              <span className="change-chip change-STATUS_FLIP">
                Day {row.route_day}
                {row.route_stop != null ? ` · stop ${row.route_stop}` : ''}
              </span>
            )}
            {row.owner_status && row.owner_status !== 'none' && (
              <OwnerStatusChip status={row.owner_status} />
            )}
          </div>
        </div>
        <div className="shrink-0 space-y-1 text-right">
          {TRACKED_SKUS.map((s) => {
            const p = row.sku_presence?.[s.sku];
            return (
              <div key={s.sku} className="flex items-center justify-end gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">{s.brand}</span>
                {p?.status ? (
                  <span className={statusBadgeClass(p.status)}>
                    {statusLabel(p.status)}
                    {p.on_hand != null ? ` · ${formatNumber(p.on_hand)}` : ''}
                  </span>
                ) : (
                  <span className="badge badge-neutral">not listed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {row.last_touchpoint && (
        <div className="text-[11px] text-muted mt-2 pt-2 border-t border-[var(--color-card-border)]">
          Last touch: {row.last_touchpoint.activity_type}
          {row.last_touchpoint.rep ? ` by ${row.last_touchpoint.rep}` : ''}
          {row.last_touchpoint.created_at
            ? ` · ${relativeTime(row.last_touchpoint.created_at)}`
            : ''}
        </div>
      )}
    </Link>
  );
}

/**
 * Discovery: stores in the SOD / lcbo.com universe located in GTA cities but
 * NOT in the territory book yet. One tap adds them as tier='discovered' —
 * this is how future new LCBO stores keep flowing into the book.
 */
function DiscoveryCard() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const discovery = useQuery({
    queryKey: ['territory-discovery'],
    queryFn: () => api.territoryDiscovery(),
    enabled: open,
    retry: 1,
  });

  const add = useMutation({
    mutationFn: (store_number: number) => api.territoryDiscoveryAdd(store_number),
    onSuccess: (_data, store_number) => {
      toast.success(`Store #${store_number} added to the territory book`);
      qc.invalidateQueries({ queryKey: ['territory-book'] });
      qc.invalidateQueries({ queryKey: ['territory-discovery'] });
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const candidates = discovery.data?.candidates ?? [];

  return (
    <Card className="border-[rgba(18,194,140,0.25)]">
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Compass size={16} className="text-[var(--color-success)]" />
              Discovery: new GTA stores
            </CardTitle>
            <CardDescription>
              Stores carrying stock in the GTA that are not in the book yet.
              Tap to {open ? 'hide' : 'scan'}.
            </CardDescription>
          </div>
          {open ? (
            <ChevronUp size={16} className="text-muted shrink-0" />
          ) : (
            <ChevronDown size={16} className="text-muted shrink-0" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          {discovery.isLoading && <div className="skeleton h-16" />}
          {discovery.isError && (
            <div className="text-xs text-muted py-2">
              Discovery scan unavailable right now. Try again in a minute.
            </div>
          )}
          {!discovery.isLoading && !discovery.isError && candidates.length === 0 && (
            <div className="text-xs text-muted py-2">
              No new GTA stores found. The book already covers everything the
              sources see.
            </div>
          )}
          {candidates.map((c) => (
            <div
              key={c.store_number}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-semibold">#{c.store_number}</span>
                  {c.account && <span className="ml-1.5">{c.account}</span>}
                </div>
                <div className="text-xs text-muted truncate">
                  {[c.address, c.city].filter(Boolean).join(', ')}
                  {c.seen_in?.length ? ` · seen via ${c.seen_in.join(' + ')}` : ''}
                  {c.carrying_skus?.length ? ` · already carrying ${c.carrying_skus.length} SKU${c.carrying_skus.length > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              <button
                onClick={() => add.mutate(c.store_number)}
                disabled={add.isPending}
                className="shrink-0 inline-flex items-center gap-1 !min-h-0 h-9 px-3 rounded-lg bg-[var(--color-success)] text-[#06281c] text-xs font-semibold disabled:opacity-50"
              >
                <Plus size={13} />
                Add
              </button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

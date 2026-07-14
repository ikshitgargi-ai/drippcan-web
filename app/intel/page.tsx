'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  X,
  Package,
  Database,
  Activity as ActivityIcon,
  Radar,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, statusBadgeClass, statusLabel } from '@/lib/utils';

type Tab = 'new_stores' | 'new_inventory' | 'lcbo_live' | 'delisted' | 'flips';

const DAYS_OPTIONS = [30, 60, 90, 120] as const;

/**
 * Distribution Intelligence — ONE page that consolidates:
 *   - NEW STORES (stores that added our SKUs)
 *   - NEW INVENTORY (stores where shipment arrived: on_hand 0 → positive)
 *   - DELISTED (NEW_LISTING / DELISTED across all LCBO)
 *   - FLIPS (status changes)
 *
 * + Floating "Mark Listing" button: rep can manually flag a known listing
 *   they heard about before SOD detects it.
 */
export default function IntelPage() {
  const [tab, setTab] = useState<Tab>('new_stores');
  const [days, setDays] = useState<number>(60);
  const [skuFilter, setSkuFilter] = useState('');
  const [logSheet, setLogSheet] = useState(false);
  const qc = useQueryClient();

  const tracked = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  const additions = useQuery({
    queryKey: ['additions', { days, sku: skuFilter }],
    queryFn: () => api.distributionAdditions({ days, sku: skuFilter || undefined }),
    enabled: tab === 'new_stores',
  });
  const invAdds = useQuery({
    queryKey: ['inv-adds', { days, sku: skuFilter }],
    queryFn: () => api.inventoryAdds({ days, sku: skuFilter || undefined }),
    enabled: tab === 'new_inventory',
  });
  const digest = useQuery({
    queryKey: ['digest', days],
    queryFn: () => api.listingDigest(days),
    enabled: tab === 'delisted' || tab === 'flips',
  });
  const lcboLive = useQuery({
    queryKey: ['lcbo-live', days],
    queryFn: () => api.lcboLiveDiscoveries(days),
    enabled: tab === 'lcbo_live',
    refetchInterval: 120_000,
  });
  const rescan = useMutation({
    mutationFn: api.lcboRescan,
    onSuccess: () => {
      toast.success('LCBO.com rescan started — back in ~30s');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['lcbo-live'] }), 30_000);
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const daysAvailable =
    additions.data?.days_of_history_available ?? invAdds.data?.days_of_history_available ?? null;

  return (
    <div className="space-y-4 pb-24">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ActivityIcon size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">
            Distribution Intel
          </span>
        </div>
        <h1>What&apos;s Changing</h1>
        <p className="text-muted text-sm">
          New stores, new inventory, delistings, and status changes — all in one feed.
        </p>
      </header>

      <FreshnessBanner />

      {/* Data-age disclosure */}
      {daysAvailable !== null && daysAvailable < days && (
        <div className="m-card flex items-start gap-3 border-[var(--color-warning)]/50 bg-[rgba(253,203,110,0.04)]">
          <Database size={18} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold mb-0.5">
              Showing best-available history
            </div>
            <div className="text-muted">
              You requested {days} days but we have {daysAvailable} day
              {daysAvailable === 1 ? '' : 's'} of accurate snapshot history. Coverage grows
              daily as we ingest more SOD pulls.
            </div>
          </div>
        </div>
      )}

      {/* Tab strip */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {(
          [
            { key: 'new_stores' as Tab, label: 'New Stores', icon: TrendingUp, color: 'var(--color-success)' },
            { key: 'new_inventory' as Tab, label: 'New Inventory', icon: Package, color: 'var(--color-accent)' },
            { key: 'lcbo_live' as Tab, label: 'LCBO Live', icon: Radar, color: '#a78bfa' },
            { key: 'delisted' as Tab, label: 'Delisted', icon: TrendingDown, color: 'var(--color-danger)' },
            { key: 'flips' as Tab, label: 'Flips', icon: ArrowLeftRight, color: 'var(--color-warning)' },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const sel = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold min-h-11 ${
                sel
                  ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
                  : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
              }`}
            >
              <Icon size={14} style={{ color: sel ? undefined : t.color }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {DAYS_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold min-h-10 ${
              days === d
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            {d}d
          </button>
        ))}
        <select
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
          className="select max-w-[220px] text-xs"
        >
          <option value="">All tracked SKUs</option>
          {trackedList.map((p) => (
            <option key={p.sku} value={p.sku}>
              {p.brand} {p.product_name}
            </option>
          ))}
        </select>
      </div>

      {/* TAB: NEW STORES */}
      {tab === 'new_stores' && (
        <>
          {additions.data?.per_sku && additions.data.per_sku.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {additions.data.per_sku.map((p) => (
                <div key={p.sku} className="m-card">
                  <div className="text-xs text-muted truncate">{p.product_name}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className="text-3xl font-bold tabular-nums"
                      style={{ color: 'var(--color-success)' }}
                    >
                      {p.count}
                    </span>
                    <span className="text-xs text-muted">new</span>
                  </div>
                  <div className="text-[10px] text-muted mt-1">
                    {p.still_listed} still on shelf · {p.lost_again} lost
                  </div>
                </div>
              ))}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{additions.data?.total ?? 0} stores added</CardTitle>
              <CardDescription>
                Tracked SKU went from no-row to status=L at this store.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {additions.isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                {additions.data?.additions.length === 0 && !additions.isLoading && (
                  <div className="text-center py-12 text-muted text-sm">
                    No new store additions detected in the selected window.
                  </div>
                )}
                {additions.data?.additions.map((a, i) => (
                  <Link
                    key={i}
                    href={`/stores/${a.store_number}`}
                    className="block m-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="change-chip change-NEW_LISTING">NEW STORE</span>
                          {a.current_status && (
                            <span className={statusBadgeClass(a.current_status)}>
                              now {statusLabel(a.current_status)}
                            </span>
                          )}
                          <span
                            className="change-chip"
                            style={{
                              background: a.territory_color + '33',
                              color: a.territory_color,
                            }}
                          >
                            {a.territory_name}
                          </span>
                        </div>
                        <div className="font-semibold text-base">
                          #{a.store_number} · {a.account ?? '—'}
                        </div>
                        <div className="text-xs text-muted">
                          {a.brand} {a.product_name} · {a.city}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted">{formatDate(a.change_date)}</div>
                        <div className="text-lg font-bold tabular-nums mt-1">
                          {a.current_on_hand}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* TAB: NEW INVENTORY */}
      {tab === 'new_inventory' && (
        <>
          {invAdds.data?.per_sku && invAdds.data.per_sku.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {invAdds.data.per_sku.map((p) => (
                <div key={p.sku} className="m-card">
                  <div className="text-xs text-muted truncate">{p.product_name}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className="text-3xl font-bold tabular-nums"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {p.event_count}
                    </span>
                    <span className="text-xs text-muted">events</span>
                  </div>
                  <div className="text-[10px] text-muted mt-1">
                    {p.unique_stores} stores · {p.total_units_added.toLocaleString()} units
                  </div>
                </div>
              ))}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{invAdds.data?.total ?? 0} inventory adds</CardTitle>
              <CardDescription>
                On-hand jumped from 0 to a positive number — usually a new shipment arrived.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invAdds.isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                {invAdds.data?.events.length === 0 && !invAdds.isLoading && (
                  <div className="text-center py-12 text-muted text-sm">
                    No inventory restock events in the selected window.
                  </div>
                )}
                {invAdds.data?.events.map((e, i) => (
                  <Link
                    key={i}
                    href={`/stores/${e.store_number}`}
                    className="block m-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className="change-chip"
                            style={{
                              background: 'rgba(212,165,116,0.18)',
                              color: 'var(--color-accent)',
                            }}
                          >
                            +{e.jump} units
                          </span>
                          <span
                            className="change-chip"
                            style={{
                              background: e.territory_color + '33',
                              color: e.territory_color,
                            }}
                          >
                            {e.territory_name}
                          </span>
                        </div>
                        <div className="font-semibold text-base">
                          #{e.store_number} · {e.account ?? '—'}
                        </div>
                        <div className="text-xs text-muted">
                          {e.brand} {e.product_name} · {e.city}
                        </div>
                        {e.prev_date && (
                          <div className="text-[10px] text-muted mt-1">
                            was 0 on {formatDate(e.prev_date)} → {e.on_hand} on{' '}
                            {formatDate(e.snapshot_date)}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase text-muted">on-hand</div>
                        <div className="text-lg font-bold tabular-nums">{e.on_hand}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* TAB: LCBO LIVE — discoveries from lcbo.com that SOD doesn't show */}
      {tab === 'lcbo_live' && (
        <>
          <div className="m-card flex items-start gap-3 border-[#a78bfa]/40 bg-[rgba(167,139,250,0.05)]">
            <Radar size={18} className="text-[#a78bfa] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-semibold mb-0.5">Dual-source reconciliation</div>
              <div className="text-muted">
                Stores where lcbo.com shows the SKU live (in stock) but SOD shows it
                blank, missing, or fully delisted. The killer signal — lcbo.com is
                near-realtime; SOD has multi-day lag. Refreshes every 2h automatically.
              </div>
            </div>
            <button
              onClick={() => rescan.mutate()}
              disabled={rescan.isPending}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#a78bfa] text-white text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw size={12} className={rescan.isPending ? 'animate-spin' : ''} />
              {rescan.isPending ? 'Scanning…' : 'Rescan now'}
            </button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{lcboLive.data?.total ?? 0} live discoveries</CardTitle>
              <CardDescription>
                Sorted newest first. Tap a store to drill in and create a deal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lcboLive.isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                {lcboLive.data?.discoveries.length === 0 && !lcboLive.isLoading && (
                  <div className="text-center py-12 text-muted text-sm">
                    No discrepancies right now. SOD and lcbo.com are aligned.
                  </div>
                )}
                {lcboLive.data?.discoveries.map((d, i) => (
                  <Link
                    key={i}
                    href={`/stores/${d.store_number}`}
                    className="block m-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className="change-chip"
                            style={{
                              background: 'rgba(167,139,250,0.18)',
                              color: '#a78bfa',
                            }}
                          >
                            <Radar size={11} className="inline mr-1" />
                            LIVE on LCBO.COM
                          </span>
                          {d.current_sod_status === 'F' && (
                            <span className="change-chip change-DELISTED">SOD: Fully Delisted</span>
                          )}
                          {!d.current_sod_status && (
                            <span className="change-chip change-BASELINE">SOD: missing</span>
                          )}
                          <span
                            className="change-chip"
                            style={{
                              background: d.territory_color + '33',
                              color: d.territory_color,
                            }}
                          >
                            {d.territory_name}
                          </span>
                        </div>
                        <div className="font-semibold text-base">
                          #{d.store_number} · {d.account ?? '—'}
                        </div>
                        <div className="text-xs text-muted">
                          {d.brand} {d.product_name} · {d.city}{' '}
                          {d.rep ? `· Rep: ${d.rep}` : ''}
                        </div>
                        {d.last_lcbo_seen && (
                          <div className="text-[10px] text-muted mt-1">
                            Last seen on lcbo.com: {formatDateTime(d.last_lcbo_seen)}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted">{formatDate(d.change_date)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* TAB: DELISTED & FLIPS (use existing listing-digest endpoint) */}
      {(tab === 'delisted' || tab === 'flips') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {tab === 'delisted'
                ? `${digest.data?.counts.find((c) => c.change_type === 'DELISTED')?.count ?? 0} delistings`
                : `${digest.data?.counts.find((c) => c.change_type === 'STATUS_FLIP')?.count ?? 0} status flips`}
            </CardTitle>
            <CardDescription>
              {tab === 'delisted'
                ? 'Across ALL LCBO SKUs (not just ours).'
                : 'Status changes that aren’t simple D ↔ L (e.g., L → F).'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {digest.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-16" />
                ))}
              {digest.data?.changes
                .filter((c) =>
                  tab === 'delisted'
                    ? c.change_type === 'DELISTED'
                    : c.change_type === 'STATUS_FLIP',
                )
                .slice(0, 100)
                .map((c, i) => (
                  <div
                    key={i}
                    className={`m-card ${c.is_tracked ? 'border-[var(--color-accent)]/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`change-chip change-${c.change_type}`}>
                            {c.change_type.replace('_', ' ')}
                          </span>
                          {c.is_tracked && (
                            <span className="change-chip change-BASELINE">OURS</span>
                          )}
                        </div>
                        <div className="font-medium text-sm">
                          {c.product_name || <span className="text-muted">Unknown</span>}
                        </div>
                        <div className="text-xs text-muted font-mono">SKU {c.sku}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted">{formatDate(c.change_date)}</div>
                        <div className="text-xs mt-1 tabular-nums font-semibold">
                          {c.old_status || '—'} → {c.new_status || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {digest.data && digest.data.changes.filter((c) =>
                tab === 'delisted'
                  ? c.change_type === 'DELISTED'
                  : c.change_type === 'STATUS_FLIP',
              ).length === 0 && (
                <div className="text-center py-12 text-muted text-sm">
                  None in the selected window.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating "Mark Listing" button */}
      <button
        onClick={() => setLogSheet(true)}
        aria-label="Mark a new listing"
        className="fixed bottom-[80px] lg:bottom-6 right-4 z-30 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-[var(--color-primary)] text-white"
      >
        <Plus size={26} />
      </button>

      {logSheet && (
        <MarkListingSheet
          trackedSkus={trackedList}
          onClose={() => setLogSheet(false)}
          onLogged={() => {
            qc.invalidateQueries({ queryKey: ['additions'] });
            qc.invalidateQueries({ queryKey: ['brand'] });
          }}
        />
      )}
    </div>
  );
}

function MarkListingSheet({
  trackedSkus,
  onClose,
  onLogged,
}: {
  trackedSkus: Array<{ sku: string; product_name: string; brand: string }>;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [sku, setSku] = useState(trackedSkus[0]?.sku ?? '');
  const [storeNumber, setStoreNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const log = useMutation({
    mutationFn: () =>
      api.logListing({ sku, store_number: parseInt(storeNumber, 10), change_date: date }),
    onSuccess: (r) => {
      if (r.status === 'duplicate_ignored') {
        toast.info('Already logged for this date');
      } else {
        toast.success(`Logged: ${r.brand} at #${r.store_number}`);
      }
      onLogged();
      onClose();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-card)] rounded-t-2xl border-t border-x border-[var(--color-card-border)] p-5 pb-8 safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2>Mark New Listing</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          Use this when a rep tells you a store added a SKU before SOD detects it.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted font-semibold mb-1 block">
              Product
            </label>
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="select"
            >
              {trackedSkus.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.brand} {p.product_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted font-semibold mb-1 block">
              Store number
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={storeNumber}
              onChange={(e) => setStoreNumber(e.target.value)}
              placeholder="e.g. 217"
              className="select"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted font-semibold mb-1 block">
              When
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="select"
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => log.mutate()}
            disabled={!sku || !storeNumber || log.isPending}
            className="w-full"
          >
            {log.isPending ? 'Saving…' : 'Mark as Listed'}
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ShieldAlert, Ghost, EyeOff, Activity, TrendingDown,
  RefreshCw, AlertTriangle, PackageOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { PasscodeGate } from '@/components/passcode-gate';

/**
 * Hidden Listings Detector — finds 5 patterns of sneaky disappearance:
 *   1. GHOST listings (was Listed, vanished without DELISTED event)
 *   2. HIDDEN INVENTORY (lcbo.com sees stock, SOD says no)
 *   3. FLICKER (status flipped 3+ times in 30 days)
 *   4. MASS-DELIST (snapshot day with >10% drop in listings)
 *   5. INVENTORY-NO-LISTING (SOD on_hand>0 but status is D/F) — the
 *      "blank with stock" case where listings hide on the warehouse floor
 *
 * Passcode-gated (operator-only) — same passcode as commission audit.
 */
export default function HiddenListingsPage() {
  return (
    <PasscodeGate
      storageKey="commission_audit_unlocked"
      passcode="0257"
      title="Hidden Listings Audit"
      description="Operator-only view. Same passcode as Commission Audit."
    >
      <HiddenListingsInner />
    </PasscodeGate>
  );
}

function HiddenListingsInner() {
  const [skuFilter, setSkuFilter] = useState<string>('');
  const [lookbackDays, setLookbackDays] = useState(90);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minOnHand, setMinOnHand] = useState(1);

  const audit = useQuery({
    queryKey: [
      'hidden-listings', skuFilter, lookbackDays,
      startDate, endDate, minOnHand,
    ],
    queryFn: () =>
      api.hiddenListings({
        sku: skuFilter || undefined,
        lookback_days: lookbackDays,
        flicker_min: 3,
        mass_delist_pct: 10,
        lcbo_window_h: 72,
        start: startDate || undefined,
        end: endDate || undefined,
        min_on_hand: minOnHand,
      }),
    refetchInterval: 5 * 60_000,
  });

  const tracked = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  const a = audit.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <ShieldAlert size={24} className="text-[var(--color-danger)]" />
          Hidden Listings Detector
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Four-pattern anti-fraud audit: ghosts, hidden inventory, flickers,
          mass-delist days. Surfaces every store-SKU pair where a listing
          looks like it was hidden in SOD.
        </p>
      </header>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="SKU">
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
            <Field label={`Lookback: ${lookbackDays} days`}>
              <input
                type="range"
                min={14}
                max={180}
                step={7}
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
                className="w-full"
                disabled={!!(startDate && endDate)}
              />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => audit.refetch()}
              disabled={audit.isFetching}
            >
              <RefreshCw size={14} className={audit.isFetching ? 'animate-spin' : ''} />
              {audit.isFetching ? 'Auditing…' : 'Re-run audit'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Date range — start (overrides lookback)">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Date range — end">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={`Min on_hand for inventory-no-listing: ${minOnHand}`}>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={minOnHand}
                onChange={(e) => setMinOnHand(Number(e.target.value))}
                className="w-full"
              />
            </Field>
          </div>
          {(startDate || endDate) && (
            <div className="text-[10px] text-muted">
              Active window: {startDate || '…'} → {endDate || '…'} (overrides lookback)
              {(startDate || endDate) && (
                <button
                  type="button"
                  className="ml-2 underline text-[var(--color-accent)]"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                >
                  clear
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <PatternCard
          icon={<PackageOpen size={16} className="text-[var(--color-danger)]" />}
          label="Inventory, no listing"
          count={a?.summary.total_inventory_no_listing ?? 0}
          help="SOD on_hand>0 but status is D/F — stock with no listing"
          tone={(a?.summary.total_inventory_no_listing ?? 0) > 0 ? 'danger' : undefined}
        />
        <PatternCard
          icon={<EyeOff size={16} className="text-[var(--color-danger)]" />}
          label="Hidden inventory"
          count={a?.summary.total_hidden_inventory ?? 0}
          help="lcbo.com sees stock, SOD says no — strongest evidence"
          tone={(a?.summary.total_hidden_inventory ?? 0) > 0 ? 'danger' : undefined}
        />
        <PatternCard
          icon={<Ghost size={16} className="text-[var(--color-warning)]" />}
          label="Ghost listings"
          count={a?.summary.total_ghost ?? 0}
          help="Listed in past, vanished without DELISTED event"
          tone={(a?.summary.total_ghost ?? 0) > 0 ? 'warning' : undefined}
        />
        <PatternCard
          icon={<Activity size={16} className="text-[var(--color-warning)]" />}
          label="Flicker patterns"
          count={a?.summary.total_flicker ?? 0}
          help="Same store-SKU flipped status 3+ times in 30d"
          tone={(a?.summary.total_flicker ?? 0) > 0 ? 'warning' : undefined}
        />
        <PatternCard
          icon={<TrendingDown size={16} className="text-[var(--color-warning)]" />}
          label="Mass-delist events"
          count={a?.summary.total_mass_delist_events ?? 0}
          help="Snapshot days with >10% drop in listings for a SKU"
          tone={(a?.summary.total_mass_delist_events ?? 0) > 0 ? 'warning' : undefined}
        />
      </div>

      {/* Pattern 5: INVENTORY-NO-LISTING (the "blank with stock" case) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageOpen size={16} className="text-[var(--color-danger)]" />
            Inventory with no active listing
            <span className="text-xs text-muted font-normal">
              (SOD on_hand &gt; 0 but status is D/F — bottles on the floor, listing
              gone — listings hide here)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(a?.patterns.inventory_no_listing?.length ?? 0) === 0 ? (
            <Empty msg="No inventory-without-listing rows. SOD on_hand agrees with listing status across the window." />
          ) : (
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Store</th>
                  <th>SOD status</th>
                  <th>On hand</th>
                  <th>Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {(a!.patterns.inventory_no_listing ?? []).map((r, i) => (
                  <tr key={`${r.sku}-${r.store_number}-${r.snapshot_date}-${i}`}>
                    <td className="font-mono">{r.sku}</td>
                    <td>
                      <span className="text-muted">{r.brand}</span> {r.product_name}
                    </td>
                    <td>
                      <Link
                        href={`/stores/${r.store_number}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        #{r.store_number}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={r.sod_status} />
                    </td>
                    <td className="tabular-nums font-semibold text-[var(--color-danger)]">
                      {r.on_hand}
                    </td>
                    <td className="text-muted">{r.snapshot_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pattern 2: HIDDEN INVENTORY (cross-validation with lcbo.com) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <EyeOff size={16} className="text-[var(--color-danger)]" />
            Hidden inventory
            <span className="text-xs text-muted font-normal">
              (lcbo.com or rep saw shelf, SOD says no — these are commission claims)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(a?.patterns.hidden_inventory?.length ?? 0) === 0 ? (
            <Empty msg="No hidden-inventory patterns. SOD ↔ lcbo.com agree on every listed store." />
          ) : (
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Store</th>
                  <th>SOD status</th>
                  <th>lcbo.com units</th>
                  <th>lcbo seen</th>
                  <th>Rep saw</th>
                </tr>
              </thead>
              <tbody>
                {a!.patterns.hidden_inventory.map((r, i) => (
                  <tr key={`${r.sku}-${r.store_number}-${i}`}>
                    <td className="font-mono">{r.sku}</td>
                    <td>
                      <span className="text-muted">{r.brand}</span> {r.product_name}
                    </td>
                    <td>
                      <Link
                        href={`/stores/${r.store_number}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        #{r.store_number}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={r.sod_status} />
                    </td>
                    <td className="tabular-nums font-semibold text-[var(--color-danger)]">
                      {r.lcbo_units}
                    </td>
                    <td className="text-muted">{r.lcbo_seen_at ? r.lcbo_seen_at.slice(0, 10) : '—'}</td>
                    <td className="text-muted">
                      {r.rep_observed_at
                        ? `${r.rep_observed_by ?? 'rep'} · ${r.rep_observed_at.slice(0, 10)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pattern 1: GHOSTS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ghost size={16} className="text-[var(--color-warning)]" />
            Ghost listings
            <span className="text-xs text-muted font-normal">
              (was Listed, vanished without DELISTED event)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(a?.patterns.ghost_listings?.length ?? 0) === 0 ? (
            <Empty msg="No ghost listings. Every disappearance has a corresponding DELISTED event." />
          ) : (
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Last seen Listed</th>
                  <th>Days ghosted</th>
                </tr>
              </thead>
              <tbody>
                {a!.patterns.ghost_listings.map((r, i) => (
                  <tr key={`${r.sku}-${r.store_number}-${i}`}>
                    <td className="font-mono">{r.sku}</td>
                    <td>
                      <span className="text-muted">{r.brand}</span> {r.product_name}
                    </td>
                    <td>
                      <Link
                        href={`/stores/${r.store_number}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        #{r.store_number}
                      </Link>
                    </td>
                    <td className="text-muted">{r.last_listed_date ?? '—'}</td>
                    <td className="tabular-nums font-semibold text-[var(--color-warning)]">
                      {r.days_since_last_listed ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pattern 3: FLICKER */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity size={16} className="text-[var(--color-warning)]" />
            Flicker patterns
            <span className="text-xs text-muted font-normal">
              (status flipped 3+ times in 30 days — unusual for real listings)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(a?.patterns.flicker_patterns?.length ?? 0) === 0 ? (
            <Empty msg="No flicker patterns. Listing statuses are stable." />
          ) : (
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Flips</th>
                  <th>Sequence</th>
                  <th>First flip</th>
                  <th>Last flip</th>
                </tr>
              </thead>
              <tbody>
                {a!.patterns.flicker_patterns.map((r, i) => (
                  <tr key={`${r.sku}-${r.store_number}-${i}`}>
                    <td className="font-mono">{r.sku}</td>
                    <td>
                      <span className="text-muted">{r.brand}</span> {r.product_name}
                    </td>
                    <td>
                      <Link
                        href={`/stores/${r.store_number}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        #{r.store_number}
                      </Link>
                    </td>
                    <td className="tabular-nums font-bold text-[var(--color-warning)]">
                      {r.flip_count}
                    </td>
                    <td className="text-[10px] font-mono text-muted">{r.sequence}</td>
                    <td className="text-muted">{r.first_flip_date}</td>
                    <td className="text-muted">{r.last_flip_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pattern 4: MASS-DELIST */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown size={16} className="text-[var(--color-warning)]" />
            Mass-delist days
            <span className="text-xs text-muted font-normal">
              (&gt;10% day-over-day drop — real delistings happen 1–2 stores at a time)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(a?.patterns.mass_delist_days?.length ?? 0) === 0 ? (
            <Empty msg="No mass-delist days. Listing counts are stable across snapshots." />
          ) : (
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Prev day</th>
                  <th>This day</th>
                  <th>Drop</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {a!.patterns.mass_delist_days.map((r, i) => (
                  <tr key={`${r.sku}-${r.snapshot_date}-${i}`}>
                    <td className="text-muted">{r.snapshot_date}</td>
                    <td className="font-mono">{r.sku}</td>
                    <td>
                      <span className="text-muted">{r.brand}</span> {r.product_name}
                    </td>
                    <td className="tabular-nums">{r.prev_count}</td>
                    <td className="tabular-nums">{r.listed_count}</td>
                    <td className="tabular-nums font-semibold text-[var(--color-danger)]">
                      −{r.drop_count}
                    </td>
                    <td className="tabular-nums font-semibold text-[var(--color-danger)]">
                      −{r.drop_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* How-to-read */}
      {a?.how_to_read && (
        <div className="m-card flex items-start gap-3 border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
          <AlertTriangle size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="text-xs text-muted">{a.how_to_read}</div>
        </div>
      )}
    </div>
  );
}

function PatternCard({
  icon,
  label,
  count,
  help,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  help: string;
  tone?: 'danger' | 'warning';
}) {
  const color =
    tone === 'danger'
      ? 'var(--color-danger)'
      : tone === 'warning'
        ? 'var(--color-warning)'
        : 'var(--color-foreground)';
  return (
    <div className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-semibold mt-1 tabular-nums" style={{ color }}>
        {formatNumber(count)}
      </div>
      <div className="text-[10px] text-muted mt-1">{help}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    L: { label: 'Listed', cls: 'bg-[rgba(120,200,140,0.10)] text-[var(--color-success)]' },
    D: { label: 'Delisting', cls: 'bg-[rgba(253,203,110,0.10)] text-[var(--color-warning)]' },
    F: { label: 'Fully Delisted', cls: 'bg-[rgba(239,75,75,0.10)] text-[var(--color-danger)]' },
    absent: { label: 'absent', cls: 'bg-[rgba(255,255,255,0.05)] text-muted' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-[rgba(255,255,255,0.05)] text-muted' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-xs text-muted">{msg}</div>;
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

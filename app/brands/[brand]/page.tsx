'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Tag, TrendingUp, TrendingDown, Store as StoreIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, formatDate, statusBadgeClass, statusLabel } from '@/lib/utils';

export default function BrandDetailPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = use(params);
  const brandName = decodeURIComponent(brand).replace(/-/g, ' ');

  const detail = useQuery({
    queryKey: ['brand', brandName],
    queryFn: () => api.brand(brandName),
  });
  const additions = useQuery({
    queryKey: ['additions', { brand: brandName }],
    queryFn: () => api.distributionAdditions({ days: 60, brand: brandName }),
  });

  const d = detail.data;

  return (
    <div className="space-y-4 pb-6">
      <Link
        href="/brands"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--color-accent)]"
      >
        <ArrowLeft size={14} /> All brands
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Brand</span>
        </div>
        <h1>{d?.brand ?? brandName}</h1>
        <p className="text-muted text-sm">
          Combined live distribution across all our SKUs in this brand.
        </p>
      </header>

      <FreshnessBanner />

      {/* Brand-level KPIs */}
      {d && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <BigKpi
            label="Stores carrying"
            value={d.totals.total_stores_with_any_listed}
            icon={<StoreIcon size={18} />}
            color="var(--color-success)"
          />
          <BigKpi
            label="With ALL our SKUs"
            value={d.totals.total_stores_with_all_listed}
            color="var(--color-accent)"
          />
          <BigKpi
            label="With any delisting"
            value={d.totals.total_stores_with_any_delisting}
            icon={<TrendingDown size={18} />}
            color={
              d.totals.total_stores_with_any_delisting > 0
                ? 'var(--color-warning)'
                : 'var(--color-muted)'
            }
          />
          <BigKpi
            label="New 60d"
            value={d.recent_changes_60d.counts.NEW_LISTING ?? 0}
            icon={<TrendingUp size={18} />}
            color="var(--color-accent)"
          />
        </div>
      )}

      {/* Per-SKU rollup */}
      {d && (
        <Card>
          <CardHeader>
            <CardTitle>Per-SKU coverage</CardTitle>
            <CardDescription>Latest snapshot for each SKU.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {d.per_sku.map((p) => (
                <Link
                  key={p.sku}
                  href={`/skus/${p.sku}`}
                  className="block p-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)]"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="font-medium">{p.product_name}</div>
                    <div className="text-xs text-muted font-mono">{p.sku}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <Pill label="Listed" v={p.listed} c="var(--color-success)" />
                    <Pill label="Delisting" v={p.delisting} c={p.delisting > 0 ? 'var(--color-warning)' : 'var(--color-muted)'} />
                    <Pill label="Fully Del" v={p.fully_delisted} c={p.fully_delisted > 0 ? 'var(--color-danger)' : 'var(--color-muted)'} />
                    <Pill label="On-Hand" v={formatNumber(p.total_on_hand)} c="var(--color-foreground)" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent additions feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent distribution wins (60 days)</CardTitle>
          <CardDescription>
            Stores that ADDED a brand SKU. Tap a store to drill in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {additions.isLoading && <div className="skeleton h-20" />}
            {additions.data?.additions.length === 0 && (
              <div className="text-center py-6 text-muted text-sm">
                No new distribution adds in the last 60 days.
              </div>
            )}
            {additions.data?.additions.slice(0, 30).map((a, i) => (
              <Link
                key={i}
                href={`/stores/${a.store_number}`}
                className="block p-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="change-chip change-NEW_LISTING">{a.change_type}</span>
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
                    <div className="text-sm font-medium">
                      #{a.store_number} · {a.account ?? '—'}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {a.product_name} · {a.city}{' '}
                      {a.rep ? `· Rep: ${a.rep}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted">{formatDate(a.change_date)}</div>
                    <div className="text-sm font-bold tabular-nums mt-1">
                      {a.current_on_hand}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-store matrix */}
      {d && d.matrix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Store coverage matrix</CardTitle>
            <CardDescription>
              Every store carrying any of our brand SKUs, with status &amp; on-hand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {d.matrix
                .sort(
                  (a, b) =>
                    Object.values(b.skus).filter((v) => v.status === 'L').length -
                    Object.values(a.skus).filter((v) => v.status === 'L').length,
                )
                .slice(0, 100)
                .map((m) => (
                  <Link
                    key={m.store_number}
                    href={`/stores/${m.store_number}`}
                    className="block p-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="font-medium text-sm">
                        #{m.store_number} · {m.account ?? '—'}
                      </div>
                      <span
                        className="change-chip text-[10px]"
                        style={{
                          background: (m.territory_color ?? '#888') + '33',
                          color: m.territory_color ?? '#888',
                        }}
                      >
                        {m.territory_name ?? 'Unassigned'}
                      </span>
                    </div>
                    <div className="text-xs text-muted mb-2">{m.city}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.skus.map((sku) => {
                        const r = m.skus[sku];
                        const product = d.per_sku.find((p) => p.sku === sku);
                        return (
                          <span
                            key={sku}
                            className={`change-chip text-[11px] ${
                              !r ? 'opacity-40' : ''
                            }`}
                            style={
                              r
                                ? r.status === 'L'
                                  ? { background: 'rgba(18,194,140,0.15)', color: '#22d79b' }
                                  : r.status === 'D'
                                    ? { background: 'rgba(253,203,110,0.15)', color: '#ffd780' }
                                    : { background: 'rgba(239,75,75,0.15)', color: '#ff8a80' }
                                : { background: 'rgba(255,255,255,0.04)', color: 'var(--color-muted)' }
                            }
                          >
                            {product?.product_name?.split(' ')[0] ?? sku}
                            {r ? ` · ${r.status}${r.on_hand ? ` · ${r.on_hand}` : ''}` : ' · —'}
                          </span>
                        );
                      })}
                    </div>
                  </Link>
                ))}
            </div>
            {d.matrix.length > 100 && (
              <div className="text-xs text-muted text-center pt-2">
                Showing top 100 of {d.matrix.length} stores
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BigKpi({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="m-card">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
        <span>{label}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div
        className="text-3xl font-bold mt-1.5 tabular-nums"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ label, v, c }: { label: string; v: number | string; c: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className="text-sm font-bold tabular-nums" style={{ color: c }}>
        {v}
      </div>
    </div>
  );
}

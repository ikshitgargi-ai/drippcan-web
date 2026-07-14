'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDate, statusBadgeClass, statusLabel } from '@/lib/utils';

export default function NewDistributionPage() {
  const [days, setDays] = useState(60);
  const [skuFilter, setSkuFilter] = useState('');

  const tracked = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  const additions = useQuery({
    queryKey: ['additions', { days, sku: skuFilter }],
    queryFn: () => api.distributionAdditions({ days, sku: skuFilter || undefined }),
  });

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--color-success)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Distribution</span>
        </div>
        <h1>New Distribution</h1>
        <p className="text-muted text-sm">
          Stores that ADDED our SKUs to distribution in the last {days} days.
        </p>
      </header>

      <FreshnessBanner />

      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {([30, 60, 90, 180] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-11 ${
              days === d
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            Last {d}d
          </button>
        ))}
        <select
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
          className="select max-w-[240px]"
        >
          <option value="">All tracked SKUs</option>
          {trackedList.map((p) => (
            <option key={p.sku} value={p.sku}>
              {p.brand} {p.product_name}
            </option>
          ))}
        </select>
      </div>

      {/* Per-SKU rollup */}
      {additions.data && additions.data.per_sku.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribution wins by SKU</CardTitle>
            <CardDescription>
              Total adds, how many are still on shelf, how many were lost again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {additions.data.per_sku.map((p) => (
                <Link
                  key={p.sku}
                  href={`/skus/${p.sku}`}
                  className="block p-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm">
                      {p.brand} {p.product_name}
                    </div>
                    <div className="text-xs text-muted font-mono">{p.sku}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                        Adds
                      </div>
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {p.count}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                        Still listed
                      </div>
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: 'var(--color-success)' }}
                      >
                        {p.still_listed}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                        Lost again
                      </div>
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{
                          color:
                            p.lost_again > 0
                              ? 'var(--color-warning)'
                              : 'var(--color-muted)',
                        }}
                      >
                        {p.lost_again}
                      </div>
                    </div>
                    {p.count > 0 && (
                      <div className="ml-auto text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                          Stick rate
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {Math.round((p.still_listed / p.count) * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additions feed */}
      <Card>
        <CardHeader>
          <CardTitle>{additions.data?.total ?? 0} new store additions</CardTitle>
          <CardDescription>Most recent first. Tap a store to drill in.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {additions.isLoading &&
              Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
            {additions.data?.additions.length === 0 && (
              <div className="text-center py-12 text-muted">
                No new distribution adds in the selected window. Try widening the days filter.
              </div>
            )}
            {additions.data?.additions.map((a, i) => (
              <Link
                key={i}
                href={`/stores/${a.store_number}`}
                className="block m-card"
              >
                <div className="flex items-start justify-between gap-3">
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
                      {a.priority && a.priority !== 'Standard' && (
                        <span className="change-chip change-BASELINE">{a.priority}</span>
                      )}
                    </div>
                    <div className="font-semibold text-base">
                      #{a.store_number} · {a.account ?? '—'}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {a.brand} {a.product_name} · {a.city ?? ''} {a.rep ? `· Rep: ${a.rep}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted">{formatDate(a.change_date)}</div>
                    <div className="mt-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                        On-Hand
                      </div>
                      <div className="text-lg font-bold tabular-nums">{a.current_on_hand}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

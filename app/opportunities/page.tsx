'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Target, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber, statusBadgeClass, statusLabel } from '@/lib/utils';
import { downloadCSV } from '@/lib/export';

export default function OppsPage() {
  const [sku, setSku] = useState<string | undefined>();
  const [territoryId, setTerritoryId] = useState<number | undefined>();
  const [threshold, setThreshold] = useState(3);

  const territories = useQuery({ queryKey: ['territories'], queryFn: api.crmTerritories });
  const trackedProducts = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const opps = useQuery({
    queryKey: ['opps', sku, territoryId, threshold],
    queryFn: () =>
      api.opportunities({ sku, territory_id: territoryId, slow_threshold: threshold, limit: 300 }),
  });

  const tracked = trackedProducts.data?.products ?? trackedProducts.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Target size={24} className="text-[var(--color-accent)]" />
          Opportunities
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Stores where a same-category competitor is slow or delisting and we&apos;re not yet
          listed. Score-ranked: higher = easier conversion.
        </p>
      </header>

      <FreshnessBanner />

      <Card>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Pitch our SKU">
            <select
              value={sku ?? ''}
              onChange={(e) => setSku(e.target.value || undefined)}
              className="select"
            >
              <option value="">All tracked SKUs</option>
              {tracked.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.brand} {p.product_name} ({p.sku})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Territory">
            <select
              value={territoryId ?? ''}
              onChange={(e) => setTerritoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="select"
            >
              <option value="">All territories</option>
              {territories.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.store_count})
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Slow if on-hand ≤ ${threshold}`}>
            <input
              type="number"
              min={0}
              max={20}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="select"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{opps.data?.length ?? 0} pitch targets</CardTitle>
              <CardDescription>
                Score weights delisting + low stock + competitor status.
              </CardDescription>
            </div>
            {opps.data && opps.data.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadCSV(opps.data, 'opportunities')}
              >
                <Download size={14} /> CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile/desktop card layout */}
          <div className="space-y-2.5">
            {opps.isLoading &&
              Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
            {opps.data?.length === 0 && (
              <div className="text-center py-12 text-muted">
                No opportunities found. Run a SOD refresh or widen the threshold.
              </div>
            )}
            {opps.data?.map((o, i) => {
              const scoreColor =
                o.opportunity_score >= 50
                  ? 'var(--color-danger)'
                  : o.opportunity_score >= 25
                    ? 'var(--color-warning)'
                    : 'var(--color-muted)';
              return (
                <Link
                  key={i}
                  href={`/stores/${o.store_number}`}
                  className="m-card block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span
                          className="change-chip"
                          style={{ background: scoreColor + '22', color: scoreColor }}
                        >
                          SCORE {o.opportunity_score}
                        </span>
                        <span className={statusBadgeClass(o.competitor_status)}>
                          {statusLabel(o.competitor_status)}
                        </span>
                        <span
                          className="change-chip"
                          style={{
                            background: o.territory_color + '33',
                            color: o.territory_color,
                          }}
                        >
                          {o.territory_name}
                        </span>
                      </div>
                      <div className="text-xs uppercase tracking-wider text-muted font-semibold">
                        Pitch our
                      </div>
                      <div className="font-semibold">
                        {o.our_brand} {o.our_product}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-muted font-semibold mt-2">
                        Replace slow
                      </div>
                      <div className="text-sm truncate">
                        {o.competitor_name?.slice(0, 40)}
                        <span className="text-muted"> · {o.category}</span>
                      </div>
                      <div className="text-xs text-muted mt-2">
                        Store #{o.store_number} · {o.city}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                        Comp Stock
                      </div>
                      <div className="text-2xl font-bold mt-0.5 tabular-nums">
                        {formatNumber(o.competitor_on_hand)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
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

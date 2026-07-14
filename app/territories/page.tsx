'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Globe2, ChevronDown, ChevronRight, Users, Eye, AlertTriangle, PackageOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';

export default function TerritoriesPage() {
  const territories = useQuery({ queryKey: ['territories'], queryFn: api.crmTerritories });
  const rollup = useQuery({
    queryKey: ['territory-rollup'],
    queryFn: () => api.territoryRollup(),
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = (territories.data ?? []).reduce<Record<string, typeof territories.data>>(
    (acc, t) => {
      const r = t.region || 'Other';
      (acc[r] ??= [] as NonNullable<typeof territories.data>).push(t);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <Globe2 size={24} className="text-[var(--color-accent)]" />
            Territories
            <span className="text-xs font-normal text-muted ml-2">(Phoenix &amp; Dayaa)</span>
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Per-rep distribution + SKU drill-down on the latest SOD snapshot.
            Tap a rep card to expand the SKU breakdown.
          </p>
        </div>
      </header>

      {/* Per-rep rollup: distribution + SKU drilldown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={16} className="text-[var(--color-accent)]" />
            Per-rep distribution
            {rollup.data?.snapshot_date && (
              <span className="text-xs text-muted font-normal">
                snapshot {rollup.data.snapshot_date}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rollup.isLoading && <div className="skeleton h-24" />}
          {rollup.data?.territories.map((t) => {
            const open = expanded === t.rep;
            return (
              <div
                key={t.rep}
                className="rounded-lg border border-[var(--color-card-border)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : t.rep)}
                  className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-[var(--color-card)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="font-semibold">{t.rep}</span>
                      <span className="text-xs text-muted">— {t.territory_name}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <Metric label="Stores" value={t.stores_total} />
                      <Metric
                        label="Visited 30d"
                        value={`${t.stores_visited_30d} (${t.visited_pct}%)`}
                      />
                      <Metric
                        label="Coverage"
                        value={`${t.coverage_pct}%`}
                        accent={t.coverage_pct < 50 ? 'warning' : undefined}
                      />
                      <Metric
                        label="Avg SKU dist"
                        value={`${t.sku_distribution_avg_pct}%`}
                      />
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="px-3 pb-3 border-t border-[var(--color-card-border)]">
                    <table className="data-table min-w-full text-xs mt-2">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Listed</th>
                          <th>Missing</th>
                          <th><AlertTriangle size={10} className="inline" /> OOS</th>
                          <th><PackageOpen size={10} className="inline" /> Low</th>
                          <th>Dist %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.per_sku.map((s) => (
                          <tr key={s.sku}>
                            <td>
                              <Link
                                href={`/skus/${s.sku}`}
                                className="hover:text-[var(--color-accent)]"
                              >
                                <span className="text-muted">{s.brand}</span>{' '}
                                {s.product_name}
                              </Link>
                            </td>
                            <td className="tabular-nums">{s.present_stores}</td>
                            <td className="tabular-nums text-[var(--color-warning)]">
                              {s.missing_stores}
                            </td>
                            <td className="tabular-nums text-[var(--color-danger)]">
                              {s.oos_stores}
                            </td>
                            <td className="tabular-nums text-[var(--color-warning)]">
                              {s.low_stock_stores}
                            </td>
                            <td className="tabular-nums font-semibold">
                              {s.distribution_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Geo-coded territory blocks (existing) */}
      <header className="pt-2">
        <h2 className="text-lg font-semibold text-[var(--color-muted)] uppercase text-xs tracking-widest">
          Geo-coded territory definitions
        </h2>
      </header>

      {Object.entries(grouped).map(([region, terrs]) => (
        <div key={region}>
          <h2 className="text-lg font-semibold mb-3 text-[var(--color-muted)] uppercase text-xs tracking-widest">
            {region}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {terrs?.map((t) => (
              <Card
                key={t.id}
                className="relative overflow-hidden hover:border-[var(--color-accent)] transition-colors cursor-pointer"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: t.color }}
                />
                <CardHeader>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <CardDescription className="font-mono text-[10px]">{t.code}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-[var(--color-muted)]">Stores</span>
                    <span className="font-semibold tabular-nums">{formatNumber(t.store_count)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-[var(--color-muted)]">HORECA</span>
                    <span className="font-semibold tabular-nums">{formatNumber(t.horeca_count)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Rep</span>
                    <span className="font-medium">{t.rep_name || '—'}</span>
                  </div>
                  {t.fsa_prefixes && (
                    <div className="text-[10px] text-[var(--color-muted)] font-mono mt-2 pt-2 border-t border-[var(--color-card-border)]">
                      FSA: {t.fsa_prefixes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {territories.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-40" />
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label, value, accent,
}: {
  label: string;
  value: number | string;
  accent?: 'warning' | 'danger';
}) {
  const color =
    accent === 'danger' ? 'var(--color-danger)' :
    accent === 'warning' ? 'var(--color-warning)' :
    'var(--color-foreground)';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

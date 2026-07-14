'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';

export default function RepsPage() {
  const reps = useQuery({ queryKey: ['report-rep'], queryFn: api.reportRep });

  const data = reps.data;
  const tracked = data?.reps?.[0]?.per_product.map((p) => ({ sku: p.sku, name: p.product_name })) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <ArrowDownUp size={24} className="text-[var(--color-accent)]" />
          Rep Performance
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Stores assigned per rep + our SKU coverage at each. &quot;Carrying&quot; now correctly
          excludes delisting/delisted stores (Sprint 0 fix).
        </p>
      </header>

      <FreshnessBanner />

      <Card>
        <CardHeader>
          <CardTitle>{data?.reps.length ?? 0} reps</CardTitle>
          <CardDescription>
            Snapshot: {data?.snapshot_date ?? '—'}. Rep names normalized (case + whitespace).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="data-table min-w-[800px]">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th className="text-right">Stores</th>
                  {tracked.map((t) => (
                    <th key={t.sku} className="text-right" title={t.name}>
                      <div className="text-[10px]">{t.name?.slice(0, 12)}</div>
                      <div className="text-[9px] text-[var(--color-muted)]">
                        carrying / delisting
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.reps.map((r) => (
                  <tr key={r.rep}>
                    <td className="font-medium">{r.rep}</td>
                    <td className="text-right tabular-nums">{formatNumber(r.total_stores)}</td>
                    {r.per_product.map((p) => (
                      <td key={p.sku} className="text-right text-xs tabular-nums">
                        <span className="text-[var(--color-success)]">{p.stores_carrying}</span>
                        {' / '}
                        <span
                          className={
                            p.stores_delisting > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)]'
                          }
                        >
                          {p.stores_delisting}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
                {data?.reps.length === 0 && (
                  <tr>
                    <td colSpan={tracked.length + 2} className="text-center py-8 text-[var(--color-muted)]">
                      No reps assigned in stores table.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

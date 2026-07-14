'use client';

import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber, statusBadgeClass, statusLabel } from '@/lib/utils';
import { SkuTrendChart, SkuStockChart } from '@/components/sku-trend-chart';
import { downloadCSV } from '@/lib/export';

export default function SkuPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = use(params);
  const oos = useQuery({
    queryKey: ['oos-for-sku', sku],
    queryFn: () => api.oosRisk({ sku, threshold: 20 }),
  });
  const trend = useQuery({
    queryKey: ['sku-trend', sku, 90],
    queryFn: () => api.skuTrend(sku, 90),
  });

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Package size={24} className="text-[var(--color-accent)]" />
          {trend.data?.brand} {trend.data?.product_name}
        </h1>
        <p className="text-sm text-[var(--color-muted)] font-mono">SKU {sku}</p>
      </header>

      <FreshnessBanner />

      <Card>
        <CardHeader>
          <CardTitle>Listing status over time</CardTitle>
          <CardDescription>
            Store-count by status, last {trend.data?.days ?? 90} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkuTrendChart trend={trend.data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total on-hand over time</CardTitle>
          <CardDescription>Units summed across all stores per snapshot.</CardDescription>
        </CardHeader>
        <CardContent>
          <SkuStockChart trend={trend.data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Store-level listing</CardTitle>
              <CardDescription>
                Sorted by lowest on-hand. Click a store to drill into its SKU history.
              </CardDescription>
            </div>
            {oos.data && oos.data.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadCSV(oos.data, `sku-${sku}-stores`)}
              >
                <Download size={14} /> CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="data-table table-to-cards min-w-[700px] sm:min-w-0">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>City</th>
                  <th>Territory</th>
                  <th>Status</th>
                  <th className="text-right">On-Hand</th>
                  <th>Rep</th>
                </tr>
              </thead>
              <tbody>
                {oos.data?.map((r, i) => (
                  <tr key={i}>
                    <td data-label="Store">
                      <Link
                        href={`/stores/${r.store_number}`}
                        className="hover:text-[var(--color-accent)]"
                      >
                        #{r.store_number}
                      </Link>
                      <div className="text-[10px] text-[var(--color-muted)]">{r.account}</div>
                    </td>
                    <td data-label="City">{r.city}</td>
                    <td data-label="Territory">
                      <span
                        className="badge"
                        style={{ background: r.territory_color + '33', color: r.territory_color }}
                      >
                        {r.territory_name}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td data-label="On-Hand" className="text-right tabular-nums">
                      {formatNumber(r.on_hand)}
                    </td>
                    <td data-label="Rep">{r.rep || '—'}</td>
                  </tr>
                ))}
                {oos.data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[var(--color-muted)]">
                      No stores carrying this SKU at/below threshold.
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

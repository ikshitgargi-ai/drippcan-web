'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Tag, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { formatNumber } from '@/lib/utils';

export default function BrandsIndexPage() {
  const brands = useQuery({ queryKey: ['brands'], queryFn: api.brands });

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Portfolio</span>
        </div>
        <h1>Our Brands</h1>
        <p className="text-muted text-sm">
          Live distribution health for every Anu brand we track. Tap a brand to drill into
          per-SKU + per-store detail.
        </p>
      </header>

      <FreshnessBanner />

      <div className="space-y-3">
        {brands.isLoading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
        {brands.data?.brands.map((b) => (
          <Link
            key={b.brand}
            href={`/brands/${encodeURIComponent(b.slug)}`}
            className="m-card block"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="!text-lg">{b.brand}</h2>
                  <span className="text-xs text-muted">
                    {b.sku_count} SKU{b.sku_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="text-xs text-muted truncate">
                  {b.skus.map((s) => s.product_name).join(' · ')}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-[var(--color-card-border)]">
              <KpiCell label="Listed" value={b.total_listed} color="var(--color-success)" />
              <KpiCell
                label="Delisting"
                value={b.total_delisting}
                color={b.total_delisting > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
              />
              <KpiCell label="On-Hand" value={formatNumber(b.total_on_hand)} />
              <KpiCell
                label="New 60d"
                value={b.additions_60d}
                color={b.additions_60d > 0 ? 'var(--color-accent)' : 'var(--color-muted)'}
                icon={b.additions_60d > 0 ? <TrendingUp size={11} /> : null}
              />
            </div>
          </Link>
        ))}
        {brands.data?.brands.length === 0 && (
          <div className="m-card text-center py-8 text-muted">
            No tracked brands configured.
          </div>
        )}
      </div>

      <div className="m-card flex items-center gap-3">
        <AlertTriangle size={18} className="text-[var(--color-warning)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Want to add a brand?</div>
          <div className="text-xs text-muted">
            Brand SKUs are configured in the backend. Contact us to add yours.
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div
        className="text-base font-bold tabular-nums mt-0.5 flex items-center gap-1"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

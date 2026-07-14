'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Wine,
  Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, formatDate, statusBadgeClass, statusLabel } from '@/lib/utils';

/**
 * /anu-import — Anu's secondary import portfolio (Goenchi + Fratelli).
 * Visually segregated from the primary NB Distillers tracker.
 */
export default function AnuImportPage() {
  const tracker = useQuery({
    queryKey: ['anu-import'],
    queryFn: api.anuImport,
    refetchInterval: 60_000,
  });
  const t = tracker.data;

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Wine size={16} className="text-[#a78bfa]" />
          <span className="muted-small font-semibold uppercase tracking-wider">
            Secondary portfolio
          </span>
        </div>
        <h1>Anu Import</h1>
        <p className="text-muted text-sm">
          {t?.tagline ?? 'Goenchi (Feni) + Fratelli (wines) — Anu Spirits import portfolio.'}
        </p>
      </header>

      <FreshnessBanner />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigKpi
          label="Stores Listed"
          value={t?.totals.total_listed_stores ?? '—'}
          color="var(--color-success)"
        />
        <BigKpi
          label="Units on Shelf"
          value={t ? formatNumber(t.totals.total_on_hand_units) : '—'}
          color="var(--color-accent)"
        />
        <BigKpi
          label="New 60d"
          value={t?.totals.additions_60d ?? '—'}
          color={(t?.totals.additions_60d ?? 0) > 0 ? 'var(--color-success)' : 'var(--color-muted)'}
          icon={<TrendingUp size={16} />}
        />
        <BigKpi
          label="Delisting Now"
          value={t?.totals.total_delisting_stores ?? '—'}
          color={(t?.totals.total_delisting_stores ?? 0) > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
          icon={<TrendingDown size={16} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-product detail</CardTitle>
          <CardDescription>
            6 SKUs across Goenchi + Fratelli. Tap to drill into per-store performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {t?.per_sku.map((p) => (
              <div key={p.sku} className="m-card border-[#a78bfa]/30">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs text-muted">{p.brand}</div>
                    <h3 className="!text-sm">{p.product_name}</h3>
                    <div className="text-xs text-muted font-mono">SKU {p.sku}</div>
                  </div>
                  <a
                    href={p.lcbo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
                  >
                    LCBO <ExternalLink size={11} />
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Mini label="Listed" value={p.listed} color="var(--color-success)" />
                  <Mini
                    label="Delisting"
                    value={p.delisting}
                    color={p.delisting > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
                  />
                  <Mini label="On Hand" value={formatNumber(p.total_on_hand)} />
                </div>
                <Link
                  href={`/skus/${p.sku}`}
                  className="text-xs text-[var(--color-accent)] hover:underline mt-2 block"
                >
                  Full SKU drill-down →
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {t && t.additions_60d.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.additions_60d.length} new stores in last 60 days</CardTitle>
            <CardDescription>Distribution wins for Anu Import.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {t.additions_60d.slice(0, 12).map((a, i) => (
                <Link key={i} href={`/stores/${a.store_number}`} className="block m-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="change-chip change-NEW_LISTING">{a.change_type}</span>
                        {a.current_status && (
                          <span className={statusBadgeClass(a.current_status)}>
                            now {statusLabel(a.current_status)}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-sm">
                        #{a.store_number} · {a.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {a.product_name} · {a.city}
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
      )}
    </div>
  );
}

function BigKpi({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="m-card">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
        <span className="leading-tight">{label}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div
        className="text-2xl lg:text-3xl font-bold mt-1.5 tabular-nums"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div
        className="text-base font-bold tabular-nums"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}

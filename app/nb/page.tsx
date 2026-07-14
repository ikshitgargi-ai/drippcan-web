'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Crown,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Coffee,
  Package,
  Store as StoreIcon,
  Globe2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, formatDate, statusBadgeClass, statusLabel } from '@/lib/utils';

/**
 * /nb — premium NB Distillers tracker (paying client).
 *
 * Single-page deep dive on Red Admiral Vodka (#20187) + Chak De Whisky (#22246).
 * Auto-refreshes every 60s.
 */
export default function NbTrackerPage() {
  const tracker = useQuery({
    queryKey: ['nb-tracker'],
    queryFn: api.nbTracker,
    refetchInterval: 60_000,
  });

  const t = tracker.data;

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">
            Premium client tracker
          </span>
        </div>
        <h1 className="flex items-center gap-2">
          NB Distillers <span className="text-xs text-muted">· Anu Spirits</span>
        </h1>
        <p className="text-muted text-sm">
          {t?.tagline ?? 'Live distribution tracker for Red Admiral Vodka + Chak De Canadian Whisky.'}
        </p>
      </header>

      <FreshnessBanner />

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigKpi
          label="Total Stores Listed"
          value={t?.totals.total_listed_stores ?? '—'}
          color="var(--color-success)"
          icon={<StoreIcon size={16} />}
        />
        <BigKpi
          label="Units on Shelf"
          value={t ? formatNumber(t.totals.total_on_hand_units) : '—'}
          color="var(--color-accent)"
          icon={<Package size={16} />}
        />
        <BigKpi
          label="New Stores 60d"
          value={t?.totals.additions_60d ?? '—'}
          color={(t?.totals.additions_60d ?? 0) > 0 ? 'var(--color-success)' : 'var(--color-muted)'}
          icon={<TrendingUp size={16} />}
        />
        <BigKpi
          label="Delistings 60d"
          value={t?.totals.delistings_60d ?? '—'}
          color={(t?.totals.delistings_60d ?? 0) > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
          icon={<TrendingDown size={16} />}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigKpi
          label="OOS Risk Stores"
          value={t?.totals.oos_risk_count ?? '—'}
          color={(t?.totals.oos_risk_count ?? 0) > 0 ? 'var(--color-danger)' : 'var(--color-muted)'}
          icon={<AlertTriangle size={16} />}
        />
        <BigKpi
          label="Tasting Follow-ups"
          value={t?.totals.tasting_followups_count ?? '—'}
          icon={<Coffee size={16} />}
          color="#a78bfa"
        />
        <BigKpi
          label="Delisting Now"
          value={t?.totals.total_delisting_stores ?? '—'}
          color={(t?.totals.total_delisting_stores ?? 0) > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
        />
        <BigKpi
          label="SKUs Tracked"
          value={t?.totals.total_skus ?? '—'}
          color="var(--color-accent)"
        />
      </div>

      {/* Per-SKU rollup */}
      <Card>
        <CardHeader>
          <CardTitle>Product detail</CardTitle>
          <CardDescription>
            Both NB SKUs side-by-side with current SOD snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {t?.per_sku.map((p) => (
              <div
                key={p.sku}
                className="m-card border-[var(--color-accent)]/40"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="!text-base">{p.product_name}</h3>
                    <div className="text-xs text-muted font-mono">SKU {p.sku}</div>
                  </div>
                  <a
                    href={p.lcbo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
                  >
                    LCBO.com <ExternalLink size={11} />
                  </a>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <Mini label="Listed" value={p.listed} color="var(--color-success)" />
                  <Mini
                    label="Delisting"
                    value={p.delisting}
                    color={p.delisting > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
                  />
                  <Mini label="On Hand" value={formatNumber(p.total_on_hand)} />
                  <Mini label="Avg/Store" value={p.avg_on_hand_at_listed} />
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--color-card-border)] flex items-center justify-between">
                  <Link
                    href={`/skus/${p.sku}`}
                    className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
                  >
                    Full SKU drill-down →
                  </Link>
                  <span className="text-[10px] text-muted">
                    snapshot {p.snapshot_date ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 30-day trend chart */}
      {t && t.trend_30d.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>30-day distribution trend</CardTitle>
            <CardDescription>Combined NB Distillers store count by status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={t.trend_30d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="nbListed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#12c28c" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#12c28c" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="nbDelisting" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fdcb6e" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#fdcb6e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2430" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#7a818c', fontSize: 11 }}
                    tickFormatter={(d) => d.slice(5)}
                  />
                  <YAxis tick={{ fill: '#7a818c', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#12151b',
                      border: '1px solid #1f2430',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="listed" stroke="#12c28c" fill="url(#nbListed)" name="Listed" />
                  <Area type="monotone" dataKey="delisting" stroke="#fdcb6e" fill="url(#nbDelisting)" name="Delisting" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Territory coverage */}
      {t && t.territory_coverage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Territory coverage</CardTitle>
            <CardDescription>NB stores per territory + coverage %.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {t.territory_coverage
                .filter((tt) => tt.total_stores > 0)
                .map((tc) => (
                  <div
                    key={tc.code}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
                  >
                    <span
                      className="w-1 h-8 rounded-full shrink-0"
                      style={{ background: tc.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{tc.name}</div>
                      <div className="text-xs text-muted">
                        {tc.nb_stores} of {tc.total_stores} stores carry NB
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-lg font-bold tabular-nums"
                        style={{
                          color:
                            tc.coverage_pct >= 25
                              ? 'var(--color-success)'
                              : tc.coverage_pct >= 10
                                ? 'var(--color-warning)'
                                : 'var(--color-muted)',
                        }}
                      >
                        {tc.coverage_pct}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent additions */}
      {t && t.additions_60d.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.additions_60d.length} new stores added in last 60 days</CardTitle>
            <CardDescription>Distribution wins for NB Distillers.</CardDescription>
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

      {/* Top stores by on-hand */}
      {t && t.top_stores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top stores by on-hand</CardTitle>
            <CardDescription>Highest NB inventory right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {t.top_stores.slice(0, 10).map((s, i) => (
                <Link key={i} href={`/stores/${s.store_number}`} className="block m-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={statusBadgeClass(s.status)}>{statusLabel(s.status)}</span>
                        <span
                          className="change-chip"
                          style={{
                            background: s.territory_color + '33',
                            color: s.territory_color,
                          }}
                        >
                          {s.territory_name}
                        </span>
                      </div>
                      <div className="font-medium text-sm">
                        #{s.store_number} · {s.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {s.product_name} · {s.city}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase text-muted">on hand</div>
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: 'var(--color-success)' }}
                      >
                        {s.on_hand}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OOS Risk */}
      {t && t.oos_risk.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
              {t.oos_risk.length} stores at OOS risk
            </CardTitle>
            <CardDescription>NB SKU listed but ≤ 2 units left.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {t.oos_risk.slice(0, 10).map((r, i) => (
                <Link key={i} href={`/stores/${r.store_number}`} className="block m-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        #{r.store_number} · {r.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {r.product_name} · {r.city}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        {r.on_hand}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasting follow-ups */}
      {t && t.tasting_followups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee size={18} className="text-[#a78bfa]" />
              {t.tasting_followups.length} tasting follow-ups
            </CardTitle>
            <CardDescription>
              We tasted/sampled here, but the SKU isn&apos;t currently on shelf.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {t.tasting_followups.slice(0, 10).map((f, i) => (
                <Link key={i} href={`/stores/${f.store_number}`} className="block m-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="change-chip change-BASELINE">{f.tasting_outcome || 'tasting'}</span>
                        {!f.current_sod_status && (
                          <span className="change-chip change-DELISTED">SOD: missing</span>
                        )}
                        {f.current_sod_status === 'D' && (
                          <span className="change-chip change-DELISTED">SOD: D</span>
                        )}
                      </div>
                      <div className="font-medium text-sm">
                        #{f.store_number} · {f.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {f.product_name} · {f.city}
                        {f.rep ? ` · by ${f.rep}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted">
                        {f.days_since_tasting != null ? `${f.days_since_tasting}d ago` : '—'}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delistings */}
      {t && t.delistings_60d.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown size={18} style={{ color: 'var(--color-danger)' }} />
              {t.delistings_60d.length} delistings in last 60 days
            </CardTitle>
            <CardDescription>Stores where NB SKU went L→D, L→F, or dropped.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {t.delistings_60d.slice(0, 10).map((d, i) => (
                <Link key={i} href={`/stores/${d.store_number}`} className="block m-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="change-chip change-DELISTED">{d.change_type}</span>
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
                      <div className="font-medium text-sm">
                        #{d.store_number} · {d.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {d.product_name} · {d.city}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">
                        {d.old_status ?? '—'} → {d.new_status ?? '—'}
                      </div>
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

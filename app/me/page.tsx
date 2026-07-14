'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  User as UserIcon,
  Coffee,
  Eye,
  Users as MeetingIcon,
  ClipboardCheck,
  Truck,
  Phone,
  Box,
  Target,
  Trophy,
  AlertTriangle,
  PackageOpen,
  Activity as ActivityIcon,
  Mail,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useActiveRep } from '@/lib/active-rep';
import { useActivePortfolio } from '@/lib/active-portfolio';
import { PortfolioToggle } from '@/components/portfolio-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, relativeTime, statusBadgeClass, statusLabel } from '@/lib/utils';

/**
 * /me — every rep's self-service dashboard. Pulls /api/crm/rep-dashboard/<rep>
 * and renders activity counts, recent log, won deals, open pipeline,
 * opportunities (missing SKUs in my patch), and my OOS / low-stock list.
 *
 * The rep is read from localStorage via useActiveRep (set on /today).
 */
export default function MePage() {
  const [activeRep, setActiveRep] = useActiveRep();
  const [portfolio] = useActivePortfolio();

  const repsQuery = useQuery({ queryKey: ['reps'], queryFn: api.reps });
  const dash = useQuery({
    queryKey: ['rep-dashboard', activeRep, portfolio],
    queryFn: () => api.repDashboard(activeRep ?? '', portfolio),
    enabled: !!activeRep,
  });

  if (!activeRep) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <UserIcon size={24} className="text-[var(--color-accent)]" />
            My Dashboard
          </h1>
          <p className="text-sm text-muted">Pick your name to see your numbers.</p>
        </header>
        <Card>
          <CardContent className="pt-4">
            <select
              value={activeRep ?? ''}
              onChange={(e) => setActiveRep(e.target.value || null)}
              className="select w-full"
            >
              <option value="">— pick rep —</option>
              {(repsQuery.data ?? []).map((r) => (
                <option key={r.rep} value={r.rep}>
                  {r.rep} {r.store_count > 0 ? `(${r.store_count} stores)` : ''}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = dash.data;
  const s30 = d?.stats_30d;
  const s90 = d?.stats_90d;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
              <UserIcon size={24} className="text-[var(--color-accent)]" />
              {activeRep} — My Dashboard
            </h1>
            <p className="text-sm text-muted">
              {d?.my_store_count ?? '—'} assigned stores · {' '}
              <span className="font-semibold">
                Portfolio: {portfolio === 'NB' ? 'NB Distillers' : portfolio === 'Anu' ? 'Anu Imports' : 'All books'}
              </span>{' '}
              · last refreshed {d?.as_of ? relativeTime(d.as_of) : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveRep(null)}
            className="text-xs text-[var(--color-accent)] underline"
          >
            switch rep
          </button>
        </div>
        {/* Portfolio toggle — NB by default for the rep team.
            Anu/All hidden behind passcode (operator-only). */}
        <PortfolioToggle />
      </header>

      {dash.isLoading && <div className="skeleton h-48" />}
      {dash.error && (
        <Card>
          <CardContent className="pt-4 text-sm text-[var(--color-danger)]">
            Failed to load dashboard: {(dash.error as Error).message}
          </CardContent>
        </Card>
      )}

      {d && (
        <>
          {/* Stats — 30 days vs 90 days */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My activity</CardTitle>
              <CardDescription>30-day rolling vs 90-day total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <StatCard icon={<Eye size={14} />} label="Visits" v30={s30?.visits} v90={s90?.visits} />
                <StatCard icon={<Coffee size={14} />} label="Tastings" v30={s30?.tastings} v90={s90?.tastings} />
                <StatCard icon={<MeetingIcon size={14} />} label="Meetings" v30={s30?.meetings} v90={s90?.meetings} />
                <StatCard icon={<ClipboardCheck size={14} />} label="Orders" v30={s30?.order_commitments} v90={s90?.order_commitments} />
                <StatCard icon={<Truck size={14} />} label="Deliveries" v30={s30?.deliveries} v90={s90?.deliveries} />
                <StatCard icon={<Box size={14} />} label="Samples" v30={s30?.sample_drops} v90={s90?.sample_drops} />
                <StatCard icon={<Phone size={14} />} label="Call/Email" v30={s30?.outreach} v90={s90?.outreach} />
                <StatCard icon={<ActivityIcon size={14} />} label="Total" v30={s30?.total} v90={s90?.total} highlight />
              </div>
            </CardContent>
          </Card>

          {/* New listings won */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy size={16} className="text-[var(--color-success)]" />
                My new listings (90 days)
                <span className="text-xs text-muted font-normal">
                  ({d.new_listings_won.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.new_listings_won.length === 0 ? (
                <Empty msg="No new listings closed in the last 90 days yet — go win one." />
              ) : (
                <table className="data-table min-w-full text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Store</th>
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.new_listings_won.map((r) => (
                      <tr key={r.id}>
                        <td><span className="text-muted">{r.brand}</span> {r.product_name}</td>
                        <td className="font-mono">{r.sku}</td>
                        <td>
                          {r.store_number ? (
                            <Link
                              href={`/stores/${r.store_number}`}
                              className="text-[var(--color-accent)] hover:underline"
                            >
                              #{r.store_number}
                            </Link>
                          ) : '—'}
                        </td>
                        <td className="text-muted">{r.closed_at?.slice(0, 10) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Open deals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target size={16} className="text-[var(--color-accent)]" />
                My open pipeline
                <span className="text-xs text-muted font-normal">
                  ({d.open_deals.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.open_deals.length === 0 ? (
                <Empty msg="No open deals — start one from the Replace Targets tab on any store page." />
              ) : (
                <table className="data-table min-w-full text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stage</th>
                      <th>Store</th>
                      <th>Next action</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.open_deals.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="text-muted">{r.brand}</span> {r.product_name}
                          <div className="text-[10px] font-mono text-muted">{r.sku}</div>
                        </td>
                        <td><span className="change-chip change-STATUS_FLIP">{r.stage}</span></td>
                        <td>
                          {r.store_number ? (
                            <Link
                              href={`/stores/${r.store_number}`}
                              className="text-[var(--color-accent)] hover:underline"
                            >
                              #{r.store_number}
                            </Link>
                          ) : '—'}
                        </td>
                        <td>{r.next_action || '—'}</td>
                        <td className="text-muted">{r.next_action_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Opportunities — missing SKUs in my patch */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target size={16} className="text-[var(--color-warning)]" />
                Distribution gaps in my patch
                <span className="text-xs text-muted font-normal">
                  (SKUs missing from my stores — pitch these)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.opportunities.length === 0 ? (
                <Empty msg="No distribution gaps — every tracked SKU is at every assigned store." />
              ) : (
                <table className="data-table min-w-full text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Present</th>
                      <th>Missing</th>
                      <th>Gap %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.opportunities.map((r) => (
                      <tr key={r.sku}>
                        <td>
                          <Link
                            href={`/skus/${r.sku}`}
                            className="hover:text-[var(--color-accent)]"
                          >
                            <span className="text-muted">{r.brand}</span> {r.product_name}
                          </Link>
                          <div className="text-[10px] font-mono text-muted">{r.sku}</div>
                        </td>
                        <td className="tabular-nums">{r.present_stores}</td>
                        <td className="tabular-nums font-semibold text-[var(--color-warning)]">
                          {r.missing_stores}
                        </td>
                        <td className="tabular-nums">{r.opportunity_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* My OOS + low-stock */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={16} className="text-[var(--color-danger)]" />
                Out of stock in my patch
                <span className="text-xs text-muted font-normal">({d.my_oos.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.my_oos.length === 0 ? (
                <Empty msg="Nothing out of stock in your patch right now." />
              ) : (
                <StockTable rows={d.my_oos} color="var(--color-danger)" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PackageOpen size={16} className="text-[var(--color-warning)]" />
                Low stock in my patch (&lt; 7 bottles)
                <span className="text-xs text-muted font-normal">({d.my_low_stock.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.my_low_stock.length === 0 ? (
                <Empty msg="Stock is healthy across every listed store in your patch." />
              ) : (
                <StockTable rows={d.my_low_stock} color="var(--color-warning)" />
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ActivityIcon size={16} className="text-[var(--color-accent)]" />
                My last 25 logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {d.recent_activities.map((a) => (
                  <div key={a.id} className="p-2 rounded bg-[var(--color-background)] border border-[var(--color-card-border)] text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="change-chip change-BASELINE">{a.activity_type}</span>
                      <span className="text-muted">{relativeTime(a.created_at)}</span>
                    </div>
                    {a.store_number ? (
                      <Link
                        href={`/stores/${a.store_number}`}
                        className="font-semibold hover:text-[var(--color-accent)]"
                      >
                        #{a.store_number} · {a.account || ''}
                      </Link>
                    ) : (
                      <div className="font-semibold">(no store)</div>
                    )}
                    {a.outcome && (
                      <div className="text-muted mt-0.5">→ {a.outcome}</div>
                    )}
                    {a.notes && (
                      <div className="text-muted mt-0.5 whitespace-pre-wrap">{a.notes}</div>
                    )}
                  </div>
                ))}
                {d.recent_activities.length === 0 && (
                  <Empty msg="No activity logged yet — head to /log to get started." />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon, label, v30, v90, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  v30: number | undefined;
  v90: number | undefined;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        highlight
          ? 'border-[rgba(212,165,116,0.4)] bg-[rgba(212,165,116,0.08)]'
          : 'border-[var(--color-card-border)] bg-[rgba(255,255,255,0.02)]'
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{formatNumber(v30 ?? 0)}</div>
      <div className="text-[10px] text-muted">
        90d: <span className="tabular-nums">{formatNumber(v90 ?? 0)}</span>
      </div>
    </div>
  );
}

function StockTable({ rows, color }: { rows: { sku: string; product_name: string; store_number: number; on_hand: number; account: string; city: string; postal: string }[]; color: string }) {
  return (
    <table className="data-table min-w-full text-xs">
      <thead>
        <tr>
          <th>Product</th>
          <th>Store</th>
          <th>City</th>
          <th>On hand</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.sku}-${r.store_number}-${i}`}>
            <td>{r.product_name}</td>
            <td>
              <Link
                href={`/stores/${r.store_number}`}
                className="text-[var(--color-accent)] hover:underline"
              >
                #{r.store_number}
              </Link>
            </td>
            <td className="text-muted">{r.city} {r.postal}</td>
            <td className="tabular-nums font-semibold" style={{ color }}>{r.on_hand}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-xs text-muted">{msg}</div>;
}

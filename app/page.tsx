'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Tag,
  Calendar,
  Plus,
  X,
  Activity as ActivityIcon,
  Target,
  Package,
  Phone,
  Sparkles,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { captureSilentGeo } from '@/lib/silent-geo';
import { useActiveRep } from '@/lib/active-rep';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Button } from '@/components/ui/button';
import { StoreLookup } from '@/components/store-lookup';
import { formatNumber, formatDate, statusBadgeClass, statusLabel, relativeTime } from '@/lib/utils';

/**
 * THE ONE PAGE — every important section lives here, vertically scrolled.
 * Bottom tabs scroll to anchors instead of navigating to other URLs.
 *
 * Sections:
 *   #today      — rep's daily plan
 *   #brands     — NB Distillers + Goenchi + Fratelli health
 *   #intel      — new stores / new inventory / delistings (last 60d)
 *   #pipeline   — open deals by stage
 *   #activity   — team activity feed
 */
export default function HomePage() {
  const [activeRep] = useActiveRep();
  const [logSheet, setLogSheet] = useState(false);
  const qc = useQueryClient();

  const brands = useQuery({ queryKey: ['brands'], queryFn: api.brands });
  const additions = useQuery({
    queryKey: ['additions', { days: 60 }],
    queryFn: () => api.distributionAdditions({ days: 60 }),
  });
  const invAdds = useQuery({
    queryKey: ['inv-adds', 60],
    queryFn: () => api.inventoryAdds({ days: 60 }),
  });
  const today = useQuery({
    queryKey: ['today', activeRep],
    queryFn: () => api.today(activeRep!, 5),
    enabled: !!activeRep,
  });
  const dash = useQuery({ queryKey: ['crm-dashboard'], queryFn: api.crmDashboard });
  const digest = useQuery({ queryKey: ['digest', 7], queryFn: () => api.listingDigest(7) });
  const oos = useQuery({ queryKey: ['oos', 2], queryFn: () => api.oosRisk({ threshold: 2 }) });
  const lcboLive = useQuery({
    queryKey: ['lcbo-live', 30],
    queryFn: () => api.lcboLiveDiscoveries(30),
  });
  const followups = useQuery({
    queryKey: ['tasting-followups', 180],
    queryFn: () => api.tastingFollowups(180),
  });
  const deals = useQuery({ queryKey: ['deals', { active_only: true }], queryFn: () => api.deals({}) });
  const activity = useQuery({
    queryKey: ['activities', { days: 14 }],
    queryFn: () => api.activities({ days: 14 }),
  });
  const tracked = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  const recentChanges = (digest.data?.changes ?? []).slice(0, 5);
  const newCount =
    (digest.data?.counts.find((c) => c.change_type === 'NEW_LISTING')?.count ?? 0) +
    (digest.data?.counts.find((c) => c.change_type === 'RELISTED')?.count ?? 0);
  const delistedCount =
    digest.data?.counts.find((c) => c.change_type === 'DELISTED')?.count ?? 0;

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="muted-small font-semibold uppercase tracking-wider">
            Live · 24/7 Agent
          </span>
        </div>
        <h1>Anu LCBO Tracker</h1>
        <p className="text-muted text-sm">
          Real-time distribution intel from SOD + LCBO.com.
        </p>
      </header>

      <FreshnessBanner />

      {/* Top KPI strip */}
      <div className="grid grid-cols-4 gap-2">
        <MiniKpi
          label="Listed"
          value={brands.data?.brands.reduce((s, b) => s + b.total_listed, 0) ?? '—'}
          color="var(--color-success)"
        />
        <MiniKpi
          label="Delisting"
          value={brands.data?.brands.reduce((s, b) => s + b.total_delisting, 0) ?? '—'}
          color="var(--color-warning)"
        />
        <MiniKpi
          label="OOS Risk"
          value={oos.data?.length ?? '—'}
          color="var(--color-danger)"
        />
        <MiniKpi
          label="New 60d"
          value={additions.data?.total ?? '—'}
          color="var(--color-accent)"
        />
      </div>

      {/* SECTION: TODAY */}
      <section id="today" className="scroll-mt-20 space-y-2.5">
        <SectionHeader icon={<Calendar size={18} />} title="Today's Plan" linkLabel="All stops" linkHref="/today" />
        {activeRep ? (
          today.data && today.data.stops.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <Stat label="Stops" value={today.data.total_stops} />
                <Stat label="Drive" value={`${today.data.total_distance_km}km`} />
                <Stat label="Open" value={today.data.overdue_deal_actions} />
              </div>
              <div className="space-y-2">
                {today.data.stops.slice(0, 3).map((s, i) => (
                  <Link
                    key={s.store_id}
                    href={`/stores/${s.store_number}`}
                    className="m-card flex items-center gap-3"
                  >
                    <div
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2"
                      style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        #{s.store_number} · {s.account}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {s.city} ·{' '}
                        {s.days_since_visit != null
                          ? `last visit ${s.days_since_visit}d ago`
                          : 'never visited'}
                      </div>
                    </div>
                    {s.oos_count > 0 && (
                      <span className="change-chip change-DELISTED">{s.oos_count} OOS</span>
                    )}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="m-card text-center py-6 text-muted text-sm">
              No stops scheduled for {activeRep}.
            </div>
          )
        ) : (
          <Link href="/today" className="m-card flex items-center gap-3">
            <Calendar size={20} className="text-[var(--color-accent)]" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Set your active rep</div>
              <div className="text-xs text-muted">Pick yourself to see today&apos;s ranked stops</div>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        )}
      </section>

      {/* SECTION: BRANDS */}
      <section id="brands" className="scroll-mt-20 space-y-2.5">
        <SectionHeader icon={<Tag size={18} />} title="Our Brands" linkLabel="Drill in" linkHref="/brands" />
        {brands.isLoading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
        {brands.data?.brands.map((b) => (
          <Link key={b.brand} href={`/brands/${encodeURIComponent(b.slug)}`} className="m-card block">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="!text-base">{b.brand}</h3>
                  <span className="text-xs text-muted">{b.sku_count} SKUs</span>
                </div>
                <div className="text-xs text-muted truncate">
                  {b.skus.map((s) => s.product_name).join(' · ')}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted shrink-0" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-[var(--color-card-border)]">
              <KpiCell label="Stores" value={b.total_stores} />
              <KpiCell label="Listed" value={b.total_listed} color="var(--color-success)" />
              <KpiCell
                label="Delisting"
                value={b.total_delisting}
                color={b.total_delisting > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
              />
              <KpiCell
                label="New 60d"
                value={b.additions_60d}
                color={b.additions_60d > 0 ? 'var(--color-accent)' : 'var(--color-muted)'}
                icon={b.additions_60d > 0 ? <TrendingUp size={11} /> : undefined}
              />
            </div>
          </Link>
        ))}
      </section>

      {/* SECTION: INTEL — what's changing */}
      <section id="intel" className="scroll-mt-20 space-y-3">
        <SectionHeader icon={<ActivityIcon size={18} />} title="What's Changing" linkLabel="Full feed" linkHref="/intel" />

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="m-card">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
              <span>New Stores 60d</span>
              <TrendingUp size={14} style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="text-3xl font-bold mt-1.5 tabular-nums" style={{ color: 'var(--color-success)' }}>
              {additions.data?.total ?? '—'}
            </div>
          </div>
          <div className="m-card">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
              <span>Delisted 7d</span>
              <TrendingDown size={14} style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="text-3xl font-bold mt-1.5 tabular-nums" style={{ color: 'var(--color-danger)' }}>
              {delistedCount}
            </div>
          </div>
        </div>

        {/* Recent additions feed */}
        {additions.data?.additions && additions.data.additions.length > 0 && (
          <>
            <div className="text-xs text-muted font-semibold uppercase tracking-wider px-1">
              Most recent new stores
            </div>
            <div className="space-y-2">
              {additions.data.additions.slice(0, 4).map((a, i) => (
                <Link key={i} href={`/stores/${a.store_number}`} className="m-card block">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="change-chip change-NEW_LISTING">NEW</span>
                        {a.current_status && (
                          <span className={statusBadgeClass(a.current_status)}>
                            now {statusLabel(a.current_status)}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-sm truncate">
                        #{a.store_number} · {a.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {a.brand} {a.product_name} · {a.city}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted">{formatDate(a.change_date)}</div>
                      <div className="text-sm font-bold tabular-nums">{a.current_on_hand}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Inventory restocks */}
        {invAdds.data?.events && invAdds.data.events.length > 0 && (
          <>
            <div className="text-xs text-muted font-semibold uppercase tracking-wider px-1 mt-3">
              New inventory shipments
            </div>
            <div className="space-y-2">
              {invAdds.data.events.slice(0, 3).map((e, i) => (
                <Link key={i} href={`/stores/${e.store_number}`} className="m-card block">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span
                        className="change-chip"
                        style={{
                          background: 'rgba(212,165,116,0.18)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        +{e.jump} units
                      </span>
                      <div className="font-medium text-sm truncate mt-1">
                        #{e.store_number} · {e.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {e.brand} {e.product_name} · {e.city}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted">{formatDate(e.snapshot_date)}</div>
                      <div className="text-sm font-bold tabular-nums">{e.on_hand}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Recent listing changes */}
        {recentChanges.length > 0 && (
          <>
            <div className="text-xs text-muted font-semibold uppercase tracking-wider px-1 mt-3">
              Recent listing changes
            </div>
            <div className="space-y-2">
              {recentChanges.map((c, i) => (
                <div
                  key={i}
                  className={`m-card ${c.is_tracked ? 'border-[var(--color-accent)]/40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`change-chip change-${c.change_type}`}>
                          {c.change_type.replace('_', ' ')}
                        </span>
                        {c.is_tracked && <span className="change-chip change-BASELINE">OURS</span>}
                      </div>
                      <div className="mt-1.5 font-medium text-sm truncate">
                        {c.product_name || <span className="text-muted">Unknown</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted shrink-0">{relativeTime(c.change_date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* SECTION: FOLLOW-UPS (tasting done, no listing) — only show if any */}
      {followups.data && followups.data.total > 0 && (
        <section id="followups" className="scroll-mt-20 space-y-2.5">
          <SectionHeader
            icon={<TrendingUp size={18} />}
            title="Tasting Follow-ups"
            linkLabel="All"
            linkHref="/follow-ups"
          />
          <p className="text-xs text-muted -mt-1">
            We tasted / left samples here, but SKU still isn&apos;t on shelf.
          </p>
          <div className="space-y-2">
            {followups.data.followups.slice(0, 4).map((f, i) => (
              <Link
                key={i}
                href={`/stores/${f.store_number}`}
                className="m-card block"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span
                        className="change-chip"
                        style={{
                          background:
                            f.priority_score >= 80
                              ? 'rgba(239,75,75,0.18)'
                              : 'rgba(253,203,110,0.18)',
                          color:
                            f.priority_score >= 80
                              ? 'var(--color-danger)'
                              : 'var(--color-warning)',
                        }}
                      >
                        {f.tasting_outcome || f.activity_type}
                      </span>
                      {f.current_sod_status === 'D' && (
                        <span className="change-chip change-DELISTED">SOD: D</span>
                      )}
                      {!f.current_sod_status && (
                        <span className="change-chip change-BASELINE">missing</span>
                      )}
                    </div>
                    <div className="font-medium text-sm truncate">
                      #{f.store_number} · {f.account ?? '—'}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {f.brand} {f.product_name} · {f.city}
                    </div>
                  </div>
                  <div className="text-xs text-muted shrink-0 text-right">
                    {f.days_since_tasting != null ? `${f.days_since_tasting}d ago` : '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SECTION: LCBO LIVE DISCOVERIES (only show if any) */}
      {lcboLive.data && lcboLive.data.total > 0 && (
        <section id="lcbo-live" className="scroll-mt-20 space-y-2.5">
          <SectionHeader
            icon={<TrendingUp size={18} />}
            title="LCBO Live Discoveries"
            linkLabel="All"
            linkHref="/intel"
          />
          <p className="text-xs text-muted -mt-1">
            Stores where lcbo.com shows our SKU live but SOD doesn&apos;t. Refresh every 2h.
          </p>
          <div className="space-y-2">
            {lcboLive.data.discoveries.slice(0, 4).map((d, i) => (
              <Link
                key={i}
                href={`/stores/${d.store_number}`}
                className="m-card block border-[#a78bfa]/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span
                        className="change-chip"
                        style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
                      >
                        LCBO LIVE
                      </span>
                      {d.current_sod_status === 'F' && (
                        <span className="change-chip change-DELISTED">SOD: F</span>
                      )}
                      {!d.current_sod_status && (
                        <span className="change-chip change-BASELINE">SOD: missing</span>
                      )}
                    </div>
                    <div className="font-medium text-sm truncate">
                      #{d.store_number} · {d.account ?? '—'}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {d.brand} {d.product_name} · {d.city}
                    </div>
                  </div>
                  <div className="text-xs text-muted shrink-0">{formatDate(d.change_date)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SECTION: PIPELINE */}
      <section id="pipeline" className="scroll-mt-20 space-y-2.5">
        <SectionHeader icon={<Target size={18} />} title="Pipeline" linkLabel="Kanban" linkHref="/pipeline" />
        {deals.data?.deals && deals.data.deals.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(deals.data.stage_counts).slice(0, 3).map(([stage, count]) => (
                <Stat key={stage} label={stage.replace(/_/g, ' ')} value={count} />
              ))}
            </div>
            <div className="space-y-2">
              {deals.data.deals.slice(0, 3).map((d) => (
                <Link
                  key={d.id}
                  href={`/stores/${d.store_number}`}
                  className="m-card block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {d.brand} {d.product_name}
                      </div>
                      <div className="text-xs text-muted">
                        Store #{d.store_number} · owner: {d.owner_rep || '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="change-chip change-STATUS_FLIP">{d.stage}</span>
                      <div className="text-xs text-muted mt-1 tabular-nums">{d.probability}%</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="m-card text-center py-6 text-muted text-sm">
            No active deals. Use{' '}
            <Link href="/intel" className="text-[var(--color-accent)] underline">
              Intel
            </Link>{' '}
            → tap a store → &quot;Replace These&quot; to add pitches.
          </div>
        )}
      </section>

      {/* SECTION: ACTIVITY */}
      <section id="activity" className="scroll-mt-20 space-y-2.5">
        <SectionHeader icon={<Phone size={18} />} title="Recent Activity" linkLabel="All" linkHref="/activity" />
        {activity.data?.activities && activity.data.activities.length > 0 ? (
          <div className="space-y-2">
            {activity.data.activities.slice(0, 4).map((a) => (
              <div key={a.id} className="m-card">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="change-chip change-BASELINE">{a.activity_type}</span>
                  <span className="text-xs text-muted">{relativeTime(a.created_at)}</span>
                </div>
                {a.account ? (
                  <Link
                    href={`/stores/${a.store_number}`}
                    className="font-medium text-sm hover:text-[var(--color-accent)]"
                  >
                    #{a.store_number} · {a.account}
                  </Link>
                ) : (
                  <span className="text-sm">{a.horeca_name ?? '—'}</span>
                )}
                {a.outcome && <div className="text-xs text-muted mt-1">{a.outcome}</div>}
                <div className="text-xs text-muted mt-1">by {a.rep || '—'}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-card text-center py-6 text-muted text-sm">
            No activity logged yet.{' '}
            <button
              onClick={() => setLogSheet(true)}
              className="text-[var(--color-accent)] underline"
            >
              Log a visit
            </button>
            .
          </div>
        )}
      </section>

      {/* SECTION: OOS */}
      {oos.data && oos.data.length > 0 && (
        <section id="oos" className="scroll-mt-20 space-y-2.5">
          <SectionHeader
            icon={<AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />}
            title="OOS Risk"
            linkLabel="All"
            linkHref="/oos"
          />
          <div className="space-y-2">
            {oos.data.slice(0, 3).map((r, i) => (
              <Link key={i} href={`/stores/${r.store_number}`} className="m-card block">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      #{r.store_number} · {r.account}
                    </div>
                    <div className="text-xs text-muted truncate">
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
                    <div className="text-[10px] text-muted">on hand</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="space-y-2.5">
        <h2>Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          <ActionTile
            onClick={() => setLogSheet(true)}
            icon={<Plus size={20} />}
            label="Log"
            color="var(--color-primary)"
          />
          <ActionTile
            href="/today"
            icon={<Calendar size={20} />}
            label="Today"
            color="var(--color-accent)"
          />
          <ActionTile
            href="/nearby"
            icon={<Navigation size={20} />}
            label="Nearby"
            color="var(--color-success)"
          />
          <ActionTile
            href="/ask"
            icon={<Sparkles size={20} />}
            label="Ask AI"
            color="#a78bfa"
          />
          <ActionTile
            href="/pipeline"
            icon={<Target size={20} />}
            label="Pipeline"
            color="#f59e0b"
          />
          <ActionTile
            href="/intel"
            icon={<Package size={20} />}
            label="Intel"
            color="#74b9ff"
          />
        </div>
      </section>

      {/* Floating "+" Mark Listing button */}
      <button
        onClick={() => setLogSheet(true)}
        aria-label="Log activity"
        className="fixed bottom-[80px] lg:bottom-6 right-4 z-30 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-[var(--color-primary)] text-white"
      >
        <Plus size={26} />
      </button>

      {logSheet && (
        <QuickLogSheet
          trackedSkus={trackedList}
          activeRep={activeRep}
          onClose={() => setLogSheet(false)}
          onLogged={() => {
            qc.invalidateQueries({ queryKey: ['additions'] });
            qc.invalidateQueries({ queryKey: ['brands'] });
            qc.invalidateQueries({ queryKey: ['activities'] });
          }}
        />
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  linkLabel,
  linkHref,
}: {
  icon: React.ReactNode;
  title: string;
  linkLabel?: string;
  linkHref?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2">
        <span className="text-[var(--color-accent)]">{icon}</span>
        {title}
      </h2>
      {linkHref && linkLabel && (
        <Link href={linkHref} className="text-sm text-[var(--color-accent)] flex items-center gap-1">
          {linkLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function MiniKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="m-card text-center !p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-muted font-semibold leading-tight">
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color }}>
        {value}
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="m-card text-center !p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ActionTile({
  href,
  onClick,
  icon,
  label,
  color,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  const inner = (
    <div className="m-card flex flex-col items-center justify-center gap-2 min-h-[88px] !p-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '22', color }}
      >
        {icon}
      </div>
      <div className="text-xs font-semibold">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href}>{inner}</Link>
  ) : (
    <button onClick={onClick} className="w-full text-left">
      {inner}
    </button>
  );
}

// Hardcoded official roster — used in the Quick-Log sheet and other selectors
const REP_ROSTER = ['Ikshit', 'Virat', 'Namit', 'Surya', 'Neeraj'];

function QuickLogSheet({
  trackedSkus,
  activeRep,
  onClose,
  onLogged,
}: {
  trackedSkus: Array<{ sku: string; product_name: string; brand: string }>;
  activeRep: string | null;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [, setActiveRep] = useActiveRep();
  const [rep, setLocalRep] = useState<string>(activeRep ?? '');
  const [mode, setMode] = useState<'visit' | 'listing'>('visit');
  const [storeNumber, setStoreNumber] = useState('');
  const [sku, setSku] = useState(trackedSkus[0]?.sku ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityType, setActivityType] = useState<'store_visit' | 'tasting' | 'meeting' | 'order_commitment' | 'delivery' | 'sample_drop' | 'call' | 'email'>('store_visit');
  const [notes, setNotes] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));

  const handleRepChange = (next: string) => {
    setLocalRep(next);
    setActiveRep(next || null);  // also persist to localStorage so other pages know
  };

  const logListing = useMutation({
    mutationFn: () =>
      api.logListing({ sku, store_number: parseInt(storeNumber, 10), change_date: date }),
    onSuccess: (r) => {
      toast.success(
        r.status === 'duplicate_ignored'
          ? 'Already logged for that date'
          : `Logged ${r.brand} at #${r.store_number}`,
      );
      onLogged();
      onClose();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const logVisit = useMutation({
    mutationFn: async () => {
      if (!rep) throw new Error('Pick your name first');
      if (!storeNumber) throw new Error('Pick a store first');
      // Silent geo — captured without any UI feedback; failures are invisible.
      const geo = await captureSilentGeo();
      return api.logActivity({
        rep,
        store_number: parseInt(storeNumber, 10),
        activity_type: activityType,
        notes,
        visit_date: visitDate,
        ...(geo ? {
          lat: geo.lat,
          lng: geo.lng,
          accuracy_m: geo.accuracy_m,
          client_ts: geo.client_ts,
        } : {}),
      });
    },
    onSuccess: () => {
      toast.success(`Activity logged as ${rep}`);
      onLogged();
      onClose();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const submit = () => (mode === 'listing' ? logListing.mutate() : logVisit.mutate());

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--color-card)] rounded-t-2xl border-t border-x border-[var(--color-card-border)] p-5 pb-8 max-h-[85vh] overflow-y-auto safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2>Quick Log</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* REP SELECTOR — first thing rep sees. Self-select, persists in
            localStorage so they don't re-pick every time. */}
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: rep ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.12)',
            border: `2px solid ${rep ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.5)'}`,
          }}
        >
          <label className="text-xs uppercase tracking-wider font-bold block mb-2"
                 style={{ color: rep ? 'var(--color-success)' : 'var(--color-warning)' }}>
            👤 Logging as {rep ? `→ ${rep}` : '(PICK YOUR NAME)'}
          </label>
          <select
            value={rep}
            onChange={(e) => handleRepChange(e.target.value)}
            className="select w-full text-base"
            autoFocus={!rep}
            style={{ minHeight: 48 }}
          >
            <option value="">— pick your name —</option>
            {REP_ROSTER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {!rep && (
            <div className="text-xs mt-2" style={{ color: 'var(--color-warning)' }}>
              ⚠️ Pick your name above to enable logging. Saved for next time.
            </div>
          )}
          {rep && (
            <div className="text-xs mt-1.5 text-muted">
              Activity will log under <strong>{rep}</strong>. Tap dropdown to change.
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('visit')}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm ${
              mode === 'visit'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            Log Visit / Tasting / Call
          </button>
          <button
            onClick={() => setMode('listing')}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm ${
              mode === 'listing'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            Mark New Listing
          </button>
        </div>

        <div className="space-y-3">
          {mode === 'listing' ? (
            <>
              <Field label="Product">
                <select value={sku} onChange={(e) => setSku(e.target.value)} className="select">
                  {trackedSkus.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.brand} {p.product_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Store number">
                <StoreLookup value={storeNumber} onChange={setStoreNumber} />
              </Field>
              <Field label="When">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="select"
                />
              </Field>
            </>
          ) : (
            <>
              {!activeRep && (
                <div className="p-3 rounded-lg bg-[rgba(253,203,110,0.08)] border border-[rgba(253,203,110,0.3)] text-xs">
                  Set an active rep on the{' '}
                  <Link href="/today" className="underline">/today</Link> page first.
                </div>
              )}
              <Field label="Store number">
                <StoreLookup value={storeNumber} onChange={setStoreNumber} />
              </Field>
              <Field label="Activity">
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as typeof activityType)}
                  className="select"
                >
                  <option value="store_visit">Store Visit</option>
                  <option value="tasting">Tasting</option>
                  <option value="meeting">Meeting</option>
                  <option value="order_commitment">Order Commitment</option>
                  <option value="delivery">Delivery</option>
                  <option value="sample_drop">Sample Drop</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                </select>
              </Field>
              <Field label="When did this happen?">
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="select"
                />
                <span className="text-[10px] text-muted mt-1 block">
                  Backdating works — log a tasting from last week, last month, etc.
                </span>
              </Field>
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What happened?"
                  className="select min-h-[88px] resize-y"
                />
              </Field>
            </>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={submit}
            disabled={
              !storeNumber ||
              (mode === 'visit' && !rep) ||
              logListing.isPending ||
              logVisit.isPending
            }
            className="w-full"
          >
            {logListing.isPending || logVisit.isPending
              ? 'Saving…'
              : !rep && mode === 'visit'
                ? 'Pick your name first'
                : !storeNumber
                  ? 'Pick a store first'
                  : mode === 'listing'
                    ? 'Mark as Listed'
                    : `Save Activity (as ${rep})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

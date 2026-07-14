'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, AlertTriangle, Clock, Navigation, ChevronRight, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useActiveRep } from '@/lib/active-rep';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, formatDate } from '@/lib/utils';
import { FreshnessBanner } from '@/components/freshness-banner';
import { MovementCard } from '@/components/movement-card';
import { SystemStatusIndicator } from '@/components/system-status-indicator';

// Hardcoded official roster — was reading api.reps which omits reps without
// prior activity. Reps self-select; activeRep persists in localStorage.
const REP_ROSTER = ['Ikshit', 'Virat', 'Namit', 'Surya', 'Neeraj'];

export default function TodayPage() {
  const [rep, setRep] = useActiveRep();

  const plan = useQuery({
    queryKey: ['today', rep],
    queryFn: () => api.today(rep!, 8),
    enabled: !!rep,
  });

  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">{todayLabel}</span>
          <span className="ml-auto">
            <SystemStatusIndicator />
          </span>
        </div>
        <h1>Today&apos;s Plan</h1>
        <p className="text-muted text-sm">
          Algorithmic ranked stops based on visit recency, OOS risk, open deals, and store priority.
        </p>
      </header>

      <FreshnessBanner />

      {/* Rep selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <User size={18} className="text-muted" />
            <span className="text-sm text-muted">Active rep:</span>
            <select
              value={rep ?? ''}
              onChange={(e) => setRep(e.target.value || null)}
              className="select max-w-[260px]"
            >
              <option value="">— pick your name —</option>
              {REP_ROSTER.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {rep && (
              <Link
                href="/log"
                className="ml-auto text-sm text-[var(--color-accent)] hover:underline"
              >
                Log a visit →
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Authoritative movement counts — LCBO universe, new listings, new stores */}
      <MovementCard defaultDays={7} />

      {!rep && (
        <div className="m-card text-center py-8">
          <p className="text-muted mb-2">No active rep selected.</p>
          <p className="text-sm text-muted">
            Pick a rep above to see their daily plan. Add yourself to the rep list by setting{' '}
            <code className="text-xs">stores.rep</code> for stores you cover.
          </p>
        </div>
      )}

      {rep && plan.data && (
        <>
          {/* Plan summary */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="m-card text-center">
              <div className="text-xs uppercase tracking-wider text-muted font-semibold">Stops</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">{plan.data.total_stops}</div>
            </div>
            <div className="m-card text-center">
              <div className="text-xs uppercase tracking-wider text-muted font-semibold">Drive</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">
                {plan.data.total_distance_km}
                <span className="text-base text-muted ml-0.5">km</span>
              </div>
            </div>
            <div className="m-card text-center">
              <div className="text-xs uppercase tracking-wider text-muted font-semibold">Open</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">
                {plan.data.overdue_deal_actions}
              </div>
            </div>
          </div>

          {/* Stops list */}
          <div className="space-y-2.5">
            {plan.data.stops.map((s, i) => (
              <div key={s.store_id} className="m-card">
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2"
                    style={{
                      borderColor: 'var(--color-accent)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="change-chip"
                        style={{
                          background: s.territory_color + '33',
                          color: s.territory_color,
                        }}
                      >
                        {s.territory_name}
                      </span>
                      {s.priority && s.priority !== 'Standard' && (
                        <span className="change-chip change-BASELINE">{s.priority}</span>
                      )}
                      {s.oos_count > 0 && (
                        <span className="change-chip change-DELISTED flex items-center gap-1">
                          <AlertTriangle size={11} /> {s.oos_count} OOS
                        </span>
                      )}
                      {s.deals.length > 0 && (
                        <span className="change-chip change-STATUS_FLIP">
                          {s.deals.length} open deal{s.deals.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/stores/${s.store_number}`}
                      className="block mt-1.5 font-semibold text-base hover:text-[var(--color-accent)]"
                    >
                      #{s.store_number} · {s.account}
                    </Link>
                    <div className="text-xs text-muted mt-0.5">
                      {s.address}, {s.city} {s.postal}
                    </div>
                    <div className="text-xs text-muted mt-1.5 flex items-center gap-3 flex-wrap">
                      {s.days_since_visit != null ? (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> Last visit {s.days_since_visit}d ago
                        </span>
                      ) : (
                        <span>Never visited</span>
                      )}
                      {s.visit_count > 0 && <span>· {s.visit_count} visits total</span>}
                    </div>
                    {s.deals.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        {s.deals.map((d, j) => (
                          <div
                            key={j}
                            className="text-xs p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] flex items-center justify-between"
                          >
                            <span>
                              <code className="font-mono">{d.sku}</code> · {d.stage}
                            </span>
                            {d.next_action && (
                              <span className="text-muted truncate ml-2">
                                {d.next_action}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Action row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-card-border)]">
                  <Link
                    href={`/log?store=${s.store_number}&rep=${encodeURIComponent(rep)}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold"
                  >
                    Log Visit
                  </Link>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-sm"
                  >
                    <Navigation size={14} /> Drive
                  </a>
                  <Link
                    href={`/stores/${s.store_number}`}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)]"
                    aria-label="Store detail"
                  >
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {plan.data.stops.length === 0 && (
            <div className="m-card text-center py-8 text-muted">
              No stops scheduled — looks like everything is up to date for {rep}.
            </div>
          )}
        </>
      )}

      {plan.isLoading && rep && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      )}
    </div>
  );
}

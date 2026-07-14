'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const REPS = ['Ikshit', 'Virat', 'Namit', 'Surya', 'Neeraj'];

export default function RepPerformancePage() {
  const [days, setDays] = useState(30);
  const perf = useQuery({
    queryKey: ['rep-performance', days],
    queryFn: () => api.repPerformance(days),
    refetchInterval: 60_000,
  });

  const reps = perf.data?.reps ?? [];
  const totals = perf.data?.totals;

  return (
    <div className="space-y-4 pb-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Trophy size={24} className="text-[var(--color-accent)]" />
          Rep Performance
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Activities, store coverage, deals, and listings won — per rep over the
          last <strong>{days}</strong> days.
        </p>
      </header>

      <div className="flex items-center gap-2">
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              days === d
                ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Activities" value={totals.activities} />
          <Stat label="Stores covered" value={totals.stores_covered} />
          <Stat label="Listings won" value={totals.listings_won} color="var(--color-success)" />
          <Stat label="Open deals" value={totals.open_deals} color="var(--color-accent)" />
        </div>
      )}

      <div className="space-y-3">
        {reps.map((r) => (
          <Card key={r.rep}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy size={16} className="text-[var(--color-accent)]" /> {r.rep}
                  </CardTitle>
                  <CardDescription>
                    {r.activities_total} activities · {r.stores_covered} stores · {r.days_active} active days
                  </CardDescription>
                </div>
                {r.tasting_to_listing_rate_pct != null && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted">Conv.</div>
                    <div className="text-lg font-bold">{r.tasting_to_listing_rate_pct}%</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {Object.entries(r.activities_by_type).map(([type, n]) => (
                  <div
                    key={type}
                    className="p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted">
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div className="font-bold tabular-nums">{n}</div>
                  </div>
                ))}
                {Object.keys(r.activities_by_type).length === 0 && (
                  <div className="col-span-full text-muted text-center py-3">
                    No activities logged in window
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <span className="text-muted">Open deals:</span>{' '}
                  <span className="font-semibold">{r.deals_open}</span>
                </div>
                <div>
                  <span className="text-muted">Listed (life):</span>{' '}
                  <span className="font-semibold text-[var(--color-success)]">{r.deals_listed}</span>
                </div>
                <div>
                  <span className="text-muted">Won {days}d:</span>{' '}
                  <span className="font-semibold text-[var(--color-success)]">
                    {r.listings_won_in_window}
                  </span>
                </div>
              </div>
              {r.last_activity_at && (
                <div className="text-xs text-muted mt-2 flex items-center gap-1">
                  <Calendar size={11} />
                  Last: {r.last_activity_type} at #{r.last_activity_store} ·{' '}
                  {new Date(r.last_activity_at).toLocaleDateString('en-CA')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="m-card">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div
        className="text-2xl font-bold tabular-nums mt-1"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

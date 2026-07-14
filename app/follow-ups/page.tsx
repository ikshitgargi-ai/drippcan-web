'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coffee, Phone, Clock, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

/**
 * Stores where a tasting / sample-drop happened but the SKU is NOT currently
 * listed at that store per latest SOD. The "what should I follow up on" page.
 */
export default function FollowUpsPage() {
  const [days, setDays] = useState(180);
  const followups = useQuery({
    queryKey: ['tasting-followups', days],
    queryFn: () => api.tastingFollowups(days),
  });

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Coffee size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Follow-ups</span>
        </div>
        <h1>Tasting Follow-ups</h1>
        <p className="text-muted text-sm">
          Stores where a tasting or sample drop happened but the SKU isn&apos;t currently
          listed. Sorted by priority (recent + delisting).
        </p>
      </header>

      <FreshnessBanner />

      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <Filter size={14} className="text-muted shrink-0 ml-1" />
        {([60, 180, 365, 720] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold min-h-10 ${
              days === d
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            {d <= 365 ? `${d}d` : `${Math.round(d / 365)}y`}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{followups.data?.total ?? 0} stores need follow-up</CardTitle>
          <CardDescription>
            We tasted / left samples here, but SOD shows the SKU isn&apos;t on shelf.
            Tap a store to drill in and pitch / log next steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {followups.isLoading &&
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
            {followups.data?.followups.length === 0 && !followups.isLoading && (
              <div className="text-center py-12 text-muted text-sm">
                No outstanding follow-ups in the selected window. Either every tasting
                resulted in a listing, or no tastings have been logged yet — use the{' '}
                <Link href="/log" className="text-[var(--color-accent)] underline">
                  Log Activity
                </Link>{' '}
                button.
              </div>
            )}
            {followups.data?.followups.map((f, i) => {
              const priorityColor =
                f.priority_score >= 80
                  ? 'var(--color-danger)'
                  : f.priority_score >= 50
                    ? 'var(--color-warning)'
                    : 'var(--color-muted)';
              return (
                <Link
                  key={i}
                  href={`/stores/${f.store_number}`}
                  className="block m-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span
                          className="change-chip"
                          style={{
                            background: priorityColor + '22',
                            color: priorityColor,
                          }}
                        >
                          PRIORITY {f.priority_score}
                        </span>
                        <span className="change-chip change-BASELINE">{f.tasting_outcome || f.activity_type}</span>
                        {f.current_sod_status === 'D' && (
                          <span className="change-chip change-DELISTED">SOD: Delisting</span>
                        )}
                        {f.current_sod_status === 'F' && (
                          <span className="change-chip change-DELISTED">SOD: Fully Delisted</span>
                        )}
                        {!f.current_sod_status && (
                          <span className="change-chip change-BASELINE">SOD: missing</span>
                        )}
                        <span
                          className="change-chip"
                          style={{
                            background: f.territory_color + '33',
                            color: f.territory_color,
                          }}
                        >
                          {f.territory_name}
                        </span>
                      </div>
                      <div className="font-semibold text-base">
                        #{f.store_number} · {f.account ?? '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {f.brand} {f.product_name} · {f.city}{' '}
                        {f.rep ? `· last seen by ${f.rep}` : ''}
                      </div>
                      {f.activity_notes && (
                        <div className="text-xs text-muted mt-1.5 italic line-clamp-2">
                          &ldquo;{f.activity_notes}&rdquo;
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted flex items-center gap-1 justify-end">
                        <Clock size={11} />
                        {f.days_since_tasting != null ? `${f.days_since_tasting}d ago` : '—'}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">
                        {formatDate(f.tasting_date)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

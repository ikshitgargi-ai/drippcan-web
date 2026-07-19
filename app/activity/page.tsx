'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Activity as ActivityIcon, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useActiveRep } from '@/lib/active-rep';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { relativeTime } from '@/lib/utils';

export default function ActivityFeedPage() {
  const [activeRep] = useActiveRep();
  const [scope, setScope] = useState<'me' | 'team'>('team');
  const [days, setDays] = useState(14);

  const feed = useQuery({
    queryKey: ['activities', { rep: scope === 'me' ? activeRep : undefined, days }],
    queryFn: () => api.activities({ rep: scope === 'me' ? activeRep ?? undefined : undefined, days }),
  });

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ActivityIcon size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">
            Activity feed
          </span>
        </div>
        <h1>Activity</h1>
        <p className="text-muted text-sm">
          Every visit, tasting, sample drop, call, email logged in the last {days} days.
        </p>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <button
          onClick={() => setScope('team')}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-11 ${
            scope === 'team'
              ? 'bg-[var(--color-accent)] text-[var(--color-primary-fg)]'
              : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
          }`}
        >
          Whole team
        </button>
        <button
          onClick={() => setScope('me')}
          disabled={!activeRep}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-11 ${
            scope === 'me' && activeRep
              ? 'bg-[var(--color-accent)] text-[var(--color-primary-fg)]'
              : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
          } ${!activeRep ? 'opacity-50' : ''}`}
        >
          <User size={14} className="inline mr-1" />
          {activeRep ? `Just ${activeRep}` : 'Pick a rep'}
        </button>
        {([7, 14, 30, 60] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium min-h-11 ${
              days === d
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{feed.data?.activities.length ?? 0} activities</CardTitle>
          <CardDescription>
            Most recent first. Tap a store to drill in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {feed.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            {feed.data?.activities.length === 0 && !feed.isLoading && (
              <div className="text-center py-12 text-muted">
                No activities logged in this window. Use{' '}
                <Link href="/log" className="text-[var(--color-accent)] underline">
                  /log
                </Link>{' '}
                to add one.
              </div>
            )}
            {feed.data?.activities.map((a) => (
              <div key={a.id} className="m-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="change-chip change-BASELINE">{a.activity_type}</span>
                      {a.rating > 0 && (
                        <span className="change-chip change-NEW_LISTING">
                          {'★'.repeat(a.rating)}
                        </span>
                      )}
                    </div>
                    {a.account ? (
                      <Link
                        href={`/stores/${a.store_number}`}
                        className="font-semibold hover:text-[var(--color-accent)]"
                      >
                        #{a.store_number} · {a.account}
                      </Link>
                    ) : a.horeca_name ? (
                      <span className="font-semibold">{a.horeca_name}</span>
                    ) : (
                      <span className="text-muted">Unknown location</span>
                    )}
                    {a.outcome && (
                      <div className="text-sm font-medium mt-1">{a.outcome}</div>
                    )}
                    {a.notes && (
                      <div className="text-xs text-muted mt-1 whitespace-pre-wrap">
                        {a.notes}
                      </div>
                    )}
                    <div className="text-xs text-muted mt-2 flex items-center gap-2 flex-wrap">
                      {a.rep && <span>by {a.rep}</span>}
                      {a.duration_minutes > 0 && <span>· {a.duration_minutes} min</span>}
                      {a.next_action && <span>· next: {a.next_action}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted shrink-0">
                    {relativeTime(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

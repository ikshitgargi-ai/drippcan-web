'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Calendar, MapPin, User, Activity, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyLogPage() {
  const [date, setDate] = useState(todayISO());
  const [days, setDays] = useState(1);
  const log = useQuery({
    queryKey: ['daily-log', date, days],
    queryFn: () => api.dailyLog({ date, days }),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4 pb-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Activity size={24} className="text-[var(--color-accent)]" />
          Daily Log
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Every activity logged today (or any window). Auto-refreshes every 30s.
        </p>
      </header>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="select"
          />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="select"
          >
            <option value={1}>Just this day</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
          </select>
          <button
            onClick={() => setDate(todayISO())}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-card)] border border-[var(--color-card-border)]"
          >
            Today
          </button>
        </CardContent>
      </Card>

      {log.data?.by_rep && log.data.by_rep.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By rep</CardTitle>
            <CardDescription>{log.data.count} total in window</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {log.data.by_rep.map((r) => (
                <div
                  key={r.rep}
                  className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
                >
                  <div className="font-semibold text-sm">{r.rep}</div>
                  <div className="text-2xl font-bold tabular-nums">{r.count}</div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">
                    {r.stores_visited} stores
                  </div>
                  <div className="text-[10px] text-muted mt-1">
                    {Object.entries(r.by_type)
                      .map(([t, n]) => `${t}:${n}`)
                      .join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {log.isLoading && (
            <div className="text-center text-muted py-6">Loading…</div>
          )}
          {log.data?.activities.length === 0 && (
            <div className="text-center text-muted py-8">No activities logged in this window.</div>
          )}
          <div className="space-y-2">
            {log.data?.activities.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
              >
                <div
                  className="w-1 self-stretch rounded-full"
                  style={{ background: a.territory_color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/stores/${a.store_number}`}
                      className="font-semibold text-sm hover:text-[var(--color-accent)]"
                    >
                      #{a.store_number} · {a.account || '—'}
                    </Link>
                    <span className="change-chip change-BASELINE text-[10px]">
                      {a.activity_type}
                    </span>
                    {a.outcome && (
                      <span className="change-chip change-NEW_LISTING text-[10px]">
                        {a.outcome}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <User size={11} /> {a.rep || '—'}
                    {a.city && (
                      <>
                        <MapPin size={11} /> {a.city}
                      </>
                    )}
                    {a.duration_minutes > 0 && <span>{a.duration_minutes}m</span>}
                    {a.rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={11} /> {a.rating}/5
                      </span>
                    )}
                  </div>
                  {a.notes && (
                    <div className="text-xs mt-1 italic text-[var(--color-foreground)]">
                      {a.notes}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-muted shrink-0 text-right">
                  {a.created_at && (
                    <div>{new Date(a.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</div>
                  )}
                  {a.visit_date && a.visit_date !== a.created_at?.slice(0, 10) && (
                    <div className="text-[var(--color-warning)]">
                      visit: {a.visit_date}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

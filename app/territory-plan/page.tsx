'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Map, Calendar, MapPin, Phone, User, Navigation, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const ROUTES = [
  { rep: 'Ikshit', label: 'Ikshit — GTA', emoji: '🏙️' },
  { rep: 'Vaneet', label: 'Vaneet — GTA', emoji: '🏙️' },
  { rep: 'Ed', label: 'Ed — GTA', emoji: '🏙️' },
  { rep: 'Namit', label: 'Namit — GTA', emoji: '🏙️' },
];

export default function TerritoryPlanPage() {
  const [rep, setRep] = useState('Ikshit');
  const [maxPerDay, setMaxPerDay] = useState(9);
  const plan = useQuery({
    queryKey: ['territory-plan', rep, maxPerDay],
    queryFn: () => api.territoryPlan(rep, 14, maxPerDay),
  });

  const buildMapsUrl = (stops: typeof plan.data extends { plan: infer P } ? never : never, _ignore?: never) => '';

  const dayMapsUrl = useMemo(
    () => (stops: { lat: number; lng: number }[]) => {
      const valid = stops.filter((s) => s.lat && s.lng);
      if (valid.length === 0) return '';
      if (valid.length === 1) {
        return `https://www.google.com/maps/dir/?api=1&destination=${valid[0].lat},${valid[0].lng}`;
      }
      const origin = `${valid[0].lat},${valid[0].lng}`;
      const destination = `${valid[valid.length - 1].lat},${valid[valid.length - 1].lng}`;
      const waypoints = valid.slice(1, -1).map((s) => `${s.lat},${s.lng}`).join('|');
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}`;
    },
    [],
  );

  return (
    <div className="space-y-4 pb-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Map size={24} className="text-[var(--color-accent)]" />
          14-Day Territory Plan
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Geo-clustered, fuel-efficient daily routes. Each day groups stores by
          postal FSA, then runs nearest-neighbor TSP within the cluster.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {ROUTES.map((r) => (
          <button
            key={r.rep}
            onClick={() => setRep(r.rep)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm ${
              rep === r.rep
                ? 'bg-[var(--color-accent)] text-[var(--color-primary-fg)]'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            {r.emoji} {r.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted">Max stops/day:</span>
          <select
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
            className="select text-xs"
          >
            {[7, 8, 9, 10, 11, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {plan.data && (
        <Card>
          <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Territory" value={plan.data.territory_name} />
            <Stat label="Stores in territory" value={String(plan.data.total_stores_in_territory)} />
            <Stat label="In 14-day plan" value={String(plan.data.stores_in_plan)} />
            <Stat label="Days planned" value={String(plan.data.days_in_plan)} />
          </CardContent>
        </Card>
      )}

      {plan.isLoading && <div className="text-center py-8 text-muted">Building plan…</div>}

      <div className="space-y-3">
        {plan.data?.plan.map((day) => {
          const mapsUrl = dayMapsUrl(day.stores);
          return (
            <Card key={day.day}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar size={16} />
                      Day {day.day} —{' '}
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('en-CA', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </CardTitle>
                    <CardDescription>
                      {day.stops} stops · ~{day.total_km_est} km · {day.cluster_label}
                    </CardDescription>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary-fg)] text-xs font-semibold flex items-center gap-1"
                    >
                      <Navigation size={12} /> Open all stops in Google Maps
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {day.stores.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold shrink-0"
                        style={{
                          background: s.territory_color + '33',
                          color: s.territory_color,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/stores/${s.store_number}`}
                            className="font-semibold text-sm hover:text-[var(--color-accent)]"
                          >
                            #{s.store_number} · {s.account || '—'}
                          </Link>
                          {s.priority && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-card)]">
                              {s.priority}
                            </span>
                          )}
                          {s.leg_km != null && i > 0 && (
                            <span className="text-[10px] text-muted">+{s.leg_km}km</span>
                          )}
                        </div>
                        {s.address && (
                          <div className="text-xs text-muted flex items-start gap-1 mt-0.5">
                            <MapPin size={11} className="shrink-0 mt-0.5" />
                            <span>
                              {s.address}, {s.city} {s.postal}
                            </span>
                          </div>
                        )}
                        {(s.manager_name || s.phone) && (
                          <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                            {s.manager_name && (
                              <span className="flex items-center gap-1">
                                <User size={11} />
                                {s.manager_name}
                              </span>
                            )}
                            {s.phone && (
                              <a
                                href={`tel:${s.phone.replace(/[^0-9+]/g, '')}`}
                                className="flex items-center gap-1 text-[var(--color-accent)]"
                              >
                                <Phone size={11} />
                                {s.phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Link
                          href={`/stores/${s.store_number}`}
                          className="text-[var(--color-accent)] text-xs hover:underline flex items-center gap-1"
                        >
                          Open <ExternalLink size={10} />
                        </Link>
                        {s.lat !== 0 && s.lng !== 0 && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted text-xs hover:text-[var(--color-accent)]"
                          >
                            Drive
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

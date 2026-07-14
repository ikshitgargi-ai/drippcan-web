'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Search,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Activity,
  Briefcase,
  ExternalLink,
  Filter,
  Loader2,
} from 'lucide-react';
import { api, type FinderStore } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FreshnessBanner } from '@/components/freshness-banner';

const REPS = ['Ikshit', 'Virat', 'Namit', 'Surya', 'Neeraj'];

function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function staleClass(iso: string | null): string {
  if (!iso) return 'text-[var(--color-muted)]';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return 'text-[var(--color-success)]';
  if (days <= 30) return 'text-[var(--color-foreground)]';
  if (days <= 90) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-danger)]';
}

export default function FinderPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filterRep, setFilterRep] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [sortBy, setSortBy] = useState<'last_activity' | 'store_number' | 'account' | 'city' | 'open_deals'>(
    'last_activity',
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const finder = useQuery({
    queryKey: ['stores-finder', filterRep, filterCity, filterPriority],
    queryFn: () =>
      api.storesFinder({
        rep: filterRep || undefined,
        city: filterCity || undefined,
        priority: filterPriority || undefined,
      }),
    refetchInterval: 60_000,
  });

  // Local search across the loaded list (faster than re-querying backend per keystroke)
  const filtered = useMemo<FinderStore[]>(() => {
    const stores = finder.data?.stores ?? [];
    let out = stores;
    if (debounced) {
      out = out.filter((s) => {
        const haystack = `${s.store_number} ${s.account} ${s.address} ${s.city} ${s.postal} ${s.manager_name} ${s.rep} ${s.last_activity_notes}`.toLowerCase();
        return haystack.includes(debounced);
      });
    }
    out = [...out];
    out.sort((a, b) => {
      switch (sortBy) {
        case 'store_number':
          return a.store_number - b.store_number;
        case 'account':
          return (a.account || '').localeCompare(b.account || '');
        case 'city':
          return (a.city || '').localeCompare(b.city || '') || a.store_number - b.store_number;
        case 'open_deals':
          return b.open_deals - a.open_deals;
        case 'last_activity':
        default: {
          const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          return bt - at;
        }
      }
    });
    return out;
  }, [finder.data, debounced, sortBy]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    (finder.data?.stores ?? []).forEach((s) => s.city && set.add(s.city));
    return Array.from(set).sort();
  }, [finder.data]);

  const stats = useMemo(() => {
    const stores = finder.data?.stores ?? [];
    const withActivity = stores.filter((s) => s.last_activity_at).length;
    const stale90 = stores.filter((s) => {
      if (!s.last_activity_at) return true;
      const days = (Date.now() - new Date(s.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
      return days > 90;
    }).length;
    const openDeals = stores.reduce((sum, s) => sum + s.open_deals, 0);
    return { total: stores.length, withActivity, stale90, openDeals };
  }, [finder.data]);

  return (
    <div className="space-y-4 pb-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Search size={24} className="text-[var(--color-accent)]" />
          Store Finder
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Full directory of all {stats.total} LCBO stores. Search by number, name, address, city,
          manager, postal code, or last conversation.
        </p>
      </header>

      <FreshnessBanner />

      {/* Search bar */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by # / name / address / manager / postal…"
              className="select pl-9 w-full text-base"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <Filter size={12} className="text-[var(--color-muted)]" />
            <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} className="select text-xs">
              <option value="">All reps</option>
              {REPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="select text-xs">
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="select text-xs">
              <option value="">All priorities</option>
              <option value="A">A — Top</option>
              <option value="B">B — Strong</option>
              <option value="C">C — Standard</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="select text-xs">
              <option value="last_activity">Sort: most recent activity</option>
              <option value="store_number">Sort: store number</option>
              <option value="account">Sort: name (A–Z)</option>
              <option value="city">Sort: city</option>
              <option value="open_deals">Sort: open deals</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Showing" value={filtered.length.toLocaleString()} />
        <Stat label="With activity" value={stats.withActivity.toLocaleString()} color="var(--color-success)" />
        <Stat label="Stale > 90d" value={stats.stale90.toLocaleString()} color="var(--color-warning)" />
        <Stat label="Open deals" value={stats.openDeals.toLocaleString()} color="var(--color-accent)" />
      </div>

      {/* Results */}
      {finder.isLoading && (
        <div className="text-center py-8 text-[var(--color-muted)]">
          <Loader2 size={20} className="animate-spin inline" /> Loading directory…
        </div>
      )}
      {finder.error && (
        <div className="m-card border-[var(--color-danger)]/40 text-sm text-[var(--color-danger)]">
          Error: {(finder.error as Error).message}
        </div>
      )}
      {!finder.isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--color-muted)]">
          No stores match. Try clearing filters.
        </div>
      )}
      <div className="space-y-2">
        {filtered.slice(0, 250).map((s) => (
          <StoreRow key={s.id} s={s} />
        ))}
        {filtered.length > 250 && (
          <div className="text-center py-3 text-xs text-[var(--color-muted)]">
            Showing top 250 of {filtered.length.toLocaleString()} matches. Refine search to narrow.
          </div>
        )}
      </div>
    </div>
  );
}

function StoreRow({ s }: { s: FinderStore }) {
  return (
    <div className="flex items-stretch gap-3 p-3 rounded-lg border border-[var(--color-card-border)] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <div className="w-1 self-stretch rounded-full" style={{ background: s.territory_color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/stores/${s.store_number}`}
            className="font-semibold text-sm hover:text-[var(--color-accent)]"
          >
            #{s.store_number} · {s.account || '—'}
          </Link>
          {s.priority && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-card)] text-[var(--color-muted)]">
              {s.priority}
            </span>
          )}
          {s.rep && (
            <span className="text-[10px] text-[var(--color-muted)]">· {s.rep}</span>
          )}
          {s.open_deals > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(212,165,116,0.15)] text-[var(--color-accent)] flex items-center gap-1">
              <Briefcase size={9} />
              {s.open_deals} open
            </span>
          )}
        </div>
        {s.address && (
          <div className="text-xs text-[var(--color-muted)] flex items-start gap-1 mt-1">
            <MapPin size={11} className="shrink-0 mt-0.5" />
            <span>
              {s.address}
              {s.city ? `, ${s.city}` : ''}
              {s.postal ? ` ${s.postal}` : ''}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-[var(--color-muted)]">
          {s.manager_name && (
            <span className="flex items-center gap-1">
              <User size={11} />
              {s.manager_name}
            </span>
          )}
          {(s.manager_phone || s.phone) && (
            <a
              href={`tel:${(s.manager_phone || s.phone).replace(/[^0-9+]/g, '')}`}
              className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              <Phone size={11} />
              {s.manager_phone || s.phone}
            </a>
          )}
          {s.store_email && (
            <a
              href={`mailto:${s.store_email}`}
              className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              <Mail size={11} />
              {s.store_email}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Activity size={11} />
            {s.total_activities} activities
          </span>
        </div>
        {s.last_activity_at ? (
          <div className={`text-xs mt-1 ${staleClass(s.last_activity_at)} flex items-start gap-1`}>
            <Calendar size={11} className="shrink-0 mt-0.5" />
            <span>
              <strong>Last:</strong>{' '}
              {s.last_activity_type ? `${s.last_activity_type}` : 'visit'}
              {s.last_activity_rep ? ` · ${s.last_activity_rep}` : ''}
              {' · '}
              {daysAgo(s.last_activity_at)}
              {s.last_activity_notes ? (
                <span className="text-[var(--color-muted)] italic">
                  {' '}
                  — {s.last_activity_notes.slice(0, 140)}
                  {s.last_activity_notes.length > 140 ? '…' : ''}
                </span>
              ) : null}
            </span>
          </div>
        ) : (
          <div className="text-xs text-[var(--color-muted)] mt-1">
            <Calendar size={11} className="inline mr-1" />
            No activity logged yet
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-center gap-1 shrink-0">
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
            className="text-[var(--color-muted)] text-xs hover:text-[var(--color-accent)]"
          >
            Drive
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="m-card">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-semibold">
        {label}
      </div>
      <div
        className="text-2xl font-bold tabular-nums mt-1"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}

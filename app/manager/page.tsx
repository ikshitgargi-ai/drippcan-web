'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  Globe2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  Activity as ActivityIcon,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  X as XIcon,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type ManagerRepRow, type ManagerTerritoryRow } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FreshnessBanner } from '@/components/freshness-banner';
import { formatNumber } from '@/lib/utils';

type SortKey =
  | 'rep'
  | 'store_count'
  | 'gap_count'
  | 'activities_30d'
  | 'visits_30d'
  | 'listings_won_60d'
  | 'new_stores_60d'
  | 'delistings_60d';

/**
 * /manager — single command center for managers / Anu HQ.
 * Mobile-first: KPI tiles top, scoreboard middle, territory builder + gap detail bottom.
 */
export default function ManagerPage() {
  const [tab, setTab] = useState<'scoreboard' | 'territories' | 'gaps'>('scoreboard');
  const [sortKey, setSortKey] = useState<SortKey>('listings_won_60d');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const dash = useQuery({
    queryKey: ['manager-dashboard'],
    queryFn: () => api.managerDashboard(),
    refetchInterval: 60_000,
  });

  const sortedReps = useMemo(() => {
    const reps = [...(dash.data?.reps ?? [])];
    reps.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''));
    });
    return reps;
  }, [dash.data, sortKey, sortAsc]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Manager</span>
        </div>
        <h1>Team Command Center</h1>
        <p className="text-muted text-sm">
          Per-rep performance, territory builder, gap reports, listings/delistings tracker.
          Auto-refreshes every 60s.
        </p>
      </header>

      <FreshnessBanner />

      {/* TOP KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigKpi
          label="Reps"
          value={dash.data?.totals.reps ?? '—'}
          icon={<Users size={16} />}
          color="var(--color-accent)"
        />
        <BigKpi
          label="Stores Covered"
          value={formatNumber(dash.data?.totals.total_stores ?? 0)}
          icon={<Globe2 size={16} />}
        />
        <BigKpi
          label="New Listings 60d"
          value={dash.data?.totals.total_listings_won_60d ?? '—'}
          color="var(--color-success)"
          icon={<TrendingUp size={16} />}
        />
        <BigKpi
          label="Delistings 60d"
          value={dash.data?.totals.total_delistings_60d ?? '—'}
          color={(dash.data?.totals.total_delistings_60d ?? 0) > 0 ? 'var(--color-warning)' : 'var(--color-muted)'}
          icon={<TrendingDown size={16} />}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigKpi
          label="Open Gaps"
          value={formatNumber(dash.data?.totals.total_gap ?? 0)}
          color="var(--color-danger)"
          icon={<AlertTriangle size={16} />}
        />
        <BigKpi
          label="Activities 30d"
          value={formatNumber(dash.data?.totals.total_activities_30d ?? 0)}
          icon={<ActivityIcon size={16} />}
          color="#74b9ff"
        />
        <BigKpi
          label="New Stores 60d"
          value={formatNumber(dash.data?.totals.total_new_stores_60d ?? 0)}
          color="var(--color-success)"
        />
        <BigKpi
          label="Territories"
          value={dash.data?.totals.territories ?? '—'}
          color="var(--color-accent)"
        />
      </div>

      {/* TAB STRIP */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {(
          [
            { key: 'scoreboard' as const, label: 'Rep Scoreboard', icon: Users },
            { key: 'territories' as const, label: 'Territories', icon: Globe2 },
            { key: 'gaps' as const, label: 'Gap Drilldown', icon: AlertTriangle },
          ]
        ).map((t) => {
          const Icon = t.icon;
          const sel = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold min-h-11 ${
                sel
                  ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
                  : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB: Scoreboard */}
      {tab === 'scoreboard' && (
        <Card>
          <CardHeader>
            <CardTitle>Rep Scoreboard</CardTitle>
            <CardDescription>
              Tap a column to sort. Tap a rep row to expand details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="space-y-2.5 lg:hidden">
              {sortedReps.map((r) => (
                <RepCard
                  key={r.rep}
                  rep={r}
                  expanded={expanded === r.rep}
                  onToggle={() => setExpanded(expanded === r.rep ? null : r.rep)}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto -mx-4 sm:mx-0">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <SortHead label="Rep" k="rep" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                    <SortHead label="Stores" k="store_count" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                    <SortHead label="Gap" k="gap_count" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                    <SortHead label="Activities 30d" k="activities_30d" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                    <SortHead label="Visits 30d" k="visits_30d" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                    <SortHead label="Listings Won 60d" k="listings_won_60d" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                    <SortHead label="New Stores 60d" k="new_stores_60d" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                    <SortHead label="Delistings 60d" k="delistings_60d" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} right />
                  </tr>
                </thead>
                <tbody>
                  {sortedReps.map((r) => (
                    <tr key={r.rep}>
                      <td className="font-semibold">{r.rep}</td>
                      <td className="text-right tabular-nums">{r.store_count}</td>
                      <td className="text-right tabular-nums">
                        <span style={{ color: r.gap_pct && r.gap_pct > 50 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                          {r.gap_count}
                        </span>
                        {r.gap_pct != null && (
                          <span className="text-xs text-muted ml-1">({r.gap_pct}%)</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {r.activities_30d}
                        {r.pct_quota_activities != null && (
                          <span
                            className="text-xs ml-1"
                            style={{
                              color:
                                r.pct_quota_activities >= 100
                                  ? 'var(--color-success)'
                                  : r.pct_quota_activities >= 75
                                    ? '#a3d977'
                                    : 'var(--color-warning)',
                            }}
                          >
                            ({r.pct_quota_activities}%)
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{r.visits_30d}</td>
                      <td className="text-right tabular-nums">
                        <span style={{ color: r.listings_won_60d > 0 ? 'var(--color-success)' : undefined }}>
                          {r.listings_won_60d}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">
                        <span style={{ color: r.new_stores_60d > 0 ? 'var(--color-accent)' : undefined }}>
                          {r.new_stores_60d}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">
                        <span style={{ color: r.delistings_60d > 0 ? 'var(--color-danger)' : undefined }}>
                          {r.delistings_60d}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sortedReps.length === 0 && (
              <div className="text-center py-12 text-muted text-sm">
                No reps assigned to stores. Set <code className="text-xs">stores.rep</code> in
                the Stores table to start tracking.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Territories */}
      {tab === 'territories' && (
        <TerritoriesTab
          territories={dash.data?.territories ?? []}
          reps={dash.data?.reps ?? []}
        />
      )}

      {/* TAB: Gap Drilldown */}
      {tab === 'gaps' && (
        <GapDrilldown reps={sortedReps} />
      )}
    </div>
  );
}

function BigKpi({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="m-card">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
        <span>{label}</span>
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

function SortHead({
  label,
  k,
  sortKey,
  sortAsc,
  onSort,
  right,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th className={right ? 'text-right' : ''}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 ${active ? 'text-[var(--color-accent)]' : ''}`}
      >
        {label}
        {active && (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </button>
    </th>
  );
}

function RepCard({
  rep,
  expanded,
  onToggle,
}: {
  rep: ManagerRepRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="m-card">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="font-semibold text-base">{rep.rep}</div>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Mini label="Stores" value={rep.store_count} />
          <Mini
            label="Gap"
            value={rep.gap_count}
            color={
              rep.gap_pct && rep.gap_pct > 50
                ? 'var(--color-danger)'
                : rep.gap_pct && rep.gap_pct > 25
                  ? 'var(--color-warning)'
                  : undefined
            }
          />
          <Mini
            label="Won 60d"
            value={rep.listings_won_60d}
            color={rep.listings_won_60d > 0 ? 'var(--color-success)' : undefined}
          />
          <Mini
            label="Delisted"
            value={rep.delistings_60d}
            color={rep.delistings_60d > 0 ? 'var(--color-danger)' : undefined}
          />
        </div>
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-card-border)] space-y-2">
          <Row label="Visits 30d" value={`${rep.visits_30d}${rep.quota_visits ? ` / ${rep.quota_visits}` : ''}`} pct={rep.pct_quota_visits} />
          <Row label="Tastings 30d" value={rep.tastings_30d} />
          <Row label="Calls + emails 30d" value={rep.outreach_30d} />
          <Row
            label="Activities 30d"
            value={`${rep.activities_30d}${rep.quota_activities ? ` / ${rep.quota_activities}` : ''}`}
            pct={rep.pct_quota_activities}
          />
          <Row label="New stores 60d" value={rep.new_stores_60d} />
          <Row label="Gap %" value={rep.gap_pct != null ? `${rep.gap_pct}%` : '—'} />
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div
        className="text-base font-bold tabular-nums mt-0.5"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  pct,
}: {
  label: string;
  value: number | string;
  pct?: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums">
        {value}
        {pct != null && (
          <span
            className="text-xs ml-2"
            style={{
              color:
                pct >= 100
                  ? 'var(--color-success)'
                  : pct >= 75
                    ? '#a3d977'
                    : pct >= 50
                      ? 'var(--color-warning)'
                      : 'var(--color-danger)',
            }}
          >
            {pct}%
          </span>
        )}
      </span>
    </div>
  );
}

function TerritoriesTab({
  territories,
  reps,
}: {
  territories: ManagerTerritoryRow[];
  reps: ManagerRepRow[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<number | null>(null);
  const [draftRep, setDraftRep] = useState('');

  const roster = useQuery({ queryKey: ['roster'], queryFn: api.roster });
  const officialRoster = roster.data?.roster ?? ['Ikshit', 'Virat', 'Namit', 'Surya', 'Neeraj'];

  // Picker shows the official roster + any rep currently in stores
  const allRepNames = Array.from(new Set([
    ...officialRoster,
    ...reps.map((r) => r.rep),
  ])).sort();

  const update = useMutation({
    mutationFn: (vars: { id: number; rep: string }) =>
      api.assignStoresToTerritory(vars.id, { store_numbers: [], rep_name: vars.rep }),
    onSuccess: () => {
      toast.success('Territory updated');
      qc.invalidateQueries({ queryKey: ['manager-dashboard'] });
      qc.invalidateQueries({ queryKey: ['territories'] });
      setEditing(null);
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const resetRoster = useMutation({
    mutationFn: () => api.setRoster({}),
    onSuccess: (r) => {
      toast.success(
        `Reset complete. Cleared ${r.cleared_stores_count} non-roster reps. ${r.territories_reset_to_placeholder} territories now use placeholder.`,
      );
      qc.invalidateQueries({ queryKey: ['manager-dashboard'] });
      qc.invalidateQueries({ queryKey: ['territories'] });
      qc.invalidateQueries({ queryKey: ['reps'] });
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const grouped = territories.reduce<Record<string, ManagerTerritoryRow[]>>((acc, t) => {
    const r = t.region || 'Other';
    (acc[r] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Territory Builder</CardTitle>
            <CardDescription>
              Assign a rep to each territory. Official roster:{' '}
              <span className="font-semibold text-[var(--color-foreground)]">
                {officialRoster.join(' · ')}
              </span>
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (
                confirm(
                  `Reset roster to ${officialRoster.join(', ')}?\n\nThis clears any non-roster rep assignment from stores and labels unassigned territories as 'New Rep 1'. Activities and historical data are preserved.`,
                )
              ) {
                resetRoster.mutate();
              }
            }}
            disabled={resetRoster.isPending}
          >
            <RefreshCw size={14} className={resetRoster.isPending ? 'animate-spin' : ''} />
            {resetRoster.isPending ? 'Resetting…' : 'Reset to roster'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(grouped).map(([region, list]) => (
            <div key={region}>
              <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                {region}
              </div>
              <div className="space-y-2">
                {list.map((t) => (
                  <div
                    key={t.id}
                    className="m-card flex items-start gap-3"
                  >
                    <div
                      className="w-1 self-stretch rounded-full shrink-0 min-h-[40px]"
                      style={{ background: t.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted">
                        {t.store_count} store{t.store_count === 1 ? '' : 's'} ·{' '}
                        <span className="font-mono">{t.code}</span>
                      </div>
                      {editing === t.id ? (
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={draftRep}
                            onChange={(e) => setDraftRep(e.target.value)}
                            className="select text-xs flex-1"
                          >
                            <option value="">— pick rep —</option>
                            {allRepNames.map((name) => (
                              <option key={name} value={name}>
                                {name}
                                {officialRoster.includes(name) ? ' ★' : ''}
                              </option>
                            ))}
                            <option value="New Rep 1">New Rep 1 (placeholder)</option>
                          </select>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => update.mutate({ id: t.id, rep: draftRep })}
                            disabled={!draftRep || update.isPending}
                          >
                            <Save size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditing(null)}
                          >
                            <XIcon size={12} />
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs">
                            Rep:{' '}
                            <span className="font-medium">
                              {t.rep_name || (
                                <span className="text-muted italic">unassigned</span>
                              )}
                            </span>
                          </span>
                          <button
                            onClick={() => {
                              setEditing(t.id);
                              setDraftRep(t.rep_name || '');
                            }}
                            className="text-xs text-[var(--color-accent)] flex items-center gap-1"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GapDrilldown({ reps }: { reps: ManagerRepRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gap by Rep</CardTitle>
        <CardDescription>
          Stores in each rep&apos;s book where ZERO of our 8 SKUs are currently listed.
          Tap a rep to drill into their gap stores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {reps
            .slice()
            .sort((a, b) => b.gap_count - a.gap_count)
            .map((r) => (
              <Link
                key={r.rep}
                href={`/intel?rep=${encodeURIComponent(r.rep)}`}
                className="block m-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{r.rep}</div>
                    <div className="text-xs text-muted">
                      {r.store_count} stores ·{' '}
                      {r.gap_pct != null ? `${r.gap_pct}% gap` : '—'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted">Gap</div>
                    <div
                      className="text-2xl font-bold tabular-nums"
                      style={{
                        color:
                          r.gap_pct && r.gap_pct > 50
                            ? 'var(--color-danger)'
                            : r.gap_pct && r.gap_pct > 25
                              ? 'var(--color-warning)'
                              : 'var(--color-foreground)',
                      }}
                    >
                      {r.gap_count}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          {reps.length === 0 && (
            <div className="text-center py-12 text-muted text-sm">
              No reps assigned. Use the Territories tab to set rep_name on each territory.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

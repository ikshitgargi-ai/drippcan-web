'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Download,
  Users,
  AlertTriangle,
  Activity as ActivityIcon,
  RefreshCw,
  ExternalLink,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { api } from '@/lib/api';
import { REP_ROSTER } from '@/lib/reps';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';

/**
 * Exports — one-click bundle of every CSV in the system, plus a
 * rep-behavior analytics view that flags reps revisiting the same
 * stores or going dormant. The download is meant to feed into AI
 * analysis so the operator can run "are reps actually working?" checks.
 */
export default function ExportsPage() {
  return <ExportsInner />;
}

function ExportsInner() {
  const [days, setDays] = useState(90);
  const [includeSod, setIncludeSod] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [behaviorWindow, setBehaviorWindow] = useState(30);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  const exportUrl =
    apiBase +
    `/api/admin/export/everything?days=${days}` +
    `&include_sod=${includeSod ? '1' : '0'}` +
    `&include_history=${includeHistory ? '1' : '0'}`;

  const behavior = useQuery({
    queryKey: ['rep-behavior', behaviorWindow],
    queryFn: () => api.repBehavior({ days: behaviorWindow }),
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Download size={24} className="text-[var(--color-accent)]" />
          Data Exports & Rep Behavior
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          One-click download of every CSV in the system + a rep-behavior audit.
          Drop the ZIP into ChatGPT or Claude to ask &quot;are reps actually
          working or visiting the same stores repeatedly?&quot;
        </p>
      </header>

      {/* Download bundle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Download everything (CSV bundle)</CardTitle>
          <CardDescription>
            One ZIP with stores, activities, deals, follow-ups, rep observations,
            SOD inventory, listing changes, and an event log — plus a README
            with suggested AI prompts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={`Time window: ${days} days`}>
              <input
                type="range"
                min={7}
                max={365}
                step={7}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field label="Include SOD inventory snapshot">
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={includeSod}
                  onChange={(e) => setIncludeSod(e.target.checked)}
                />
                sod_inventory + listing_changes (recommended)
              </label>
            </Field>
            <Field label="Include lcbo.com inventory history (LARGE)">
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                />
                inventory_history (per-store-per-scrape)
              </label>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
            >
              <Download size={14} />
              Download ZIP
            </a>
            <a
              href={apiBase + '/api/admin/export?include=core'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[var(--color-card-border)] hover:bg-[var(--color-card)] text-sm"
            >
              <ExternalLink size={14} />
              Or grab the legacy JSON dump
            </a>
          </div>
          <div className="m-card flex items-start gap-3 border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
            <Sparkles size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            <div className="text-xs text-muted">
              <strong>Suggested AI prompt</strong> (paste the ZIP into ChatGPT/Claude):
              <pre className="bg-[#0a0c10] p-3 rounded mt-2 text-[11px] whitespace-pre-wrap">
{`Using activities.csv and stores.csv, for each rep compute:
- total visits in last 30 days
- unique stores
- repeat-visit ratio
- top 5 most-visited stores with visit count
- days_since_last_visit
- territory coverage % (unique_stores / count of stores where rep matches)

Flag any rep with:
- 14+ days since last visit
- repeat-visit ratio > 50%
- coverage < 30%
- 30+ visits but 0 deals reaching stage='listed'

Return a markdown table sorted by total visits descending.`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rep behavior summary (live, no download needed) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={16} className="text-[var(--color-accent)]" />
            Rep behavior — live audit
          </CardTitle>
          <CardDescription>
            Per-rep metrics + behavior flags. Updated every 5 minutes.
            Window:{' '}
            <select
              value={behaviorWindow}
              onChange={(e) => setBehaviorWindow(Number(e.target.value))}
              className="select inline-block w-auto ml-2"
            >
              <option value={7}>last 7 days</option>
              <option value={14}>last 14 days</option>
              <option value={30}>last 30 days</option>
              <option value={60}>last 60 days</option>
              <option value={90}>last 90 days</option>
            </select>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global findings */}
          {behavior.data?.global_findings && behavior.data.global_findings.length > 0 && (
            <div className="m-card border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={14}
                  className="text-[var(--color-warning)] shrink-0 mt-0.5"
                />
                <div className="space-y-1 text-xs">
                  {behavior.data.global_findings.map((f, i) => (
                    <div key={i}>{f}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Visits</th>
                  <th>Unique stores</th>
                  <th>Repeat %</th>
                  <th>Active days</th>
                  <th>Days idle</th>
                  <th>Coverage</th>
                  <th>Listings won</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {behavior.data?.per_rep.map((r) => (
                  <tr key={r.rep}>
                    <td className="font-semibold">{r.rep}</td>
                    <td className="tabular-nums">{r.visits_total}</td>
                    <td className="tabular-nums">{r.unique_stores}</td>
                    <td
                      className="tabular-nums"
                      style={{
                        color: r.repeat_visit_pct >= 50 ? 'var(--color-warning)' : undefined,
                      }}
                    >
                      {r.repeat_visit_pct}%
                    </td>
                    <td className="tabular-nums">{r.active_days}</td>
                    <td
                      className="tabular-nums"
                      style={{
                        color:
                          r.days_since_last_visit != null && r.days_since_last_visit >= 14
                            ? 'var(--color-danger)'
                            : undefined,
                      }}
                    >
                      {r.days_since_last_visit ?? '—'}
                    </td>
                    <td className="tabular-nums">
                      {r.coverage_pct != null ? `${r.coverage_pct}%` : '—'}
                    </td>
                    <td className="tabular-nums font-semibold">
                      {r.listings_won_in_window}
                    </td>
                    <td>
                      {r.behavior_flags.length === 0 ? (
                        <span className="text-[var(--color-success)] text-[10px]">✓ OK</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.behavior_flags.map((f) => (
                            <span
                              key={f}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                f === 'stale' || f === 'no_conversion'
                                  ? 'bg-[rgba(239,75,75,0.12)] text-[var(--color-danger)]'
                                  : 'bg-[rgba(253,203,110,0.12)] text-[var(--color-warning)]'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Drill-down: high-repeat stores per rep */}
          {behavior.data?.per_rep.some((r) => r.high_repeat_stores.length > 0) && (
            <div className="space-y-3 pt-2 border-t border-[var(--color-card-border)]">
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                Stores being revisited 3+ times
              </div>
              {behavior.data.per_rep.map((r) =>
                r.high_repeat_stores.length > 0 ? (
                  <div key={r.rep}>
                    <div className="text-xs font-semibold mb-1">
                      {r.rep} — {r.high_repeat_stores.length} stores
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.high_repeat_stores.map((s) => (
                        <Link
                          key={s.store_number}
                          href={`/stores/${s.store_number}`}
                          className="text-xs px-2 py-1 rounded bg-[rgba(253,203,110,0.10)] text-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-[#2a1f0f]"
                          title={`${s.account ?? ''} · ${s.city ?? ''} · last visit ${s.last_visit ?? '—'}`}
                        >
                          #{s.store_number}{' '}
                          <span className="font-mono">×{s.visits}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => behavior.refetch()}
            disabled={behavior.isFetching}
          >
            <RefreshCw size={14} className={behavior.isFetching ? 'animate-spin' : ''} />
            {behavior.isFetching ? 'Refreshing…' : 'Re-run'}
          </Button>
        </CardContent>
      </Card>

      {/* Rep Activity Reports — daily/weekly/monthly downloadable logs */}
      <RepActivityReportCard />

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Other operator views</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { href: '/new-listings', label: 'New Listings', desc: 'Per-SKU snapshot diff over date range' },
            { href: '/sod', label: 'SOD Status', desc: 'Daily ingest health + per-source last-run details' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-card-border)] hover:border-[var(--color-accent)] hover:bg-[rgba(212,165,116,0.04)]"
            >
              <ActivityIcon size={14} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{l.label}</div>
                <div className="text-[10px] text-muted">{l.desc}</div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * RepActivityReportCard — pick a rep + period, preview the rollup, and
 * one-click download the row-level CSV for Excel pivots or AI analysis.
 */
const PERIOD_PRESETS: Array<{ key: string; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_7d', label: 'Last 7d' },
  { key: 'last_30d', label: 'Last 30d' },
  { key: 'last_90d', label: 'Last 90d' },
  { key: 'ytd', label: 'YTD' },
];

function RepActivityReportCard() {
  const [rep, setRep] = useState<string>('');           // '' = all reps
  const [period, setPeriod] = useState<string>('this_week');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const useCustom = !!(start || end);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['rep-activity-report', rep, period, start, end, useCustom],
    queryFn: () =>
      api.repActivityReport({
        rep: rep || undefined,
        period: useCustom ? undefined : period,
        start: useCustom ? start || undefined : undefined,
        end: useCustom ? end || undefined : undefined,
      }),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });

  // Build CSV download URL (mirror current state)
  const csvParams = new URLSearchParams();
  csvParams.set('format', 'csv');
  if (rep) csvParams.set('rep', rep);
  if (useCustom) {
    if (start) csvParams.set('start', start);
    if (end) csvParams.set('end', end);
  } else {
    csvParams.set('period', period);
  }
  const csvUrl = `${apiBase}/api/admin/rep-activity-report?${csvParams.toString()}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays size={16} className="text-[var(--color-accent)]" />
          Rep Activity Reports
        </CardTitle>
        <CardDescription>
          Daily / weekly / monthly activity log per rep — preview here, download
          the row-level CSV for Excel pivots or AI analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Rep">
            <select value={rep} onChange={(e) => setRep(e.target.value)} className="select">
              <option value="">All reps</option>
              {REP_ROSTER.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quick period">
            <select
              value={useCustom ? '' : period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setStart('');
                setEnd('');
              }}
              className="select"
              disabled={useCustom}
            >
              {PERIOD_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Custom start (optional, overrides preset)">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="select"
            />
          </Field>
          <Field label="Custom end">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="select"
              min={start}
            />
          </Field>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Loading…' : 'Re-run'}
          </Button>
          <a
            href={csvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
          >
            <Download size={14} />
            Download CSV
          </a>
          {(start || end) && (
            <button
              onClick={() => {
                setStart('');
                setEnd('');
              }}
              className="text-xs text-muted hover:text-[var(--color-foreground)] underline"
            >
              clear custom range
            </button>
          )}
        </div>

        {/* Window banner */}
        {data?.window && (
          <div className="text-[11px] text-muted">
            Window: <span className="font-mono">{data.window.start}</span> →{' '}
            <span className="font-mono">{data.window.end}</span> ({data.window.days}d) ·{' '}
            <span className="font-semibold text-[var(--color-foreground)]">
              {formatNumber(data.totals.rows)}
            </span>{' '}
            activities · {data.totals.unique_reps} rep
            {data.totals.unique_reps === 1 ? '' : 's'} active ·{' '}
            {data.totals.unique_active_days} active day
            {data.totals.unique_active_days === 1 ? '' : 's'}
          </div>
        )}

        {/* Per-rep summary table */}
        {data?.per_rep_summary && data.per_rep_summary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-xs">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Visits</th>
                  <th>Unique stores</th>
                  <th>Repeat %</th>
                  <th>Activity types</th>
                  <th>First</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {data.per_rep_summary.map((s) => (
                  <tr key={s.rep}>
                    <td className="font-semibold">{s.rep}</td>
                    <td className="tabular-nums">{s.visits}</td>
                    <td className="tabular-nums">{s.unique_stores}</td>
                    <td
                      className="tabular-nums"
                      style={{ color: s.repeat_visit_pct >= 50 ? 'var(--color-warning)' : undefined }}
                    >
                      {s.repeat_visit_pct}%
                    </td>
                    <td className="text-[11px]">
                      {Object.entries(s.activity_types)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 4)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(' · ')}
                    </td>
                    <td className="text-muted text-[10px]">{s.first_at?.slice(0, 16) ?? '—'}</td>
                    <td className="text-muted text-[10px]">{s.last_at?.slice(0, 16) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Daily rollup mini-bars */}
        {data?.daily_rollup && data.daily_rollup.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Visits per day
            </div>
            <div className="flex items-end gap-1 h-12">
              {data.daily_rollup.map((d) => {
                const max = Math.max(...data.daily_rollup.map((x) => x.visits)) || 1;
                const h = Math.max((d.visits / max) * 100, 4);
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.visits} visits`}
                    className="flex-1 min-w-[6px] bg-[var(--color-accent)]/40 hover:bg-[var(--color-accent)] rounded-t"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
            <div className="text-[10px] text-muted mt-1 flex justify-between">
              <span>{data.daily_rollup[0]?.date}</span>
              <span>{data.daily_rollup[data.daily_rollup.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {data && data.totals.rows === 0 && (
          <div className="text-xs text-muted py-4 text-center">
            No activities logged in this window
            {rep ? ` for ${rep}` : ''}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}

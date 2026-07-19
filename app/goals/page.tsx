'use client';

import { useQuery } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNumber, formatDate } from '@/lib/utils';

export default function GoalsPage() {
  const progress = useQuery({ queryKey: ['goals-progress'], queryFn: api.goalsProgress });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Flag size={24} className="text-[var(--color-accent)]" />
          Sales Goals
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Listing &amp; volume targets by SKU, territory, or rep. Progress is live against the
          latest SOD snapshot.
        </p>
      </header>
      <FreshnessBanner />

      <Card>
        <CardHeader>
          <CardTitle>Active goals</CardTitle>
          <CardDescription>
            {progress.data?.length ?? 0} goals in progress. Create new via backend API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="data-table table-to-cards min-w-[900px] sm:min-w-0">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Target</th>
                  <th>Period</th>
                  <th>Listings</th>
                  <th>Units</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {progress.data?.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Scope">
                      <span className="badge">{g.scope}</span>
                    </td>
                    <td data-label="Target" className="font-mono text-xs">
                      {g.scope_key}
                    </td>
                    <td data-label="Period" className="text-xs text-[var(--color-muted)]">
                      {formatDate(g.period_start)} → {formatDate(g.period_end)}
                    </td>
                    <td data-label="Listings">
                      <ProgressBar
                        value={g.achieved_listings}
                        target={g.target_listings}
                        pct={g.pct_listings}
                      />
                    </td>
                    <td data-label="Units">
                      <ProgressBar
                        value={g.achieved_units}
                        target={g.target_units}
                        pct={g.pct_units}
                      />
                    </td>
                    <td data-label="Notes" className="text-xs text-[var(--color-muted)]">
                      {g.notes || '—'}
                    </td>
                  </tr>
                ))}
                {progress.data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[var(--color-muted)]">
                      No active goals. Add via POST /api/crm/goals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressBar({
  value,
  target,
  pct,
}: {
  value: number;
  target: number;
  pct: number | null;
}) {
  if (pct == null) {
    return (
      <span className="text-xs text-[var(--color-muted)]">
        {formatNumber(value)} / {formatNumber(target)}
      </span>
    );
  }
  const color =
    pct >= 100
      ? 'var(--color-success)'
      : pct >= 75
        ? '#4be0bb'
        : pct >= 50
          ? 'var(--color-warning)'
          : pct >= 25
            ? '#ff9a66'
            : 'var(--color-danger)';
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden min-w-[80px]">
        <div className="h-full transition-all" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--color-muted)] whitespace-nowrap">
        {formatNumber(value)}/{formatNumber(target)} · {pct}%
      </span>
    </div>
  );
}

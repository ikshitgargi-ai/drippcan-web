'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber, formatDateTime, relativeTime } from '@/lib/utils';

export default function SodPage() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['sod-status'],
    queryFn: api.sodStatus,
    refetchInterval: 30_000,
  });
  const refresh = useMutation({
    mutationFn: api.sodRefreshSnapshot,
    onSuccess: () => {
      toast.success('Refresh started — checking back in 30s', { duration: 6000 });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['sod-status'] }), 30000);
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <Database size={24} className="text-[var(--color-accent)]" />
            SOD Live
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            LCBO Sale of Data daily feed. Multi-day walkback + snapshot validation enabled.
          </p>
        </div>
        <Button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          variant="primary"
        >
          <RefreshCw size={16} className={refresh.isPending ? 'animate-spin' : ''} />
          {refresh.isPending ? 'Pulling…' : 'Force Refresh'}
        </Button>
      </header>

      <FreshnessBanner />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Inventory rows" value={formatNumber(status.data?.stats.inv_rows)} />
        <StatCard label="Distinct SKUs" value={formatNumber(status.data?.stats.sku_count)} />
        <StatCard label="Snapshot days" value={formatNumber(status.data?.stats.snapshot_days)} />
        <StatCard
          label="Tracked products"
          value={formatNumber(status.data?.stats.tracked_products)}
        />
      </div>

      {/* Last by source */}
      <Card>
        <CardHeader>
          <CardTitle>Last sync per source</CardTitle>
          <CardDescription>
            Daily A = full LCBO (1.5M rows). Daily B = our agent's filtered view.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['daily_a', 'daily_b'] as const).map((src) => {
            const r = status.data?.last_by_source?.[src];
            return (
              <div
                key={src}
                className="rounded-lg border border-[var(--color-card-border)] p-4 bg-[rgba(255,255,255,0.02)]"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono uppercase">{src}</span>
                  <StatusPill status={r?.status} />
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <Row label="File" value={r?.file_name ?? '—'} />
                  <Row label="Snapshot" value={r?.snapshot_date ?? '—'} />
                  <Row label="Rows" value={formatNumber(r?.total_rows ?? 0)} />
                  <Row label="Tracked rows" value={formatNumber(r?.anu_rows ?? 0)} />
                  <Row label="Duration" value={r?.duration_seconds ? `${r.duration_seconds.toFixed(1)}s` : '—'} />
                  <Row label="Run at" value={r?.run_at ? relativeTime(r.run_at) : '—'} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent sync runs</CardTitle>
          <CardDescription>
            Filtered to exclude orphaned-running rows (auto-cleaned after 6h).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="data-table min-w-[700px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Snapshot</th>
                  <th className="text-right">Rows</th>
                  <th className="text-right">Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {status.data?.recent_runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-[var(--color-muted)]">{formatDateTime(r.run_at)}</td>
                    <td className="font-mono text-xs">{r.source}</td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td className="font-mono text-xs">{r.snapshot_date ?? '—'}</td>
                    <td className="text-right tabular-nums">{formatNumber(r.total_rows)}</td>
                    <td className="text-right tabular-nums text-[var(--color-muted)]">
                      {r.duration_seconds ? `${r.duration_seconds.toFixed(1)}s` : '—'}
                    </td>
                    <td className="text-xs sev-critical truncate max-w-[200px]">
                      {r.error?.slice(0, 60)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  if (status === 'success') return <span className="badge badge-listed">Success</span>;
  if (status === 'failed') return <span className="badge badge-delisted">Failed</span>;
  if (status === 'running') return <span className="badge badge-delisting">Running</span>;
  return <span className="badge">{status ?? '—'}</span>;
}

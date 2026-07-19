'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from './ui/button';

/**
 * Persistent freshness banner.
 *
 * Shows on every page when SOD data is stale (>2 days old). One-tap refresh
 * triggers the multi-day-walkback fix to fetch a current snapshot.
 */
export function FreshnessBanner() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sod-health'],
    queryFn: api.sodHealth,
    refetchInterval: 60_000,
  });

  const refresh = useMutation({
    mutationFn: api.sodRefreshSnapshot,
    onSuccess: () => {
      toast.success('Refresh started — new snapshot in 60-90s', {
        description: 'Multi-day walkback enabled. Page will auto-update.',
      });
      // Re-poll quickly for ~3 minutes
      let n = 0;
      const id = setInterval(() => {
        qc.invalidateQueries({ queryKey: ['sod-health'] });
        if (++n > 20) clearInterval(id);
      }, 10_000);
    },
    onError: (err: unknown) => toast.error(`Refresh failed: ${(err as Error).message}`),
  });

  if (isLoading || !data) return null;

  if (data.status === 'never_synced') {
    return (
      <Banner tone="danger" icon={<AlertTriangle size={18} />}>
        <span>
          <b>No SOD data yet.</b> Click refresh to pull the latest snapshot from LCBO.
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RefreshCw size={14} className={refresh.isPending ? 'animate-spin' : ''} />
          {refresh.isPending ? 'Starting…' : 'Pull Latest'}
        </Button>
      </Banner>
    );
  }

  if (data.status === 'stale') {
    return (
      <Banner tone="warn" icon={<AlertTriangle size={18} />}>
        <span>
          <b>SOD snapshot is {data.snapshot_age_days} days old</b> ({data.snapshot_date}). LCBO
          may not have published a fresh file yet, or our last sync used a stale candidate.
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RefreshCw size={14} className={refresh.isPending ? 'animate-spin' : ''} />
          {refresh.isPending ? 'Pulling…' : 'Force Refresh'}
        </Button>
      </Banner>
    );
  }

  // healthy
  return (
    <Banner tone="success" icon={<CheckCircle2 size={18} />} compact>
      <span className="text-xs">
        SOD fresh · snapshot {data.snapshot_date} ({data.snapshot_age_days}d ago)
      </span>
    </Banner>
  );
}

function Banner({
  tone,
  icon,
  children,
  compact,
}: {
  tone: 'success' | 'warn' | 'danger';
  icon: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const colors = {
    success: 'bg-[rgba(45,212,168,0.08)] border-[rgba(45,212,168,0.3)] text-[#4be0bb]',
    warn: 'bg-[rgba(253,203,110,0.08)] border-[rgba(253,203,110,0.3)] text-[#ffd780]',
    danger: 'bg-[rgba(229,72,77,0.08)] border-[rgba(229,72,77,0.3)] text-[#ff8a80]',
  }[tone];

  return (
    <div
      className={`mb-4 flex items-center gap-3 ${compact ? 'px-3 py-1.5' : 'px-4 py-3'} rounded-lg border ${colors}`}
    >
      {icon}
      <div className="flex-1 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
    </div>
  );
}

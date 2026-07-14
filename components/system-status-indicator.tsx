'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * SystemStatusIndicator — single-glance health dot in the page header.
 *
 *   green  = 'ok'        (everything healthy)
 *   amber  = 'degraded'  (one or more signals stale; system still usable)
 *   red    = 'down'      (something is actually broken)
 *
 * Click to expand → shows the full issues list + signal values.
 * Backend caches the underlying endpoint for 30s so this is cheap.
 */
export function SystemStatusIndicator() {
  const [open, setOpen] = useState(false);
  const status = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.systemStatus(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const tier = status.data?.tier ?? (status.isError ? 'down' : 'ok');
  const dotColor =
    tier === 'ok'
      ? 'bg-[var(--color-success)]'
      : tier === 'down'
        ? 'bg-[var(--color-danger)]'
        : 'bg-[var(--color-warning)]';
  const tierLabel =
    tier === 'ok'
      ? 'All systems normal'
      : tier === 'down'
        ? 'Backend unreachable'
        : 'Degraded';

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-muted hover:text-[var(--color-foreground)]"
        aria-label={`System status: ${tierLabel}`}
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} ${tier !== 'ok' ? 'animate-pulse' : ''}`} />
        <span>{tierLabel}</span>
        {(status.data?.issues?.length ?? 0) > 0 && (
          <>
            {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </>
        )}
      </button>
      {open && status.data && (
        <div className="mt-2 space-y-1.5 max-w-md">
          {status.data.issues.length > 0 ? (
            <div className="space-y-1">
              {status.data.issues.map((issue, i) => (
                <div
                  key={i}
                  className="text-[11px] text-[var(--color-warning)] flex items-start gap-1"
                >
                  <span>⚠</span>
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted">No active issues.</div>
          )}
          <div className="text-[10px] text-muted font-mono pt-1 border-t border-[var(--color-card-border)]">
            SOD snapshot: {status.data.sod_latest_snapshot ?? '—'} ·{' '}
            {status.data.signals.sod_snapshot_age_days ?? '?'}d old
            {status.data.signals.lcbo_scrape_age_hours != null && (
              <>
                {' '}· lcbo scrape: {status.data.signals.lcbo_scrape_age_hours}h old
              </>
            )}
            {status.data.signals.last_activity_age_hours != null && (
              <>
                {' '}· last visit: {status.data.signals.last_activity_age_hours}h ago
              </>
            )}
            {(status.data.signals.sod_failed_runs_24h ?? 0) > 0 && (
              <>
                {' '}· {status.data.signals.sod_failed_runs_24h} failures/24h
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

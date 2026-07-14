'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { GitBranch, AlertTriangle, RefreshCw, Eye, Database, Globe2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';

/**
 * Source Drift — every store, every disagreement between SOD, lcbo.com,
 * our master directory, and rep observations. The "where is each source
 * lying right now" page.
 */
export default function SourceDriftPage() {
  const [hours, setHours] = useState(48);
  const universe = useQuery({
    queryKey: ['store-universe', hours],
    queryFn: () => api.storeUniverse({ lcbo_hours: hours }),
    refetchInterval: 60_000,
  });

  const u = universe.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <GitBranch size={24} className="text-[var(--color-accent)]" />
          Source Drift
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Where SOD, lcbo.com, and our master directory disagree. Truth is the
          UNION of all three — single sources lie in both directions.
        </p>
      </header>

      {/* Window selector + refresh */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">lcbo.com window:</span>
        {[24, 48, 72, 168].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={`px-3 py-1.5 rounded text-xs ${
              hours === h
                ? 'bg-[var(--color-accent)] text-[#2a1f0f] font-semibold'
                : 'text-muted hover:text-[var(--color-foreground)] border border-[var(--color-card-border)]'
            }`}
          >
            {h}h
          </button>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => universe.refetch()}
          disabled={universe.isFetching}
        >
          <RefreshCw size={14} className={universe.isFetching ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Universe stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Universe (UNION across all sources)</CardTitle>
          <CardDescription>
            Total store_numbers seen anywhere in the last {hours}h.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="Total universe"
              value={formatNumber(u?.universe_stats.total_universe_size ?? 0)}
              icon={<Globe2 size={14} className="text-[var(--color-accent)]" />}
            />
            <Stat
              label="In all three"
              value={formatNumber(u?.universe_stats.in_all_three ?? 0)}
              sub="master + SOD + lcbo.com"
            />
            <Stat
              label="SOD only"
              value={formatNumber(u?.universe_stats.in_sod_only ?? 0)}
              sub="not in master"
              warn={(u?.universe_stats.in_sod_only ?? 0) > 0}
            />
            <Stat
              label="lcbo.com only"
              value={formatNumber(u?.universe_stats.in_lcbo_only ?? 0)}
              sub="not in master"
              warn={(u?.universe_stats.in_lcbo_only ?? 0) > 0}
            />
            <Stat
              label="Master only"
              value={formatNumber(u?.universe_stats.in_master_only ?? 0)}
              sub="not seen recently"
              warn={(u?.universe_stats.in_master_only ?? 0) > 0}
            />
            <Stat
              label="Master + SOD"
              value={formatNumber(u?.universe_stats.in_master_and_sod ?? 0)}
            />
            <Stat
              label="Master + lcbo.com"
              value={formatNumber(u?.universe_stats.in_master_and_lcbo ?? 0)}
            />
            <Stat
              label="SOD + lcbo.com"
              value={formatNumber(u?.universe_stats.in_sod_and_lcbo ?? 0)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Carrying-us stats — the commission-relevant slice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Stores carrying ≥1 of our SKUs (UNION)
          </CardTitle>
          <CardDescription>
            A store counts if SOD says Listed OR lcbo.com saw stock OR a rep
            confirmed on shelf within 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat
              label="Total carrying us"
              value={formatNumber(u?.carrying_stats.total_stores_carrying_any_sku ?? 0)}
              icon={<Eye size={14} className="text-[var(--color-success)]" />}
              highlight="success"
            />
            <Stat
              label="In all 3 sources"
              value={formatNumber(u?.carrying_stats.all_three ?? 0)}
              sub="SOD + lcbo + rep all confirm"
            />
            <Stat
              label="SOD + lcbo.com"
              value={formatNumber(u?.carrying_stats.sod_and_lcbo ?? 0)}
              sub="both confirm"
            />
            <Stat
              label="Only on lcbo.com"
              value={formatNumber(u?.carrying_stats.lcbo_only ?? 0)}
              sub="SOD missed → potential claim"
              highlight="danger"
            />
            <Stat
              label="Only in SOD"
              value={formatNumber(u?.carrying_stats.sod_only ?? 0)}
              sub="lcbo.com hasn't confirmed"
              warn={(u?.carrying_stats.sod_only ?? 0) > 0}
            />
            <Stat
              label="Only via rep"
              value={formatNumber(u?.carrying_stats.rep_only ?? 0)}
              sub="manual flag, no source backup"
              warn={(u?.carrying_stats.rep_only ?? 0) > 0}
            />
          </div>
        </CardContent>
      </Card>

      {/* Drift lists — the actionable rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DriftList
          title="Carrying us only on lcbo.com"
          subtitle="SOD missed these → commission claims"
          stores={u?.drift.carrying_us_only_in_lcbo ?? []}
          highlight="danger"
        />
        <DriftList
          title="Carrying us only in SOD"
          subtitle="lcbo.com hasn't confirmed yet"
          stores={u?.drift.carrying_us_only_in_sod ?? []}
          highlight="warning"
        />
        <DriftList
          title="lcbo.com sees, master directory doesn't"
          subtitle="Auto-onboarded next scrape"
          stores={u?.drift.lcbo_only_stores ?? []}
        />
        <DriftList
          title="SOD sees, master directory doesn't"
          subtitle="Auto-onboarded next sync"
          stores={u?.drift.sod_only_stores ?? []}
        />
        <DriftList
          title="In master directory but no recent activity"
          subtitle="Likely closed or stale"
          stores={u?.drift.master_only_stores ?? []}
          highlight="warning"
        />
        <DriftList
          title="Carrying us only via rep observation"
          subtitle="No data-source backup yet"
          stores={u?.drift.carrying_us_only_via_rep ?? []}
        />
      </div>

      {/* How-to-read */}
      {u?.how_to_read && (
        <div className="m-card flex items-start gap-3 border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
          <AlertTriangle size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="text-xs text-muted">{u.how_to_read}</div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  warn,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  warn?: boolean;
  highlight?: 'danger' | 'success' | 'warning';
}) {
  const color =
    highlight === 'danger'
      ? 'var(--color-danger)'
      : highlight === 'success'
        ? 'var(--color-success)'
        : highlight === 'warning' || warn
          ? 'var(--color-warning)'
          : 'var(--color-foreground)';
  return (
    <div className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function DriftList({
  title,
  subtitle,
  stores,
  highlight,
}: {
  title: string;
  subtitle: string;
  stores: number[];
  highlight?: 'danger' | 'warning';
}) {
  const accent =
    highlight === 'danger'
      ? 'border-[rgba(239,75,75,0.3)]'
      : highlight === 'warning'
        ? 'border-[rgba(253,203,110,0.3)]'
        : 'border-[var(--color-card-border)]';
  return (
    <div className={`rounded-lg border ${accent} bg-[rgba(255,255,255,0.02)] p-3`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[10px] text-muted mb-2">{subtitle}</div>
      {stores.length === 0 ? (
        <div className="text-xs text-muted py-2">— none —</div>
      ) : (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {stores.slice(0, 50).map((sn) => (
            <Link
              key={sn}
              href={`/stores/${sn}`}
              className="text-xs font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] hover:bg-[var(--color-accent)] hover:text-[#2a1f0f]"
            >
              #{sn}
            </Link>
          ))}
        </div>
      )}
      {stores.length > 50 && (
        <div className="text-[10px] text-muted mt-1">+{stores.length - 50} more</div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DollarSign, AlertTriangle, Download, RefreshCw, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { PasscodeGate } from '@/components/passcode-gate';

/**
 * Commission Audit — every store-SKU where SOD undercounts vs lcbo.com or
 * a rep observation. Each lcbo_only row is a potential listing we are not
 * being paid for. Export CSV → submit to brand owner.
 *
 * Passcode-gated (operator-only) — reps don't see this page.
 */
export default function CommissionAuditPage() {
  return (
    <PasscodeGate
      storageKey="commission_audit_unlocked"
      passcode="0257"
      title="Commission Audit"
      description="Operator-only view. Enter passcode to continue."
    >
      <CommissionAuditPageInner />
    </PasscodeGate>
  );
}

function CommissionAuditPageInner() {
  const [days, setDays] = useState(7);
  const [skuFilter, setSkuFilter] = useState<string>('');
  const [includeMatches, setIncludeMatches] = useState(false);

  const audit = useQuery({
    queryKey: ['commission-audit', days, skuFilter, includeMatches],
    queryFn: () =>
      api.commissionAudit({
        days,
        sku: skuFilter || undefined,
        include_matches: includeMatches,
      }),
    refetchInterval: 60_000,
  });

  const tracked = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
  });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  const csvUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL +
    `/api/admin/commission-audit?format=csv&days=${days}` +
    (skuFilter ? `&sku=${skuFilter}` : '');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <DollarSign size={24} className="text-[var(--color-accent)]" />
          Commission Audit
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Every store-SKU where SOD says we&apos;re not listed but lcbo.com or
          a rep saw stock on shelf. Each row may be a missing commission claim.
        </p>
      </header>

      {/* Headline cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Potential claims"
          value={formatNumber(audit.data?.summary.lcbo_only ?? 0)}
          danger
          help="lcbo.com or rep saw stock; SOD missed"
        />
        <StatCard
          label="Units undercounted"
          value={formatNumber(audit.data?.summary.units_undercounted ?? 0)}
          danger
        />
        <StatCard
          label="Listed-but-empty"
          value={formatNumber(audit.data?.summary.sod_only_empty ?? 0)}
          help="Listed, on-hand=0 (real listing, just no stock)"
        />
        <StatCard
          label="Listed-but-unconfirmed"
          value={formatNumber(audit.data?.summary.sod_only_stale ?? 0)}
          warning
          help="SOD says listed; no recent lcbo.com confirm"
        />
        <StatCard
          label="In agreement"
          value={formatNumber(audit.data?.summary.agree ?? 0)}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Window {audit.data?.window_days ?? days} days · last refreshed{' '}
            {audit.data?.as_of ? new Date(audit.data.as_of).toLocaleString() : '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="SKU">
            <select
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="select"
            >
              <option value="">All tracked SKUs</option>
              {trackedList.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Lookback: ${days} days`}>
            <input
              type="range"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full"
            />
          </Field>
          <Field label="View">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeMatches}
                onChange={(e) => setIncludeMatches(e.target.checked)}
              />
              Include rows where SOD and lcbo.com agree
            </label>
          </Field>
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => audit.refetch()} disabled={audit.isFetching}>
          <RefreshCw size={14} className={audit.isFetching ? 'animate-spin' : ''} />
          {audit.isFetching ? 'Running…' : 'Re-run audit'}
        </Button>
        <a
          href={csvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
        >
          <Download size={14} /> Export CSV (for brand owner)
        </a>
      </div>

      {/* How to use */}
      {audit.data?.how_to_use && (
        <div className="m-card flex items-start gap-3 border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
          <FileText size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--color-muted)]">{audit.data.how_to_use}</div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {audit.data?.rows.length ?? 0} rows
          </CardTitle>
          <CardDescription>
            <span className="text-[var(--color-danger)] font-semibold">lcbo_only</span> =
            potential claim ·{' '}
            <span className="text-[var(--color-warning)] font-semibold">sod_only</span> = SOD
            says listed but no shelf evidence ·{' '}
            <span className="text-[var(--color-success)] font-semibold">agree</span> =
            sources match
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="data-table min-w-full text-xs">
            <thead>
              <tr>
                <th>Verdict</th>
                <th>SKU</th>
                <th>Product</th>
                <th>Store #</th>
                <th>SOD status</th>
                <th>SOD on-hand</th>
                <th>lcbo.com units</th>
                <th>Rep saw it?</th>
                <th>Claim units</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.rows.map((r) => (
                <tr key={`${r.sku}-${r.store_number}`}>
                  <td>
                    <VerdictBadge verdict={r.verdict} />
                  </td>
                  <td className="font-mono">{r.sku}</td>
                  <td>
                    <span className="text-[var(--color-muted)]">{r.brand}</span>{' '}
                    {r.product_name}
                  </td>
                  <td>
                    <Link
                      href={`/stores/${r.store_number}`}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      #{r.store_number}
                    </Link>
                  </td>
                  <td>{r.sod_status ?? '—'}</td>
                  <td className="tabular-nums">{r.sod_on_hand}</td>
                  <td className="tabular-nums">{r.lcbo_units}</td>
                  <td>
                    {r.rep_observed ? (
                      <span title={`${r.rep_observation_by} at ${r.rep_observation_at}`}>
                        ✓ {r.rep_observation_by}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tabular-nums font-semibold">
                    {r.claim_units > 0 ? r.claim_units : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.isLoading && (
            <div className="py-8 text-center text-[var(--color-muted)] text-sm">
              Running cross-validation…
            </div>
          )}
          {!audit.isLoading && audit.data?.rows.length === 0 && (
            <div className="py-8 text-center text-[var(--color-muted)] text-sm">
              No disagreements found in the last {days} days. Try expanding the window or
              including matches.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  danger,
  warning,
  help,
}: {
  label: string;
  value: string;
  danger?: boolean;
  warning?: boolean;
  help?: string;
}) {
  const color = danger
    ? 'var(--color-danger)'
    : warning
      ? 'var(--color-warning)'
      : 'var(--color-foreground)';
  return (
    <div
      className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]"
      title={help}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>
        {value}
      </div>
      {help && <div className="text-[10px] text-[var(--color-muted)] mt-1">{help}</div>}
    </div>
  );
}

function VerdictBadge({
  verdict,
}: {
  verdict: 'lcbo_only' | 'sod_only_empty' | 'sod_only_stale' | 'agree';
}) {
  const map = {
    lcbo_only: { label: 'CLAIM', cls: 'bg-[rgba(239,75,75,0.12)] text-[var(--color-danger)]' },
    sod_only_stale: {
      label: 'STALE?',
      cls: 'bg-[rgba(253,203,110,0.12)] text-[var(--color-warning)]',
    },
    sod_only_empty: {
      label: 'EMPTY',
      cls: 'bg-[rgba(255,255,255,0.06)] text-[var(--color-muted)]',
    },
    agree: { label: 'AGREE', cls: 'bg-[rgba(120,200,140,0.10)] text-[var(--color-success)]' },
  } as const;
  const m = map[verdict];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
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

'use client';

import type { ConversionTag, OwnerStatus, ReconcileFlag } from '@/lib/api';

/**
 * Small shared chips for the Dripp territory / reconcile / top-100 surfaces.
 * Style vocabulary matches globals.css (.change-chip variants).
 */

export function TierChip({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    routed: { bg: 'rgba(212,165,116,0.15)', fg: '#e5c09a', label: 'Routed' },
    territory: { bg: 'rgba(255,255,255,0.06)', fg: '#a7aeb9', label: 'Territory' },
    discovered: { bg: 'rgba(18,194,140,0.15)', fg: '#22d79b', label: 'Discovered' },
  };
  const s = styles[tier] ?? { bg: 'rgba(255,255,255,0.06)', fg: '#a7aeb9', label: tier };
  return (
    <span className="change-chip" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export const FLAG_META: Record<
  ReconcileFlag,
  { label: string; bg: string; fg: string; explain: string }
> = {
  MATCH: {
    label: 'Match',
    bg: 'rgba(18,194,140,0.15)',
    fg: '#22d79b',
    explain: 'All sources agree',
  },
  SOD_LAGS_LIVE: {
    label: 'SOD lags live',
    bg: 'rgba(253,203,110,0.15)',
    fg: '#ffd780',
    explain: 'lcbo.com shows stock SOD has not caught up to',
  },
  LIVE_LAGS_SOD: {
    label: 'Live lags SOD',
    bg: 'rgba(253,203,110,0.15)',
    fg: '#ffd780',
    explain: 'SOD shows stock lcbo.com has not caught up to',
  },
  REP_MISMATCH: {
    label: 'Rep mismatch',
    bg: 'rgba(239,75,75,0.15)',
    fg: '#ff8a80',
    explain: 'Rep-observed count differs by 3+ units',
  },
  MISSING_FROM_SOD: {
    label: 'Missing from SOD',
    bg: 'rgba(239,75,75,0.15)',
    fg: '#ff8a80',
    explain: 'On lcbo.com or rep-observed but absent from SOD',
  },
  MISSING_FROM_LIVE: {
    label: 'Missing from live',
    bg: 'rgba(253,203,110,0.15)',
    fg: '#ffd780',
    explain: 'In SOD but not on lcbo.com',
  },
};

export function FlagChip({ flag }: { flag: ReconcileFlag | string }) {
  const meta = FLAG_META[flag as ReconcileFlag];
  if (!meta) {
    return <span className="change-chip change-BASELINE">{flag}</span>;
  }
  return (
    <span className="change-chip" style={{ background: meta.bg, color: meta.fg }} title={meta.explain}>
      {meta.label}
    </span>
  );
}

export function AttributionChip({ tag }: { tag: ConversionTag | null | undefined }) {
  if (!tag) return null;
  if (tag === 'rep_converted') {
    return (
      <span
        className="change-chip"
        style={{ background: 'rgba(18,194,140,0.15)', color: '#22d79b' }}
        title="A touchpoint preceded this listing"
      >
        Rep converted
      </span>
    );
  }
  if (tag === 'baseline') {
    return (
      <span
        className="change-chip"
        style={{ background: 'rgba(212,165,116,0.12)', color: '#c9a882' }}
        title="Listed on or before launch — pre-field-work baseline"
      >
        Baseline
      </span>
    );
  }
  return (
    <span
      className="change-chip"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#a7aeb9' }}
      title="No touchpoint before this listing"
    >
      Organic
    </span>
  );
}

export const OWNER_STATUS_META: Record<OwnerStatus, { label: string; bg: string; fg: string }> = {
  none: { label: 'No status', bg: 'rgba(255,255,255,0.06)', fg: '#8b929e' },
  listing_received: { label: 'Listing received', bg: 'rgba(212,165,116,0.15)', fg: '#e5c09a' },
  order_received: { label: 'Order received', bg: 'rgba(253,203,110,0.15)', fg: '#ffd780' },
  completed: { label: 'Completed', bg: 'rgba(18,194,140,0.15)', fg: '#22d79b' },
};

export function OwnerStatusChip({ status }: { status: OwnerStatus | string | null | undefined }) {
  const meta = OWNER_STATUS_META[(status ?? 'none') as OwnerStatus] ?? OWNER_STATUS_META.none;
  return (
    <span className="change-chip" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

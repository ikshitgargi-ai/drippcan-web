'use client';

import type { ConversionTag, OwnerStatus, ReconcileFlag } from '@/lib/api';

/**
 * Small shared chips for the Dripp territory / reconcile / top-100 surfaces.
 * Style vocabulary matches globals.css (.change-chip variants). Colors come
 * from the house tint recipe: emerald = good, warning = caution, danger = bad,
 * gold = house accent, neutral = muted. If a chip ever needs to identify the
 * Dripp brand itself, use var(--color-dripp); it is never UI chrome.
 */

export function TierChip({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    routed: { bg: 'rgba(216,173,88,0.15)', fg: '#e8c98d', label: 'Routed' },
    territory: { bg: 'rgba(255,255,255,0.06)', fg: '#9fa8bb', label: 'Territory' },
    discovered: { bg: 'rgba(45,212,168,0.15)', fg: '#4be0bb', label: 'Discovered' },
  };
  const s = styles[tier] ?? { bg: 'rgba(255,255,255,0.06)', fg: '#9fa8bb', label: tier };
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
    bg: 'rgba(45,212,168,0.15)',
    fg: '#4be0bb',
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
    bg: 'rgba(229,72,77,0.15)',
    fg: '#ff8a80',
    explain: 'Rep-observed count differs by 3+ units',
  },
  MISSING_FROM_SOD: {
    label: 'Missing from SOD',
    bg: 'rgba(229,72,77,0.15)',
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
        style={{ background: 'rgba(45,212,168,0.15)', color: '#4be0bb' }}
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
        style={{ background: 'rgba(216,173,88,0.12)', color: '#e8c98d' }}
        title="Listed on or before launch, the pre-field-work baseline"
      >
        Baseline
      </span>
    );
  }
  return (
    <span
      className="change-chip"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#9fa8bb' }}
      title="No touchpoint before this listing"
    >
      Organic
    </span>
  );
}

export const OWNER_STATUS_META: Record<OwnerStatus, { label: string; bg: string; fg: string }> = {
  none: { label: 'No status', bg: 'rgba(255,255,255,0.06)', fg: '#9fa8bb' },
  listing_received: { label: 'Listing received', bg: 'rgba(216,173,88,0.15)', fg: '#e8c98d' },
  order_received: { label: 'Order received', bg: 'rgba(253,203,110,0.15)', fg: '#ffd780' },
  completed: { label: 'Completed', bg: 'rgba(45,212,168,0.15)', fg: '#4be0bb' },
};

export function OwnerStatusChip({ status }: { status: OwnerStatus | string | null | undefined }) {
  const meta = OWNER_STATUS_META[(status ?? 'none') as OwnerStatus] ?? OWNER_STATUS_META.none;
  return (
    <span className="change-chip" style={{ background: meta.bg, color: meta.fg }}>
      {meta.label}
    </span>
  );
}

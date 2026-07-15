'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Download, Search } from 'lucide-react';
import { api, type AnuAccountRow } from '@/lib/api';
import { useOwnerMode } from '@/lib/owner-mode';
import { formatDate } from '@/lib/utils';

/**
 * ANU ACCOUNTS — the permanent touched-store ledger, shared by rep and owner.
 *
 * Every store a rep has EVER touched (visit, call, tasting, any logged
 * activity) is named to Anu Spirits here, forever, with a stable billing
 * reference (ANU-<store#>) and the verifiable chain the owner checks before
 * paying a per-listing fee: touch date → listing (canonical ledger) → order.
 * Rep identities are anonymized server-side in the owner view.
 */

const CLASS_LABEL: Record<string, string> = {
  billable: 'ours — billable',
  baseline: 'pre-existing',
  listed_before_touch: 'listed before touch',
};

const CLASS_STYLE: Record<string, string> = {
  billable: 'change-chip change-NEW_LISTING',
  baseline: 'change-chip change-BASELINE',
  listed_before_touch: 'change-chip change-STATUS_FLIP',
};

export default function AnuAccountsPage() {
  const ownerMode = useOwnerMode();
  const [q, setQ] = useState('');

  const data = useQuery({
    queryKey: ['anu-accounts'],
    queryFn: () => api.anuAccounts(),
    retry: 1,
  });

  const rows = useMemo(() => {
    const all = data.data?.rows ?? [];
    if (!q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        String(r.store_number).includes(needle) ||
        r.account_ref.toLowerCase().includes(needle) ||
        (r.account || '').toLowerCase().includes(needle) ||
        (r.city || '').toLowerCase().includes(needle),
    );
  }, [data.data, q]);

  const s = data.data?.summary;

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <BadgeCheck size={22} className="text-[var(--color-accent)]" />
            Anu Accounts
          </h1>
          <p className="text-sm text-muted mt-1">
            Every store our team has touched, from the first log, forever. Each
            account carries its touch date, listings, and order evidence
            {ownerMode
              ? ' — verify the chain here before per-listing fees.'
              : ' — the billing basis with the brand owner.'}
          </p>
        </div>
        <a
          href={api.exportAnuAccountsXlsxUrl(ownerMode ? { owner: true } : undefined)}
          className="shrink-0 flex items-center gap-2 h-11 px-4 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
        >
          <Download size={15} /> Excel
        </a>
      </header>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryChip label="Anu accounts" value={s.accounts} />
          <SummaryChip label="Billable listings" value={s.billable_listings} accent />
          <SummaryChip label="Accounts w/ billable" value={s.accounts_with_billable_listing} />
          <SummaryChip label="With order evidence" value={s.accounts_with_order_evidence} />
        </div>
      )}

      <div className="m-card flex items-center gap-2">
        <Search size={15} className="text-muted shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Store #, name, city, ANU ref…"
          className="w-full bg-transparent outline-none text-sm"
        />
      </div>

      {data.isLoading && <div className="skeleton h-24" />}
      {data.isError && (
        <div className="m-card text-sm text-muted">
          Could not load the account ledger. Pull to retry.
        </div>
      )}
      {data.data && rows.length === 0 && (
        <div className="m-card text-sm text-muted">
          No accounts yet. The first logged visit, call, or tasting names its
          store to Anu Spirits automatically.
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <AccountCard key={r.store_number} row={r} />
        ))}
      </div>
    </div>
  );
}

function SummaryChip({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="m-card py-2.5">
      <div className={`text-lg font-semibold tabular-nums ${accent ? 'text-[var(--color-accent)]' : ''}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function AccountCard({ row }: { row: AnuAccountRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-card">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold">
              #{row.store_number}
              <span className="text-sm font-normal text-muted ml-1.5">
                {row.account || 'Store'} · {row.city}
              </span>
            </div>
            <div className="text-xs text-muted mt-0.5">
              {row.account_ref} · named to Anu since {formatDate(row.claimed_at)}
              {row.first_touch_type ? ` (${row.first_touch_type.replace(/_/g, ' ')})` : ''}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {row.billable_listings > 0 && (
              <span className="change-chip change-NEW_LISTING">
                {row.billable_listings} billable
              </span>
            )}
            <div className="text-[11px] text-muted mt-1 tabular-nums">
              {row.touches_total} touch{row.touches_total === 1 ? '' : 'es'}
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--color-card-border)] space-y-2 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(row.touches).map(([k, n]) => (
              <span key={k} className="change-chip change-BASELINE">
                {k.replace(/_/g, ' ')} × {n}
              </span>
            ))}
            {row.owner_status !== 'none' && (
              <span className="change-chip change-NEW_LISTING">
                {row.owner_status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {row.reps.length > 0 && (
            <div className="text-muted">Worked by: {row.reps.join(', ')}</div>
          )}
          <div className="text-muted">
            Last touch: {row.last_touch ? formatDate(row.last_touch) : '—'}
            {row.order_evidence.order_activities > 0 &&
              ` · ${row.order_evidence.order_activities} order commitment${row.order_evidence.order_activities === 1 ? '' : 's'} logged`}
          </div>
          {row.listings.length > 0 ? (
            <div className="space-y-1">
              <div className="font-medium text-[var(--color-fg)]">Listings at this store</div>
              {row.listings.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span>
                    {l.brand || l.sku} · {formatDate(l.date)} · via {l.source}
                  </span>
                  <span className={CLASS_STYLE[l.classification] ?? 'change-chip'}>
                    {CLASS_LABEL[l.classification] ?? l.classification}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted">No listings here yet — touched, working on it.</div>
          )}
        </div>
      )}
    </div>
  );
}

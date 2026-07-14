'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, MapPin, User, Loader2, CheckCircle2, Search } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Smart store autocomplete: rep can type EITHER a store number ("217") OR any
 * fragment of the store name / address / city / postal code. Picks the matching
 * store and autopopulates name + address + phone (tap-to-call) + manager.
 *
 * Backed by /api/crm/store-search (returns up to 10 matches).
 */
export function StoreLookup({
  value,
  onChange,
  onResolved,
  placeholder = 'Store # or name/address',
}: {
  value: string;
  onChange: (v: string) => void;
  onResolved?: (
    store: {
      store_number: number;
      account: string;
      address: string;
      city: string;
      phone: string;
      manager_name: string;
    } | null,
  ) => void;
  placeholder?: string;
}) {
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), 220);
    return () => clearTimeout(id);
  }, [value]);

  const enabled = debounced.length >= 2;

  // 1) Live search across number/name/address (typeahead)
  const search = useQuery({
    queryKey: ['store-search', debounced],
    queryFn: () => api.storeSearch(debounced),
    enabled,
    retry: false,
  });

  const matches = useMemo(() => search.data?.matches ?? [], [search.data]);

  // 2) Once exactly one match (or the user picked one) — fetch full profile to
  //    surface manager phone / asst manager etc that the search row may not include.
  const exactNumber = /^\d+$/.test(debounced) ? Number(debounced) : null;
  const autoPick =
    picked ??
    (exactNumber ?? (matches.length === 1 ? matches[0].store_number : null));

  const lookup = useQuery({
    queryKey: ['store-full', autoPick],
    queryFn: () => api.storeFull(autoPick!),
    enabled: !!autoPick,
    retry: false,
  });

  useEffect(() => {
    if (!enabled) {
      onResolved?.(null);
      return;
    }
    const s = lookup.data?.store;
    if (s) {
      onResolved?.({
        store_number: s.store_number,
        account: s.account ?? '',
        address: s.address ?? '',
        city: s.city ?? '',
        phone: s.manager_phone || s.phone || '',
        manager_name: s.manager_name ?? '',
      });
    } else if (lookup.error) {
      onResolved?.(null);
    }
  }, [enabled, lookup.data, lookup.error, onResolved]);

  return (
    <div>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
        />
        <input
          type="text"
          inputMode="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setPicked(null); // reset selection when typing
          }}
          placeholder={placeholder}
          className="select pl-9"
          autoComplete="off"
        />
      </div>
      {enabled && matches.length > 1 && !autoPick && (
        <div className="mt-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)] divide-y divide-[var(--color-card-border)] overflow-hidden">
          {matches.map((m) => {
            const last = m.last_activity_at ? new Date(m.last_activity_at) : null;
            const lastDays =
              last && !isNaN(last.getTime())
                ? Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
                : null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPicked(m.store_number);
                  onChange(String(m.store_number));
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-card)]"
              >
                <div className="font-semibold text-sm flex items-center gap-2">
                  #{m.store_number} · {m.account || '—'}
                  {m.rep && (
                    <span className="text-[10px] text-muted font-normal">{m.rep}</span>
                  )}
                </div>
                <div className="text-muted">
                  {m.address}
                  {m.city ? `, ${m.city}` : ''}
                  {m.postal ? ` ${m.postal}` : ''}
                </div>
                {last && (
                  <div className="text-[10px] text-muted mt-0.5">
                    Last: {m.last_activity_type ?? 'visit'}
                    {m.last_activity_rep ? ` by ${m.last_activity_rep}` : ''}
                    {lastDays != null
                      ? ` · ${lastDays === 0 ? 'today' : `${lastDays}d ago`}`
                      : ''}
                    {m.last_activity_notes
                      ? ` — ${m.last_activity_notes.slice(0, 80)}${m.last_activity_notes.length > 80 ? '…' : ''}`
                      : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      {autoPick && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] text-xs">
          {lookup.isLoading && (
            <div className="flex items-center gap-2 text-muted">
              <Loader2 size={12} className="animate-spin" /> Looking up…
            </div>
          )}
          {lookup.error && (
            <div className="text-[var(--color-warning)]">
              Store #{autoPick} not found in CRM.
            </div>
          )}
          {lookup.data?.store && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                <span className="font-semibold text-sm">
                  #{lookup.data.store.store_number} · {lookup.data.store.account || '—'}
                </span>
              </div>
              {lookup.data.store.address && (
                <div className="flex items-start gap-1.5 text-muted">
                  <MapPin size={11} className="shrink-0 mt-0.5" />
                  <span>
                    {lookup.data.store.address}, {lookup.data.store.city ?? ''}{' '}
                    {lookup.data.store.postal ?? ''}
                  </span>
                </div>
              )}
              {(lookup.data.store.manager_phone || lookup.data.store.phone) && (
                <div className="flex items-center gap-1.5 text-muted">
                  <Phone size={11} />
                  <a
                    href={`tel:${(
                      lookup.data.store.manager_phone || lookup.data.store.phone
                    ).replace(/[^0-9+]/g, '')}`}
                    className="text-[var(--color-accent)]"
                  >
                    {lookup.data.store.manager_phone || lookup.data.store.phone}
                  </a>
                </div>
              )}
              {lookup.data.store.manager_name && (
                <div className="flex items-center gap-1.5 text-muted">
                  <User size={11} />
                  <span>Manager: {lookup.data.store.manager_name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {enabled && !search.isLoading && matches.length === 0 && (
        <div className="mt-2 text-xs text-muted">
          No stores matching &ldquo;{debounced}&rdquo;.
        </div>
      )}
    </div>
  );
}

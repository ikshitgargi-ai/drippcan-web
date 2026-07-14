'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, MapPin, User, Loader2, CheckCircle2, Search } from 'lucide-react';
import { api, type ResolveStoreMatch } from '@/lib/api';

/**
 * Smart store autocomplete: rep types EITHER a store number ("217") OR any
 * fragment of the address / account name / city / postal code.
 *
 * Backed by /api/crm/resolve-store — ONE endpoint that ranks matches with a
 * confidence score (exact store number 100, postal 90, address 70, ...).
 * The debounced dropdown lists matches confidence-first; tapping one fills
 * the form. Contact details (phone, manager) are enriched afterwards from
 * /api/crm/store/N/full, but the pick NEVER depends on that second call —
 * a busy free-tier server can no longer produce a false "not in CRM".
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
  const [picked, setPicked] = useState<ResolveStoreMatch | null>(null);

  // Keep the latest onResolved without re-running effects when the parent
  // passes a fresh inline arrow on every render.
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  });

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(id);
  }, [value]);

  const searching = debounced.length >= 2 && !picked;

  const resolve = useQuery({
    queryKey: ['resolve-store', debounced],
    queryFn: () => api.resolveStore(debounced, 8),
    enabled: searching,
    // request() already retries once after 2.5s on a 502/503/504 GET.
    retry: false,
    staleTime: 30_000,
  });

  const matches = useMemo(() => {
    const list = resolve.data?.matches ?? [];
    // Backend returns ranked already — keep a stable confidence-first order.
    return [...list].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }, [resolve.data]);

  // Auto-confirm the single exact store-number hit (reps mostly type the #).
  useEffect(() => {
    if (!searching) return;
    if (matches.length === 1 && (matches[0].confidence ?? 0) >= 100) {
      setPicked(matches[0]);
    }
  }, [searching, matches]);

  // Optional enrichment: phone + manager from the full store card. The pick
  // stands on the resolve-store match even if this call fails.
  const detail = useQuery({
    queryKey: ['store-full', picked?.store_number],
    queryFn: () => api.storeFull(picked!.store_number),
    enabled: !!picked,
    retry: false,
  });

  useEffect(() => {
    if (!picked) {
      if (!searching) onResolvedRef.current?.(null);
      return;
    }
    const s = detail.data?.store;
    onResolvedRef.current?.({
      store_number: picked.store_number,
      account: s?.account || picked.account || '',
      address: s?.address || picked.address || '',
      city: s?.city || picked.city || '',
      phone: s ? s.manager_phone || s.phone || '' : '',
      manager_name: s?.manager_name ?? '',
    });
  }, [picked, detail.data, searching]);

  function pick(m: ResolveStoreMatch) {
    setPicked(m);
    onChange(String(m.store_number));
  }

  const phone = detail.data?.store
    ? detail.data.store.manager_phone || detail.data.store.phone || ''
    : '';
  const managerName = detail.data?.store?.manager_name ?? '';

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

      {searching && resolve.isLoading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <Loader2 size={12} className="animate-spin" /> Searching stores…
        </div>
      )}

      {/* Confidence-ordered match dropdown — tap to fill the form */}
      {searching && matches.length > 0 && (
        <div className="mt-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)] divide-y divide-[var(--color-card-border)] overflow-hidden">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-card)]"
            >
              <div className="font-semibold text-sm flex items-center gap-2">
                #{m.store_number} · {m.account || '—'}
              </div>
              <div className="text-muted">
                {m.address}
                {m.city ? `, ${m.city}` : ''}
                {m.postal ? ` ${m.postal}` : ''}
              </div>
              {m.match_reason && (
                <div className="text-[10px] text-muted mt-0.5">{m.match_reason}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Confirmed pick — rendered from the resolve match itself */}
      {picked && (
        <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-[var(--color-success)]" />
              <span className="font-semibold text-sm">
                #{picked.store_number} · {picked.account || '—'}
              </span>
            </div>
            {(picked.address || picked.city) && (
              <div className="flex items-start gap-1.5 text-muted">
                <MapPin size={11} className="shrink-0 mt-0.5" />
                <span>
                  {picked.address}
                  {picked.city ? `, ${picked.city}` : ''} {picked.postal ?? ''}
                </span>
              </div>
            )}
            {detail.isLoading && (
              <div className="flex items-center gap-1.5 text-muted">
                <Loader2 size={11} className="animate-spin" /> Loading contact details…
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-1.5 text-muted">
                <Phone size={11} />
                <a
                  href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                  className="text-[var(--color-accent)]"
                >
                  {phone}
                </a>
              </div>
            )}
            {managerName && (
              <div className="flex items-center gap-1.5 text-muted">
                <User size={11} />
                <span>Manager: {managerName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {searching && resolve.isError && (
        <div className="mt-2 text-xs text-muted">
          Store lookup is waking the server up — give it a few seconds and
          type again.
        </div>
      )}

      {searching && resolve.data && !resolve.isLoading && matches.length === 0 && (
        <div className="mt-2 text-xs text-muted">
          No LCBO store matches &ldquo;{debounced}&rdquo;. Try the store
          number, street, city or postal code.
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, History, MessageSquareText, Undo2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, type StoreContactsHistoryPayload } from '@/lib/api';
import { formatDate, relativeTime } from '@/lib/utils';

/**
 * Log-page context for a selected store:
 *
 * 1. <PastConversations> — the store's last 8 activities (type, rep, date,
 *    notes, next action) so the rep sees prior convos BEFORE writing the new
 *    note. Collapsed to 3 with "Show more".
 *
 * 2. <LogContactsCard> — Manager / Assistant Manager / Spirits Ambassador,
 *    pre-filled from the store record, editable, saved through the existing
 *    audited store-update endpoint. Values persist until changed. Under each
 *    field the previous value (from the territory_status_history audit
 *    trail) is one tap away via Restore — nothing is ever hard-deleted.
 *
 * The contacts-history endpoint is new backend surface; if it is not
 * deployed yet the card degrades gracefully (fields still work, the
 * previous-value rows simply do not render).
 */

const COLLAPSED_COUNT = 3;
const MAX_CONVERSATIONS = 8;

const ACTIVITY_LABEL: Record<string, string> = {
  store_visit: 'Store Visit',
  tasting: 'Tasting',
  meeting: 'Meeting',
  order_commitment: 'Order Commitment',
  delivery: 'Delivery',
  sample_drop: 'Sample Drop',
  call: 'Call',
  email: 'Email',
};

export function PastConversations({ storeNumber }: { storeNumber: number }) {
  const [expanded, setExpanded] = useState(false);

  const feed = useQuery({
    queryKey: ['store-past-conversations', storeNumber],
    queryFn: () =>
      api.activities({ store_number: storeNumber, days: 730, limit: MAX_CONVERSATIONS }),
    enabled: Number.isFinite(storeNumber) && storeNumber > 0,
    retry: 1,
  });

  const rows = (feed.data?.activities ?? []).slice(0, MAX_CONVERSATIONS);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);

  return (
    <div
      className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-3 space-y-2"
      data-panel="past-conversations"
    >
      <div className="flex items-center gap-2">
        <MessageSquareText size={14} className="text-[var(--color-accent)]" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Past conversations
        </span>
        {rows.length > 0 && (
          <span className="text-[11px] text-muted tabular-nums">last {rows.length}</span>
        )}
      </div>

      {/* Gate on DATA, not isLoading — a paused/offline query must show a
          skeleton, never a silent empty panel. */}
      {!feed.data && !feed.isError && <div className="skeleton h-14" />}
      {feed.isError && (
        <div className="text-xs text-muted py-1">
          Prior conversations are not reachable right now.
        </div>
      )}
      {feed.data && rows.length === 0 && (
        <div className="text-xs text-muted py-1">
          No conversations logged at this store yet — this note is the first one.
        </div>
      )}

      {shown.map((a) => (
        <div
          key={a.id}
          className="rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] p-2.5 space-y-1"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold">
              {ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}
            </span>
            <span className="text-muted shrink-0 tabular-nums">
              {a.created_at ? relativeTime(a.created_at) : ''}
            </span>
          </div>
          <div className="text-[11px] text-muted">
            {a.rep}
            {a.created_at ? ` · ${formatDate(a.created_at)}` : ''}
          </div>
          {(a.outcome || a.notes) && (
            <div className="text-xs whitespace-pre-wrap">
              {[a.outcome, a.notes].filter(Boolean).join(' — ')}
            </div>
          )}
          {a.next_action && (
            <div className="text-[11px] text-[var(--color-accent)]">
              Next: {a.next_action}
              {a.next_action_date ? ` · ${formatDate(a.next_action_date)}` : ''}
            </div>
          )}
        </div>
      ))}

      {rows.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-background)] border border-[var(--color-card-border)]"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Show less' : `Show ${rows.length - COLLAPSED_COUNT} more`}
        </button>
      )}
    </div>
  );
}

/* ===== Contacts at log time ===== */

const CONTACT_FIELDS = [
  { key: 'manager_name', label: 'Manager' },
  { key: 'asst_manager_name', label: 'Assistant Manager' },
  { key: 'spirits_ambassador', label: 'Spirits Ambassador' },
] as const;

type ContactKey = (typeof CONTACT_FIELDS)[number]['key'];
type ContactForm = Record<ContactKey, string>;

const EMPTY_FORM: ContactForm = {
  manager_name: '',
  asst_manager_name: '',
  spirits_ambassador: '',
};

/** The restore candidate for a field: the backend's `previous` (most recent
 *  prior value that is neither blank nor the current value), falling back to
 *  a scan of the newest-first history if it is absent. */
function previousValue(
  payload: StoreContactsHistoryPayload | null | undefined,
  field: ContactKey,
): string {
  const block = payload?.contacts?.[field];
  if (!block) return '';
  if (block.previous) return block.previous;
  const hit = (block.history ?? []).find(
    (h) => h.old && h.old !== block.current,
  );
  return hit?.old ?? '';
}

export function LogContactsCard({
  storeNumber,
  rep,
  registerSave,
}: {
  storeNumber: number;
  rep: string | null;
  /** Lets the parent flush unsaved contact edits inside its visit submit. */
  registerSave?: (fn: () => Promise<void>) => void;
}) {
  const qc = useQueryClient();
  const enabled = Number.isFinite(storeNumber) && storeNumber > 0;

  const full = useQuery({
    queryKey: ['store-full', storeNumber],
    queryFn: () => api.storeFull(storeNumber),
    enabled,
    retry: 1,
  });

  // Graceful fallback: the endpoint is new backend surface — swallow errors
  // (404 while it deploys) and simply hide the previous-value rows.
  const history = useQuery({
    queryKey: ['store-contacts-history', storeNumber],
    queryFn: async () => {
      try {
        return await api.storeContactsHistory(storeNumber);
      } catch {
        return null;
      }
    },
    enabled,
    retry: false,
  });

  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<ContactForm>(EMPTY_FORM);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  // Pre-fill from the store record; re-prime whenever the store changes.
  useEffect(() => {
    const s = full.data?.store;
    if (!s || s.store_number !== storeNumber) return;
    if (loadedFor === storeNumber) return;
    const next: ContactForm = {
      manager_name: s.manager_name ?? '',
      asst_manager_name: s.asst_manager_name ?? '',
      spirits_ambassador: s.spirits_ambassador ?? '',
    };
    setForm(next);
    setBaseline(next);
    setLoadedFor(storeNumber);
  }, [full.data, storeNumber, loadedFor]);

  const storeId = full.data?.store?.id ?? null;
  const dirty = useMemo(
    () => CONTACT_FIELDS.some((f) => form[f.key] !== baseline[f.key]),
    [form, baseline],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['store-full', storeNumber] });
    qc.invalidateQueries({ queryKey: ['store-contacts-history', storeNumber] });
  };

  const save = useMutation({
    mutationFn: async (fields: Partial<ContactForm>) => {
      if (!storeId) throw new Error('Store record not loaded yet');
      return api.updateStore(storeId, { ...fields, updated_by: rep || 'rep' });
    },
    onSuccess: (_r, fields) => {
      const next = { ...form, ...fields };
      setForm(next);
      setBaseline(next);
      toast.success('Contacts saved (audited)');
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  // Expose "flush unsaved edits" so the visit submit can save contacts too.
  const flushRef = useRef<() => Promise<void>>(async () => {});
  flushRef.current = async () => {
    if (!dirty || !storeId) return;
    const changed: Partial<ContactForm> = {};
    for (const f of CONTACT_FIELDS) {
      if (form[f.key] !== baseline[f.key]) changed[f.key] = form[f.key];
    }
    await save.mutateAsync(changed);
  };
  useEffect(() => {
    registerSave?.(() => flushRef.current());
  }, [registerSave]);

  const saveDirty = () => {
    const changed: Partial<ContactForm> = {};
    for (const f of CONTACT_FIELDS) {
      if (form[f.key] !== baseline[f.key]) changed[f.key] = form[f.key];
    }
    if (Object.keys(changed).length > 0) save.mutate(changed);
  };

  return (
    <div
      className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-3 space-y-3"
      data-panel="log-contacts"
    >
      <div className="flex items-center gap-2">
        <UserRound size={14} className="text-[var(--color-accent)]" />
        <span className="text-xs font-semibold uppercase tracking-wider">Store contacts</span>
      </div>
      <p className="text-[11px] text-muted -mt-1.5">
        Names stay on the store record until changed. Every edit is audited, and the
        previous value is one tap away.
      </p>

      {/* Gate on DATA, not isLoading (same rule as the top-100 board). */}
      {!full.data && !full.isError && <div className="skeleton h-24" />}
      {full.isError && (
        <div className="text-xs text-muted">Store record not reachable right now.</div>
      )}

      {full.data && (
        <>
          {CONTACT_FIELDS.map((f) => {
            const prev = previousValue(history.data, f.key);
            const showPrev = prev !== '' && prev !== form[f.key];
            return (
              <div key={f.key}>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1">
                  {f.label}
                </label>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={`${f.label} name`}
                  className="select"
                />
                {showPrev && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                    <History size={11} className="shrink-0" />
                    <span className="truncate">
                      previous: <span className="text-[var(--color-foreground)]">{prev}</span>
                    </span>
                    <button
                      type="button"
                      disabled={save.isPending || !storeId}
                      onClick={() => save.mutate({ [f.key]: prev })}
                      className="ml-auto shrink-0 inline-flex items-center gap-1 text-[var(--color-accent)] font-semibold disabled:opacity-50"
                    >
                      <Undo2 size={11} /> Restore
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={saveDirty}
            disabled={!dirty || save.isPending || !storeId}
            className="w-full h-10 rounded-lg text-xs font-semibold bg-[var(--color-background)] border border-[var(--color-card-border)] text-[var(--color-accent)] disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : dirty ? 'Save contacts' : 'Contacts saved'}
          </button>
        </>
      )}
    </div>
  );
}

/** Convenience wrapper for /log: past conversations + contacts together. */
export function StoreLogContext({
  storeNumber,
  rep,
  registerSave,
}: {
  storeNumber: number;
  rep: string | null;
  registerSave?: (fn: () => Promise<void>) => void;
}) {
  return (
    <div className="space-y-3">
      <PastConversations storeNumber={storeNumber} />
      <LogContactsCard storeNumber={storeNumber} rep={rep} registerSave={registerSave} />
    </div>
  );
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { use, useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  Navigation,
  ArrowLeft,
  Store as StoreIcon,
  CheckCircle,
  Plus,
  Activity as ActivityIcon,
  Target,
  Zap,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type ReconcileRow } from '@/lib/api';
import { useActiveRep } from '@/lib/active-rep';
import { REP_ROSTER } from '@/lib/reps';
import { TRACKED_SKUS } from '@/lib/skus';
import { FreshnessBanner } from '@/components/freshness-banner';
import { FlagChip } from '@/components/dripp-bits';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber, formatDate, statusBadgeClass, statusLabel, relativeTime } from '@/lib/utils';

export default function StorePage({
  params,
}: {
  params: Promise<{ storeNumber: string }>;
}) {
  const { storeNumber } = use(params);
  const n = Number(storeNumber);
  const [activeRep] = useActiveRep();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'replace' | 'activity' | 'deals'>('overview');

  const full = useQuery({ queryKey: ['store-full', n], queryFn: () => api.storeFull(n) });
  const inv = useQuery({ queryKey: ['store-inv', n], queryFn: () => api.storeInventory(n) });
  const replace = useQuery({
    queryKey: ['replace-targets', n],
    queryFn: () => api.replaceTargets(n),
  });
  const activity = useQuery({
    queryKey: ['activities', { store_number: n }],
    queryFn: () => api.activities({ store_number: n, days: 90 }),
  });
  const deals = useQuery({
    queryKey: ['deals', { store_number: n }],
    queryFn: () => api.deals({ store_number: n }),
  });
  // 3-way mini-reconcile for THIS store — shares the /reconcile 30-day cache.
  const reconcile = useQuery({
    queryKey: ['reconcile', 30],
    queryFn: () => api.reconcile(30),
    retry: 1,
  });
  const miniRows = (reconcile.data?.rows ?? []).filter((r) => r.store_number === n);

  const pitchDeal = useMutation({
    mutationFn: (body: { sku: string; competitor_sku: string; notes: string }) =>
      api.createDeal({
        store_number: n,
        sku: body.sku,
        stage: 'prospecting',
        owner_rep: activeRep ?? '',
        notes: `Pitch to replace competitor SKU ${body.competitor_sku}. ${body.notes}`,
        source: 'replace_targets',
      }),
    onSuccess: () => {
      toast.success('Pitch added to pipeline');
      qc.invalidateQueries({ queryKey: ['deals', { store_number: n }] });
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  // "I saw it on shelf" override — feeds the commission audit reconciliation
  const observe = useMutation({
    mutationFn: (body: { sku: string; on_shelf: boolean; units?: number; notes?: string }) =>
      api.observeListing({
        sku: body.sku,
        store_number: n,
        rep: activeRep ?? '',
        on_shelf: body.on_shelf,
        units: body.units,
        notes: body.notes,
      }),
    onSuccess: () => {
      toast.success('Observation logged — counts toward your commission audit', {
        duration: 5000,
      });
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });
  const [showObserveForm, setShowObserveForm] = useState(false);
  const [obsSku, setObsSku] = useState('');
  const [obsUnits, setObsUnits] = useState<string>('');
  const [obsNotes, setObsNotes] = useState('');

  const s = full.data?.store;
  const phone = s?.manager_phone || s?.phone || '';
  const email = s?.store_email || s?.email || '';

  return (
    <div className="space-y-4 pb-24">
      <Link
        href="/today"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--color-accent)]"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      {/* Store header */}
      <Card>
        <CardContent className="pt-4">
          {full.isLoading && <div className="skeleton h-24" />}
          {s && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl font-bold"
                  style={{
                    background: s.territory_color + '33',
                    color: s.territory_color,
                  }}
                >
                  <StoreIcon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="!text-xl">#{s.store_number}</h1>
                  <div className="text-sm font-medium">{s.account}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {s.address}, {s.city} {s.postal}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span
                      className="change-chip"
                      style={{
                        background: s.territory_color + '33',
                        color: s.territory_color,
                      }}
                    >
                      {s.territory_name}
                    </span>
                    {s.priority && (
                      <span className="change-chip change-BASELINE">{s.priority}</span>
                    )}
                    {s.rep && (
                      <span className="change-chip change-STATUS_FLIP">Rep: {s.rep}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                <Link
                  href={`/log?store=${n}${activeRep ? `&rep=${encodeURIComponent(activeRep)}` : ''}`}
                  className="flex flex-col items-center justify-center gap-1 h-16 rounded-lg bg-[var(--color-primary)] text-white text-[11px] font-semibold"
                >
                  <Plus size={18} />
                  Log
                </Link>
                <a
                  href={phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '#'}
                  onClick={(e) => {
                    if (!phone) {
                      e.preventDefault();
                      toast.info('No phone number on file');
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-1 h-16 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-[11px] font-semibold"
                >
                  <Phone size={18} />
                  Call
                </a>
                <a
                  href={email ? `mailto:${email}` : '#'}
                  onClick={(e) => {
                    if (!email) {
                      e.preventDefault();
                      toast.info('No email on file');
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-1 h-16 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-[11px] font-semibold"
                >
                  <Mail size={18} />
                  Email
                </a>
                <a
                  href={
                    s.lat && s.lng
                      ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
                      : '#'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1 h-16 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-[11px] font-semibold"
                >
                  <Navigation size={18} />
                  Drive
                </a>
              </div>

              {/* Inline-editable contact card — reps populate this during visits */}
              <ContactCard
                storeId={s.id}
                initial={s}
                lastUpdated={full.data?.contacts_last_updated ?? null}
                onSaved={() => full.refetch()}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <FreshnessBanner />

      {/* Tab strip */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
        {(
          [
            { key: 'overview', label: 'Our SKUs', icon: CheckCircle },
            { key: 'replace', label: 'Replace These', icon: Zap },
            { key: 'activity', label: 'Activity', icon: ActivityIcon },
            { key: 'deals', label: 'Pipeline', icon: Target },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const sel = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold min-h-11 ${
                sel
                  ? 'bg-[var(--color-accent)] text-[var(--color-primary-fg)]'
                  : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.key === 'replace' && replace.data?.categories && replace.data.categories.length > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({replace.data.categories.reduce((sum, c) => sum + c.targets.length, 0)})
                </span>
              )}
              {t.key === 'activity' && activity.data && (
                <span className="ml-1 text-xs opacity-70">({activity.data.activities.length})</span>
              )}
              {t.key === 'deals' && deals.data && (
                <span className="ml-1 text-xs opacity-70">({deals.data.deals.length})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Our SKUs */}
      {tab === 'overview' && (
        <div className="space-y-2.5">
          {/* Mini reconcile: SOD vs lcbo.com vs rep-observed, side by side */}
          <MiniReconcile
            rows={miniRows}
            loading={!reconcile.data && !reconcile.isError}
          />

          {inv.isLoading &&
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}
          {inv.data?.sod.map((s) => (
            <div key={s.sku} className="m-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/skus/${s.sku}`}
                    className="font-medium hover:text-[var(--color-accent)]"
                  >
                    {s.product_name}
                  </Link>
                  <div className="text-xs text-muted">
                    {s.brand} · <span className="font-mono">{s.sku}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={statusBadgeClass(s.status)}>{statusLabel(s.status)}</span>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted">on-hand</div>
                    <div className="font-bold tabular-nums">{formatNumber(s.on_hand)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {inv.data?.sod.length === 0 && (
            <div className="m-card text-center text-muted py-6">
              None of our tracked SKUs are at this store right now.
            </div>
          )}

          {/* Missing opportunities — tracked SKUs NOT at this store */}
          {inv.data?.missing_skus && inv.data.missing_skus.length > 0 && (
            <div className="m-card border-[rgba(253,203,110,0.3)] bg-[rgba(253,203,110,0.04)]">
              <div className="flex items-start gap-3">
                <Target size={18} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    Missing opportunities ({inv.data.missing_skus.length})
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    These tracked SKUs are NOT at this store right now — distribution
                    gaps to pitch.
                  </div>
                  <div className="mt-2.5 space-y-1">
                    {inv.data.missing_skus.map((m) => (
                      <div
                        key={m.sku}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-[var(--color-background)] border border-[var(--color-card-border)] text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/skus/${m.sku}`}
                            className="font-medium hover:text-[var(--color-accent)]"
                          >
                            {m.product_name}
                          </Link>
                          <div className="text-muted">
                            {m.brand} · <span className="font-mono">{m.sku}</span>
                          </div>
                        </div>
                        <span className="change-chip change-NEW_LISTING text-[10px]">
                          gap
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* "I saw it on shelf" — catches SOD undercounts so we get paid for
              every actual listing. Submitted observations feed the
              3-way reconciliation (SOD vs lcbo.com vs rep-observed). */}
          <div className="m-card border-[rgba(216,173,88,0.3)] bg-[rgba(216,173,88,0.04)]">
            <div className="flex items-start gap-3">
              <Eye size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">See a bottle SOD missed?</div>
                <div className="text-xs text-muted mt-0.5">
                  If you spot one of our SKUs on shelf but it&apos;s not in the list above,
                  log it here. Each observation feeds our commission audit so we get paid
                  for every actual listing.
                </div>
                {!showObserveForm ? (
                  <button
                    onClick={() => {
                      if (!activeRep) {
                        toast.error('Pick your rep name on /today first');
                        return;
                      }
                      setShowObserveForm(true);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary-fg)] text-sm font-semibold"
                  >
                    <Plus size={14} /> I saw it on shelf
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <select
                      value={obsSku}
                      onChange={(e) => setObsSku(e.target.value)}
                      className="select w-full"
                    >
                      <option value="">— pick a SKU —</option>
                      {TRACKED_SKUS.map((s) => (
                        <option key={s.sku} value={s.sku}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Approx units on shelf (optional)"
                      value={obsUnits}
                      onChange={(e) => setObsUnits(e.target.value)}
                      className="select w-full"
                      min={0}
                    />
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={obsNotes}
                      onChange={(e) => setObsNotes(e.target.value)}
                      className="select w-full"
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (!obsSku) {
                            toast.error('Pick a SKU');
                            return;
                          }
                          observe.mutate(
                            {
                              sku: obsSku,
                              on_shelf: true,
                              units: obsUnits ? Number(obsUnits) : undefined,
                              notes: obsNotes || undefined,
                            },
                            {
                              onSuccess: () => {
                                setShowObserveForm(false);
                                setObsSku('');
                                setObsUnits('');
                                setObsNotes('');
                              },
                            },
                          );
                        }}
                        disabled={observe.isPending || !obsSku}
                      >
                        {observe.isPending ? 'Saving…' : 'Submit observation'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowObserveForm(false);
                          setObsSku('');
                          setObsUnits('');
                          setObsNotes('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Replace These */}
      {tab === 'replace' && (
        <div className="space-y-3">
          {replace.isLoading && <div className="skeleton h-32" />}
          {replace.data?.categories.length === 0 && (
            <div className="m-card text-center text-muted py-8">
              No competitor SKUs found in our categories at this store.
            </div>
          )}
          {replace.data?.categories.map((c) => (
            <Card key={c.category}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.category}</CardTitle>
                    <CardDescription>
                      Pitch{' '}
                      <span className="text-[var(--color-accent)] font-semibold">
                        {c.pitch_our_brand} {c.pitch_our_product}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {c.targets.map((t) => (
                  <div
                    key={t.competitor_sku}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={statusBadgeClass(t.competitor_status)}>
                          {statusLabel(t.competitor_status)}
                        </span>
                        <span
                          className="change-chip"
                          style={{
                            color:
                              t.opportunity_score >= 50
                                ? 'var(--color-danger)'
                                : t.opportunity_score >= 25
                                  ? 'var(--color-warning)'
                                  : 'var(--color-muted)',
                            background:
                              t.opportunity_score >= 50
                                ? 'rgba(229,72,77,0.15)'
                                : t.opportunity_score >= 25
                                  ? 'rgba(253,203,110,0.15)'
                                  : 'rgba(255,255,255,0.06)',
                          }}
                        >
                          score {t.opportunity_score}
                        </span>
                      </div>
                      <div className="text-sm truncate">{t.competitor_name}</div>
                      <div className="text-xs text-muted">
                        {t.competitor_brand} · <span className="font-mono">{t.competitor_sku}</span>{' '}
                        · {t.competitor_on_hand} on hand
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        pitchDeal.mutate({
                          sku: c.pitch_our_sku,
                          competitor_sku: t.competitor_sku,
                          notes: `${t.competitor_brand} ${t.competitor_name} (${t.competitor_status}, ${t.competitor_on_hand} on hand)`,
                        })
                      }
                      disabled={pitchDeal.isPending}
                    >
                      Pitch
                    </Button>
                  </div>
                ))}
                {c.targets.length === 0 && (
                  <div className="text-xs text-muted text-center py-3">
                    No underperforming competitors in {c.category} at this store right now.
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Activity */}
      {tab === 'activity' && (
        <div className="space-y-2.5">
          {activity.isLoading && <div className="skeleton h-20" />}
          {activity.data?.activities.length === 0 && (
            <div className="m-card text-center text-muted py-6">No activity logged yet.</div>
          )}
          {activity.data?.activities.map((a) => (
            <div key={a.id} className="m-card">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="change-chip change-BASELINE">{a.activity_type}</span>
                <span className="text-xs text-muted">{relativeTime(a.created_at)}</span>
              </div>
              {a.outcome && <div className="font-medium text-sm">{a.outcome}</div>}
              {a.notes && (
                <div className="text-xs text-muted mt-1 whitespace-pre-wrap">{a.notes}</div>
              )}
              <div className="text-xs text-muted mt-2 flex items-center gap-3 flex-wrap">
                {a.rep && <span>by {a.rep}</span>}
                {a.duration_minutes > 0 && <span>· {a.duration_minutes} min</span>}
                {a.rating > 0 && <span>· {'★'.repeat(a.rating)}</span>}
                {a.next_action && <span>· next: {a.next_action}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Deals */}
      {tab === 'deals' && (
        <div className="space-y-2.5">
          {deals.isLoading && <div className="skeleton h-20" />}
          {deals.data?.deals.length === 0 && (
            <div className="m-card text-center text-muted py-6">
              No open deals at this store yet.
            </div>
          )}
          {deals.data?.deals.map((d) => (
            <div key={d.id} className="m-card">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="change-chip change-STATUS_FLIP">{d.stage}</span>
                <span className="text-xs text-muted">{d.probability}% confidence</span>
              </div>
              <div className="font-semibold">
                {d.brand} {d.product_name}
              </div>
              <div className="text-xs text-muted">
                <span className="font-mono">{d.sku}</span> · owner: {d.owner_rep || '—'}
              </div>
              {d.next_action && (
                <div className="text-xs mt-2 p-2 rounded bg-[var(--color-background)] border border-[var(--color-card-border)]">
                  <strong>Next:</strong> {d.next_action}
                  {d.next_action_date && (
                    <span className="text-muted"> · by {formatDate(d.next_action_date)}</span>
                  )}
                </div>
              )}
              {d.notes && (
                <div className="text-xs text-muted mt-1.5 whitespace-pre-wrap">{d.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Side-by-side SOD / lcbo.com / rep-observed counts for both SKUs at this
 * store, with the reconciliation flag. Pulled from the same /api/reconcile
 * payload the full board uses (30-day rep-observation window).
 */
function MiniReconcile({ rows, loading }: { rows: ReconcileRow[]; loading: boolean }) {
  if (loading) return <div className="skeleton h-24" />;
  if (rows.length === 0) return null;
  return (
    <div className="m-card">
      <div className="text-sm font-semibold mb-2">Three sources, side by side</div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.sku}
            className="rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] p-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-xs font-semibold">
                {TRACKED_SKUS.find((s) => s.sku === r.sku)?.brand ?? r.sku}
                <span className="text-muted font-normal font-mono ml-1.5">{r.sku}</span>
              </div>
              <FlagChip flag={r.flag} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div>
                <div className="text-base font-bold tabular-nums">
                  {r.sod_on_hand != null ? formatNumber(r.sod_on_hand) : '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">SOD</div>
                {r.sod_snapshot_date && (
                  <div className="text-[10px] text-muted">{r.sod_snapshot_date}</div>
                )}
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-[var(--color-accent)]">
                  {r.live_qty != null ? formatNumber(r.live_qty) : '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">lcbo.com</div>
                {r.live_checked_at && (
                  <div className="text-[10px] text-muted">{relativeTime(r.live_checked_at)}</div>
                )}
              </div>
              <div>
                <div className="text-base font-bold tabular-nums">
                  {r.rep_units != null
                    ? formatNumber(r.rep_units)
                    : r.rep_on_shelf === true
                      ? 'on shelf'
                      : r.rep_on_shelf === false
                        ? '0'
                        : '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">rep saw</div>
                {r.rep_observed_at && (
                  <div className="text-[10px] text-muted">
                    {relativeTime(r.rep_observed_at)}
                    {r.rep ? ` · ${r.rep}` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactCard({
  storeId,
  initial,
  lastUpdated,
  onSaved,
}: {
  storeId: number;
  initial: {
    manager_name?: string;
    manager_phone?: string;
    asst_manager_name?: string;
    store_email?: string;
    phone?: string;
    rep?: string;
    priority?: string;
    spirits_ambassador?: string;
    store_notes?: string;
  };
  lastUpdated: { changed_by: string; changed_at: string; field?: string } | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    manager_name: initial.manager_name ?? '',
    manager_phone: initial.manager_phone ?? '',
    asst_manager_name: initial.asst_manager_name ?? '',
    store_email: initial.store_email ?? '',
    phone: initial.phone ?? '',
    rep: initial.rep ?? '',
    priority: initial.priority ?? '',
    spirits_ambassador: initial.spirits_ambassador ?? '',
    store_notes: initial.store_notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateStore(storeId, form);
      toast.success('Contact info saved');
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error('Save failed', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const hasAny =
      form.manager_name ||
      form.manager_phone ||
      form.asst_manager_name ||
      form.store_email ||
      form.phone ||
      form.rep ||
      form.priority ||
      form.spirits_ambassador ||
      form.store_notes;
    return (
      <div className="text-xs pt-2 border-t border-[var(--color-card-border)] flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-0.5 text-muted">
          {form.manager_name && (
            <div>
              Manager: <span className="text-[var(--color-foreground)]">{form.manager_name}</span>
              {form.manager_phone && <span> · {form.manager_phone}</span>}
            </div>
          )}
          {form.asst_manager_name && <div>Asst: {form.asst_manager_name}</div>}
          {form.spirits_ambassador && (
            <div>
              Spirits Ambassador:{' '}
              <span className="text-[var(--color-foreground)]">{form.spirits_ambassador}</span>
            </div>
          )}
          {form.phone && !form.manager_phone && <div>Phone: {form.phone}</div>}
          {form.store_email && <div>Email: {form.store_email}</div>}
          {form.rep && <div>Rep: {form.rep}</div>}
          {form.store_notes && (
            <div className="mt-1.5 p-2 rounded bg-[var(--color-background)] border border-[var(--color-card-border)] whitespace-pre-wrap text-[var(--color-foreground)]">
              {form.store_notes}
            </div>
          )}
          {!hasAny && (
            <div className="italic text-[var(--color-warning)]">
              No contact info on file — tap Edit to add manager / spirits ambassador / phone /
              notes
            </div>
          )}
          {lastUpdated && (
            <div className="text-[10px] pt-1 text-muted">
              Last updated by{' '}
              <span className="text-[var(--color-foreground)]">{lastUpdated.changed_by}</span> on{' '}
              {formatDate(lastUpdated.changed_at)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[var(--color-accent)] underline shrink-0"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="text-xs pt-2 border-t border-[var(--color-card-border)] space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Manager name"
          value={form.manager_name}
          onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
          className="select"
        />
        <input
          type="tel"
          placeholder="Manager phone"
          value={form.manager_phone}
          onChange={(e) => setForm({ ...form, manager_phone: e.target.value })}
          className="select"
        />
        <input
          type="text"
          placeholder="Asst. manager name"
          value={form.asst_manager_name}
          onChange={(e) => setForm({ ...form, asst_manager_name: e.target.value })}
          className="select"
        />
        <input
          type="tel"
          placeholder="Store phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="select"
        />
        <input
          type="email"
          placeholder="Store email"
          value={form.store_email}
          onChange={(e) => setForm({ ...form, store_email: e.target.value })}
          className="select col-span-2"
        />
        <input
          type="text"
          placeholder="Spirits Ambassador name"
          value={form.spirits_ambassador}
          onChange={(e) => setForm({ ...form, spirits_ambassador: e.target.value })}
          className="select col-span-2"
          maxLength={120}
        />
        <select
          value={form.rep}
          onChange={(e) => setForm({ ...form, rep: e.target.value })}
          className="select"
        >
          <option value="">— Rep —</option>
          {REP_ROSTER.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="select"
        >
          <option value="">— Priority —</option>
          <option value="A">A — Top</option>
          <option value="B">B — Strong</option>
          <option value="C">C — Standard</option>
        </select>
        <textarea
          placeholder="Store notes (planograms, restocking schedule, manager preferences, etc.)"
          value={form.store_notes}
          onChange={(e) => setForm({ ...form, store_notes: e.target.value })}
          className="select col-span-2 min-h-[68px]"
          maxLength={2000}
          rows={3}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 bg-[var(--color-accent)] text-[var(--color-primary-fg)] rounded-lg py-2 font-semibold text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-4 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

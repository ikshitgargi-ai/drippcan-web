'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Coffee,
  Phone,
  Mail,
  Box,
  Eye,
  Sparkles,
  Users,
  ClipboardCheck,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type ActivityCreate, type DealStage } from '@/lib/api';
import { captureSilentGeo } from '@/lib/silent-geo';
import { useActiveRep } from '@/lib/active-rep';
import { REP_ROSTER } from '@/lib/reps';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StoreLookup } from '@/components/store-lookup';
import { StoreLogContext } from '@/components/log-store-context';

const ACTIVITY_TYPES = [
  { key: 'store_visit', label: 'Store Visit', icon: Eye },
  { key: 'tasting', label: 'Tasting', icon: Coffee },
  { key: 'meeting', label: 'Meeting', icon: Users },
  { key: 'order_commitment', label: 'Order Commitment', icon: ClipboardCheck },
  { key: 'delivery', label: 'Delivery', icon: Truck },
  { key: 'sample_drop', label: 'Sample Drop', icon: Box },
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'email', label: 'Email', icon: Mail },
];

const SKU_OUTCOMES = [
  { key: '', label: '— no change —' },
  { key: 'discussed', label: 'Discussed' },
  { key: 'sampled', label: 'Sampled' },
  { key: 'samples_left', label: 'Samples Left' },
  { key: 'order_placed', label: 'Order Placed' },
  { key: 'declined', label: 'Declined' },
  { key: 'follow_up', label: 'Needs follow-up' },
];

const PIPELINE_STAGES: { key: DealStage; label: string }[] = [
  { key: 'prospecting', label: 'Prospecting' },
  { key: 'pitched', label: 'Pitched' },
  { key: 'tasting_scheduled', label: 'Tasting Scheduled' },
  { key: 'tasting_done', label: 'Tasting Done' },
  { key: 'samples_left', label: 'Samples Left' },
  { key: 'in_review', label: 'In Review' },
  { key: 'listed', label: 'Listed (Won)' },
  { key: 'lost', label: 'Lost' },
];

function LogPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeRep, setActiveRep] = useActiveRep();

  // Pre-fill from URL
  const urlStore = params.get('store');
  const urlRep = params.get('rep');

  useEffect(() => {
    if (urlRep && !activeRep) setActiveRep(urlRep);
  }, [urlRep, activeRep, setActiveRep]);

  const [storeNumber, setStoreNumber] = useState<string>(urlStore ?? '');
  const [activityType, setActivityType] = useState<string>('store_visit');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [rating, setRating] = useState(0);
  const [duration, setDuration] = useState<number | ''>('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [advanceStage, setAdvanceStage] = useState<DealStage | ''>('');
  const [skuOutcomes, setSkuOutcomes] = useState<Record<string, { outcome: string; facings: number; notes: string }>>({});

  const reps = useQuery({ queryKey: ['reps'], queryFn: api.reps });
  const tracked = useQuery({ queryKey: ['sod-products', true], queryFn: () => api.sodProducts(true) });
  const trackedList = tracked.data?.products ?? tracked.data?.rows ?? [];

  const parsedStore = parseInt(storeNumber, 10);
  const hasStore = Number.isFinite(parsedStore) && parsedStore > 0;

  // Contacts flush hook — the contacts card registers its "save unsaved
  // edits" function here so the visit submit saves both in one tap.
  const contactsSaveRef = useRef<(() => Promise<void>) | null>(null);
  const registerContactsSave = useCallback((fn: () => Promise<void>) => {
    contactsSaveRef.current = fn;
  }, []);

  const submit = useMutation({
    mutationFn: async () => {
      if (!activeRep) throw new Error('Pick a rep first');
      if (!storeNumber) throw new Error('Pick a store');
      // Save any unsaved contact edits together with the visit. A contact
      // save failure must never block the visit log itself — the contacts
      // card surfaces its own error toast.
      try {
        await contactsSaveRef.current?.();
      } catch {
        /* toast raised by the contacts card */
      }
      // Silent geo — never shown in UI, only attached to the payload.
      const geo = await captureSilentGeo();
      const body: ActivityCreate = {
        rep: activeRep,
        store_number: parseInt(storeNumber, 10),
        activity_type: activityType,
        outcome,
        notes,
        rating,
        duration_minutes: typeof duration === 'number' ? duration : 0,
        next_action: nextAction,
        next_action_date: nextActionDate || undefined,
        advance_pipeline_stage: advanceStage || undefined,
        sku_outcomes: Object.entries(skuOutcomes)
          .filter(([_, v]) => v.outcome)
          .map(([sku, v]) => ({
            sku,
            outcome: v.outcome,
            facings: v.facings,
            competitor_notes: v.notes,
          })),
        ...(geo ? {
          lat: geo.lat,
          lng: geo.lng,
          accuracy_m: geo.accuracy_m,
          client_ts: geo.client_ts,
        } : {}),
      };
      return api.logActivity(body);
    },
    onSuccess: () => {
      toast.success('Activity logged');
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['quotas'] });
      router.push('/activity');
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-4 pb-24">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Quick log</span>
        </div>
        <h1>Log Activity</h1>
        <p className="text-muted text-sm">
          Visits, tastings, sample drops, calls, emails. Per-SKU outcomes drive deal pipeline
          automatically.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Who & where</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Rep</Label>
            <select
              value={activeRep ?? ''}
              onChange={(e) => setActiveRep(e.target.value || null)}
              className="select"
            >
              <option value="">— pick rep —</option>
              {/* Official roster (lib/reps) — the reps table only contains
                  reps who already logged activity (chicken-and-egg). */}
              {REP_ROSTER.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Store</Label>
            <StoreLookup
              value={storeNumber}
              onChange={setStoreNumber}
              placeholder="Type store # OR name OR address OR postal…"
              onResolved={(s) => {
                if (s) setStoreNumber(String(s.store_number));
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Past conversations + store contacts — visible BEFORE the new note
          is written, so the rep walks in knowing what was said last time. */}
      {hasStore && (
        <StoreLogContext
          key={parsedStore}
          storeNumber={parsedStore}
          rep={activeRep}
          registerSave={registerContactsSave}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {ACTIVITY_TYPES.map((t) => {
              const Icon = t.icon;
              const sel = activityType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActivityType(t.key)}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border min-h-[88px] ${
                    sel
                      ? 'border-[var(--color-accent)] bg-[rgba(212,165,116,0.08)]'
                      : 'border-[var(--color-card-border)] bg-[var(--color-card)]'
                  }`}
                >
                  <Icon
                    size={24}
                    style={{ color: sel ? 'var(--color-accent)' : 'var(--color-muted)' }}
                  />
                  <span className="text-xs font-medium text-center leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-SKU outcomes</CardTitle>
          <CardDescription>
            What happened with each tracked product? Used to advance the deal pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {trackedList.map((p) => {
            const cur = skuOutcomes[p.sku] ?? { outcome: '', facings: 0, notes: '' };
            return (
              <div
                key={p.sku}
                className="p-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)]"
              >
                <div className="font-medium text-sm">
                  {p.brand} {p.product_name}
                </div>
                <div className="text-xs text-muted font-mono mb-2">SKU {p.sku}</div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={cur.outcome}
                    onChange={(e) =>
                      setSkuOutcomes((prev) => ({
                        ...prev,
                        [p.sku]: { ...cur, outcome: e.target.value },
                      }))
                    }
                    className="select"
                  >
                    {SKU_OUTCOMES.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Facings"
                    value={cur.facings || ''}
                    onChange={(e) =>
                      setSkuOutcomes((prev) => ({
                        ...prev,
                        [p.sku]: { ...cur, facings: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="select"
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcome &amp; rating</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Outcome</Label>
            <input
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Met manager Sarah, very receptive"
              className="select"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detailed notes…"
              className="select min-h-[88px] resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Visit rating (1-5)</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`flex-1 h-11 rounded-lg font-semibold ${
                      rating >= n
                        ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
                        : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Duration (min)</Label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) =>
                  setDuration(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                placeholder="20"
                className="select"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next action</CardTitle>
          <CardDescription>What needs to happen next + when?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Action</Label>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Follow up on tasting outcome"
              className="select"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="select"
              />
            </div>
            <div>
              <Label>Advance deal stage</Label>
              <select
                value={advanceStage}
                onChange={(e) => setAdvanceStage(e.target.value as DealStage | '')}
                className="select"
              >
                <option value="">— don&apos;t change —</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky bottom CTA */}
      <div className="mobile-cta-bar lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
            className="flex-1"
          >
            <XCircle size={18} /> Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !activeRep || !storeNumber}
            className="flex-[2]"
          >
            <CheckCircle2 size={18} />
            {submit.isPending ? 'Saving…' : 'Save Activity'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1">
      {children}
    </label>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96" />}>
      <LogPageInner />
    </Suspense>
  );
}

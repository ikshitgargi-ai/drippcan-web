'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Database,
  Globe2,
  MapPin,
  Navigation,
  Plus,
  Tag,
  TrendingUp,
  X,
  Activity as ActivityIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { captureSilentGeo } from '@/lib/silent-geo';
import { useActiveRep } from '@/lib/active-rep';
import { REP_ROSTER } from '@/lib/reps';
import { TRACKED_SKUS } from '@/lib/skus';
import { FreshnessBanner } from '@/components/freshness-banner';
import { Button } from '@/components/ui/button';
import { StoreLookup } from '@/components/store-lookup';
import { PastConversations } from '@/components/log-store-context';
import { formatNumber, relativeTime } from '@/lib/utils';

/**
 * HOME — deliberately simple. One screen answers:
 *   #skus  — how are Phoenix & Dayaa doing? (stores, on hand, live qty)
 *   territory — how big is the book we're working?
 *   #intel — OOS risk count, new listings count, last SOD/live sync times
 * Everything deeper lives on its own page (nav drawer).
 */
export default function HomePage() {
  const [activeRep] = useActiveRep();
  const [logSheet, setLogSheet] = useState(false);
  const qc = useQueryClient();

  const dash = useQuery({ queryKey: ['crm-dashboard'], queryFn: () => api.crmDashboard() });
  const oos = useQuery({ queryKey: ['oos', 2], queryFn: () => api.oosRisk({ threshold: 2 }) });
  const digest = useQuery({ queryKey: ['digest', 7], queryFn: () => api.listingDigest(7, true) });
  const sodHealth = useQuery({ queryKey: ['sod-health'], queryFn: api.sodHealth });
  // New Dripp endpoints — degrade to placeholders until the backend ships them.
  const territory = useQuery({
    queryKey: ['territory-summary'],
    queryFn: () => api.territory(),
    retry: 1,
  });
  const live = useQuery({
    queryKey: ['live-latest'],
    queryFn: () => api.liveLatest(),
    retry: 1,
  });

  const rollup = dash.data?.tracked_sku_rollup ?? [];
  const rollupBySku = new Map(rollup.map((r) => [r.sku, r]));
  // /api/live/latest is keyed by SKU: { skus: { [sku]: { total_units, ... } } }
  const liveSkus = live.data?.skus;
  const liveChecked = liveSkus
    ? Object.values(liveSkus).reduce<string | null>(
        (best, blk) => (blk.checked_at && (!best || blk.checked_at > best) ? blk.checked_at : best),
        null,
      )
    : null;

  const newListings7d =
    (digest.data?.counts.find((c) => c.change_type === 'NEW_LISTING')?.count ?? 0) +
    (digest.data?.counts.find((c) => c.change_type === 'RELISTED')?.count ?? 0);

  // /api/territory returns { count, stores } — tier counts derived here.
  const territoryStores = territory.data?.stores;
  const byTier = territoryStores
    ? territoryStores.reduce<Record<string, number>>((acc, s) => {
        acc[s.tier] = (acc[s.tier] ?? 0) + 1;
        return acc;
      }, {})
    : undefined;
  const territoryTotal = territory.data?.count ?? territoryStores?.length ?? null;

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="muted-small font-semibold uppercase tracking-wider">
            Dripp Tracker
          </span>
        </div>
        <h1>Phoenix &amp; Dayaa at LCBO</h1>
        <p className="text-muted text-sm">
          SOD + lcbo.com + rep observations, reconciled. Nothing silently wrong or lost.
        </p>
      </header>

      <FreshnessBanner />

      {/* SECTION: the 2 SKU cards */}
      <section id="skus" className="scroll-mt-20 space-y-2.5">
        <SectionHeader icon={<Tag size={18} />} title="Our SKUs" linkLabel="Details" linkHref="/skus" />
        {dash.isLoading &&
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
        {TRACKED_SKUS.map((s) => {
          const r = rollupBySku.get(s.sku);
          const liveQty = liveSkus?.[s.sku]?.total_units ?? null;
          return (
            <Link key={s.sku} href={`/skus/${s.sku}`} className="m-card block">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="!text-base">{s.brand}</h3>
                    <span className="text-xs text-muted">#{s.sku}</span>
                  </div>
                  <div className="text-xs text-muted truncate">{s.name}</div>
                </div>
                <ChevronRight size={16} className="text-muted shrink-0" />
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-[var(--color-card-border)]">
                <KpiCell label="Stores (SOD)" value={r ? formatNumber(r.store_count) : '·'} />
                <KpiCell
                  label="On hand (SOD)"
                  value={r ? formatNumber(r.total_on_hand) : '·'}
                  color="var(--color-success)"
                />
                <KpiCell
                  label="Live (lcbo.com)"
                  value={liveQty != null ? formatNumber(liveQty) : '·'}
                  color="var(--color-accent)"
                />
              </div>
            </Link>
          );
        })}
      </section>

      {/* SECTION: territory summary */}
      <section className="scroll-mt-20 space-y-2.5">
        <SectionHeader
          icon={<Globe2 size={18} />}
          title="Territory"
          linkLabel="Store finder"
          linkHref="/finder"
        />
        {territory.isError || (!territory.isLoading && territoryTotal == null) ? (
          <div className="m-card text-sm text-muted">
            Territory book not seeded yet — run the territory ingest on the backend.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Stores" value={territoryTotal != null ? formatNumber(territoryTotal) : '·'} />
            <Stat label="Routed" value={byTier?.routed != null ? formatNumber(byTier.routed) : '·'} />
            <Stat
              label="Wider GTA"
              value={
                byTier
                  ? formatNumber((byTier.territory ?? 0) + (byTier.discovered ?? 0))
                  : '·'
              }
            />
          </div>
        )}
      </section>

      {/* SECTION: intel — risk, movement, sync freshness */}
      <section id="intel" className="scroll-mt-20 space-y-2.5">
        <SectionHeader icon={<ActivityIcon size={18} />} title="Intel" linkLabel="Full feed" linkHref="/intel" />
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/oos" className="m-card block">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
              <span>OOS Risk</span>
              <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
            </div>
            <div
              className="text-3xl font-bold mt-1.5 tabular-nums"
              style={{ color: 'var(--color-danger)' }}
            >
              {oos.data ? oos.data.length : '·'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">stores at ≤2 units</div>
          </Link>
          <Link href="/new-listings" className="m-card block">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted font-semibold">
              <span>New Listings 7d</span>
              <TrendingUp size={14} style={{ color: 'var(--color-success)' }} />
            </div>
            <div
              className="text-3xl font-bold mt-1.5 tabular-nums"
              style={{ color: 'var(--color-success)' }}
            >
              {digest.data ? newListings7d : '·'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">incl. relistings</div>
          </Link>
        </div>

        {/* Sync freshness — both sources, timestamps always visible */}
        <div className="m-card space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Database size={14} className="text-[var(--color-accent)]" />
              <span className="font-semibold">Last SOD sync</span>
            </div>
            <Link href="/sod" className="text-xs text-muted tabular-nums hover:text-[var(--color-accent)]">
              {sodHealth.data?.latest_snapshot
                ? `snapshot ${sodHealth.data.latest_snapshot}`
                : sodHealth.isLoading
                  ? '…'
                  : 'never'}
            </Link>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-[var(--color-accent)]" />
              <span className="font-semibold">Last lcbo.com check</span>
            </div>
            <span className="text-xs text-muted tabular-nums">
              {liveChecked
                ? relativeTime(liveChecked)
                : live.isLoading
                  ? '…'
                  : 'not yet run'}
            </span>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-2.5">
        <h2>Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          <ActionTile
            onClick={() => setLogSheet(true)}
            icon={<Plus size={20} />}
            label="Log"
            color="var(--color-primary)"
          />
          <ActionTile
            href="/today"
            icon={<Calendar size={20} />}
            label="Today"
            color="var(--color-accent)"
          />
          <ActionTile
            href="/nearby"
            icon={<Navigation size={20} />}
            label="Nearby"
            color="var(--color-success)"
          />
        </div>
      </section>

      {/* Floating "+" quick-log button */}
      <button
        onClick={() => setLogSheet(true)}
        aria-label="Log activity"
        className="fixed bottom-[80px] lg:bottom-6 right-4 z-30 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-[var(--color-primary)] text-white"
      >
        <Plus size={26} />
      </button>

      {logSheet && (
        <QuickLogSheet
          activeRep={activeRep}
          onClose={() => setLogSheet(false)}
          onLogged={() => {
            qc.invalidateQueries({ queryKey: ['crm-dashboard'] });
            qc.invalidateQueries({ queryKey: ['digest'] });
          }}
        />
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  linkLabel,
  linkHref,
}: {
  icon: React.ReactNode;
  title: string;
  linkLabel?: string;
  linkHref?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2">
        <span className="text-[var(--color-accent)]">{icon}</span>
        {title}
      </h2>
      {linkHref && linkLabel && (
        <Link href={linkHref} className="text-sm text-[var(--color-accent)] flex items-center gap-1">
          {linkLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function KpiCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div
        className="text-base font-bold tabular-nums mt-0.5"
        style={{ color: color ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="m-card text-center !p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ActionTile({
  href,
  onClick,
  icon,
  label,
  color,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  const inner = (
    <div className="m-card flex flex-col items-center justify-center gap-2 min-h-[88px] !p-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '22', color }}
      >
        {icon}
      </div>
      <div className="text-xs font-semibold">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href}>{inner}</Link>
  ) : (
    <button onClick={onClick} className="w-full text-left">
      {inner}
    </button>
  );
}

function QuickLogSheet({
  activeRep,
  onClose,
  onLogged,
}: {
  activeRep: string | null;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [, setActiveRep] = useActiveRep();
  const [rep, setLocalRep] = useState<string>(activeRep ?? '');
  const [mode, setMode] = useState<'visit' | 'listing'>('visit');
  const [storeNumber, setStoreNumber] = useState('');
  const [sku, setSku] = useState<string>(TRACKED_SKUS[0].sku);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityType, setActivityType] = useState<'store_visit' | 'tasting' | 'meeting' | 'order_commitment' | 'delivery' | 'sample_drop' | 'call' | 'email'>('store_visit');
  const [notes, setNotes] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));

  const handleRepChange = (next: string) => {
    setLocalRep(next);
    setActiveRep(next || null);  // also persist to localStorage so other pages know
  };

  const logListing = useMutation({
    mutationFn: () =>
      api.logListing({ sku, store_number: parseInt(storeNumber, 10), change_date: date }),
    onSuccess: (r) => {
      toast.success(
        r.status === 'duplicate_ignored'
          ? 'Already logged for that date'
          : `Logged ${r.brand} at #${r.store_number}`,
      );
      onLogged();
      onClose();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const logVisit = useMutation({
    mutationFn: async () => {
      if (!rep) throw new Error('Pick your name first');
      if (!storeNumber) throw new Error('Pick a store first');
      // Silent geo — captured without any UI feedback; failures are invisible.
      const geo = await captureSilentGeo();
      return api.logActivity({
        rep,
        store_number: parseInt(storeNumber, 10),
        activity_type: activityType,
        notes,
        visit_date: visitDate,
        ...(geo ? {
          lat: geo.lat,
          lng: geo.lng,
          accuracy_m: geo.accuracy_m,
          client_ts: geo.client_ts,
        } : {}),
      });
    },
    onSuccess: () => {
      toast.success(`Activity logged as ${rep}`);
      onLogged();
      onClose();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const submit = () => (mode === 'listing' ? logListing.mutate() : logVisit.mutate());

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--color-card)] rounded-t-2xl border-t border-x border-[var(--color-card-border)] p-5 pb-8 max-h-[85vh] overflow-y-auto safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2>Quick Log</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* REP SELECTOR — first thing rep sees. Self-select, persists in
            localStorage so they don't re-pick every time. */}
        <div
          className="mb-4 p-4 rounded-xl"
          style={{
            background: rep ? 'rgba(45,212,168,0.08)' : 'rgba(253,203,110,0.12)',
            border: `2px solid ${rep ? 'rgba(45,212,168,0.4)' : 'rgba(253,203,110,0.5)'}`,
          }}
        >
          <label className="text-xs uppercase tracking-wider font-bold block mb-2"
                 style={{ color: rep ? 'var(--color-success)' : 'var(--color-warning)' }}>
            👤 Logging as {rep ? `→ ${rep}` : '(PICK YOUR NAME)'}
          </label>
          <select
            value={rep}
            onChange={(e) => handleRepChange(e.target.value)}
            className="select w-full text-base"
            autoFocus={!rep}
            style={{ minHeight: 48 }}
          >
            <option value="">— pick your name —</option>
            {REP_ROSTER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {!rep && (
            <div className="text-xs mt-2" style={{ color: 'var(--color-warning)' }}>
              ⚠️ Pick your name above to enable logging. Saved for next time.
            </div>
          )}
          {rep && (
            <div className="text-xs mt-1.5 text-muted">
              Activity will log under <strong>{rep}</strong>. Tap dropdown to change.
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('visit')}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm ${
              mode === 'visit'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            Log Visit / Tasting / Call
          </button>
          <button
            onClick={() => setMode('listing')}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm ${
              mode === 'listing'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
            }`}
          >
            Mark New Listing
          </button>
        </div>

        <div className="space-y-3">
          {mode === 'listing' ? (
            <>
              <Field label="Product">
                <select value={sku} onChange={(e) => setSku(e.target.value)} className="select">
                  {TRACKED_SKUS.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Store number">
                <StoreLookup value={storeNumber} onChange={setStoreNumber} />
              </Field>
              <Field label="When">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="select"
                />
              </Field>
            </>
          ) : (
            <>
              {!activeRep && (
                <div className="p-3 rounded-lg bg-[rgba(253,203,110,0.08)] border border-[rgba(253,203,110,0.3)] text-xs">
                  Set an active rep on the{' '}
                  <Link href="/today" className="underline">/today</Link> page first.
                </div>
              )}
              <Field label="Store number">
                <StoreLookup value={storeNumber} onChange={setStoreNumber} />
              </Field>
              {/* Prior convos at this store — read before writing the new note. */}
              {Number.isFinite(parseInt(storeNumber, 10)) &&
                parseInt(storeNumber, 10) > 0 && (
                  <PastConversations
                    key={parseInt(storeNumber, 10)}
                    storeNumber={parseInt(storeNumber, 10)}
                  />
                )}
              <Field label="Activity">
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as typeof activityType)}
                  className="select"
                >
                  <option value="store_visit">Store Visit</option>
                  <option value="tasting">Tasting</option>
                  <option value="meeting">Meeting</option>
                  <option value="order_commitment">Order Commitment</option>
                  <option value="delivery">Delivery</option>
                  <option value="sample_drop">Sample Drop</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                </select>
              </Field>
              <Field label="When did this happen?">
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="select"
                />
                <span className="text-[10px] text-muted mt-1 block">
                  Backdating works — log a tasting from last week, last month, etc.
                </span>
              </Field>
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What happened?"
                  className="select min-h-[88px] resize-y"
                />
              </Field>
            </>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={submit}
            disabled={
              !storeNumber ||
              (mode === 'visit' && !rep) ||
              logListing.isPending ||
              logVisit.isPending
            }
            className="w-full"
          >
            {logListing.isPending || logVisit.isPending
              ? 'Saving…'
              : !rep && mode === 'visit'
                ? 'Pick your name first'
                : !storeNumber
                  ? 'Pick a store first'
                  : mode === 'listing'
                    ? 'Mark as Listed'
                    : `Save Activity (as ${rep})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

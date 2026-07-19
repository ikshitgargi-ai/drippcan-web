'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Download, Filter, MessageSquare, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  api,
  OWNER_STATUSES,
  type OwnerStatus,
  type Top100Payload,
  type Top100PriorityResponse,
  type Top100Row,
} from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { useOwnerMode } from '@/lib/owner-mode';
import { TierChip, AttributionChip, OWNER_STATUS_META } from '@/components/dripp-bits';
import { formatNumber, formatDate, relativeTime } from '@/lib/utils';

/**
 * Top-100 priority board — shared between /top100 (internal) and /owner
 * (owner view). The `owner` prop (or the device-wide ownerMode session)
 * rides on every request as X-View: owner so the backend strips rep
 * identity; it also audits writes as changed_by 'owner'.
 *
 * Ranking v2 UX:
 *  - rows grouped by SKUs carried (none / one / both) with counts — the
 *    zero-SKU stores are the money, they come first;
 *  - CORE/OUTER geography chip per store;
 *  - arrow moves apply optimistically and reconcile against the backend's
 *    re-sequenced response (ranks stay unique 1..N server-side);
 *  - internal-only Rebalance recomputes default ranks, preserving manual
 *    moves (it is deliberately NOT in the owner allowlist).
 */

// Geography tier fallback (mirrors the backend CORE list) — used only when
// a row predates the ranking-v2 backend and has no geo_tier.
const CORE_CITIES = new Set([
  'north york', 'toronto', 'etobicoke', 'scarborough', 'east york', 'york',
  'vaughan', 'maple', 'woodbridge', 'concord', 'thornhill', 'markham',
  'unionville', 'richmond hill', 'aurora', 'newmarket', 'king city',
  'kleinburg', 'oak ridges', 'stouffville',
]);

function carriedCount(row: Top100Row): 0 | 1 | 2 {
  if (row.skus_carried != null) {
    return Math.max(0, Math.min(2, row.skus_carried)) as 0 | 1 | 2;
  }
  // Fallback: latest SOD on-hand > 0 OR latest live qty > 0 counts as carrying.
  const n = Object.values(row.skus ?? {}).filter(
    (c) => (c.on_hand ?? 0) > 0 || (c.live_qty ?? 0) > 0,
  ).length;
  return Math.min(2, n) as 0 | 1 | 2;
}

function geoTier(row: Top100Row): 'core' | 'outer' {
  if (row.geo_tier) return row.geo_tier.toLowerCase() === 'core' ? 'core' : 'outer';
  return CORE_CITIES.has((row.city ?? '').trim().toLowerCase()) ? 'core' : 'outer';
}

const GROUP_META: Record<0 | 1 | 2, { label: string; hint: string }> = {
  0: { label: 'Carrying neither SKU', hint: 'the wins to go get' },
  1: { label: 'Carrying one SKU', hint: 'sell in the second' },
  2: { label: 'Carrying both SKUs', hint: 'defend and restock' },
};

export function Top100Board({ owner = false }: { owner?: boolean }) {
  const qc = useQueryClient();
  const ownerMode = useOwnerMode();
  const effOwner = owner || ownerMode;
  const viewOpts = effOwner ? { owner: true } : undefined;
  // Owner view is gap-only SERVER-side (skus_carried <= 1). The internal
  // board gets an explicit "Gap only" toggle for parity.
  const [gapOnly, setGapOnly] = useState(false);
  const effGapOnly = !effOwner && gapOnly;
  const boardKey = ['top100', effOwner, effGapOnly] as const;

  const board = useQuery({
    queryKey: boardKey,
    queryFn: () => api.top100(viewOpts, { gap_only: effGapOnly }),
    retry: 1,
  });
  const funnel = useQuery({
    queryKey: ['top100-funnel', effOwner, effGapOnly],
    queryFn: () => api.top100Funnel(viewOpts, { gap_only: effGapOnly }),
    retry: 1,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['top100'] });
    qc.invalidateQueries({ queryKey: ['top100-funnel'] });
  };

  const setPriority = useMutation({
    // Sequential on purpose: each write re-sequences ranks server-side, and
    // two concurrent re-sequencing transactions would race each other.
    mutationFn: async (moves: Array<{ store_number: number; rank: number }>) => {
      const out: Top100PriorityResponse[] = [];
      for (const m of moves) out.push(await api.top100Priority(m, viewOpts));
      return out;
    },
    // Optimistic: swap the two rows in the cache immediately.
    onMutate: async (moves) => {
      await qc.cancelQueries({ queryKey: boardKey });
      const prev = qc.getQueryData<Top100Payload>(boardKey);
      if (prev && moves.length === 2) {
        const [m1, m2] = moves;
        const i = prev.rows.findIndex((r) => r.store_number === m1.store_number);
        const j = prev.rows.findIndex((r) => r.store_number === m2.store_number);
        if (i >= 0 && j >= 0) {
          const rows = [...prev.rows];
          const a = { ...rows[i], priority_rank: m1.rank };
          const b = { ...rows[j], priority_rank: m2.rank };
          rows[i] = b;
          rows[j] = a;
          qc.setQueryData<Top100Payload>(boardKey, { ...prev, rows });
        }
      }
      return { prev };
    },
    onError: (err: unknown, _moves, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey, ctx.prev);
      toast.error((err as Error).message);
    },
    // Reconcile against the re-sequenced order the backend returns, so the
    // board matches server truth even before the refetch lands.
    onSuccess: (results) => {
      const reseq = new Map<number, number | null>();
      for (const res of results) {
        for (const r of res.resequenced ?? []) {
          reseq.set(r.store_number, r.priority_rank ?? r.rank ?? null);
        }
      }
      if (reseq.size > 0) {
        const prev = qc.getQueryData<Top100Payload>(boardKey);
        if (prev) {
          qc.setQueryData<Top100Payload>(boardKey, {
            ...prev,
            rows: prev.rows.map((r) =>
              reseq.has(r.store_number)
                ? { ...r, priority_rank: reseq.get(r.store_number) ?? null }
                : r,
            ),
          });
        }
      }
      toast.success('Priority updated (audited)');
    },
    onSettled: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: (body: { store_number: number; owner_status: OwnerStatus; note?: string }) =>
      api.top100Status(body, viewOpts),
    onSuccess: () => {
      toast.success('Status saved (audited)');
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  // Excel round-trip: upload an edited top100.xlsx — rows match by
  // store_number, changed priority_rank (and valid owner_status) values
  // apply through the same audited re-sequence path server-side.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importXlsx = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.top100ImportXlsx(fd, viewOpts);
    },
    onSuccess: (r) => {
      const skippedCount = r.skipped?.length ?? 0;
      toast.success(
        `Excel applied: ${formatNumber(r.updated)} updated · ${formatNumber(skippedCount)} skipped · ${formatNumber(r.total_ranked)} ranked`,
      );
      if (skippedCount > 0) {
        const preview = r.skipped
          .slice(0, 5)
          .map((s) => `#${s.store_number ?? '?'}: ${s.reason}`)
          .join('\n');
        toast.warning(
          `Skipped rows${skippedCount > 5 ? ` (first 5 of ${skippedCount})` : ''}`,
          { description: preview, duration: 8000 },
        );
      }
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
    onSettled: () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('File too large — the top-100 export is well under 1MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    importXlsx.mutate(file);
  }

  // INTERNAL ONLY — recompute default ranks (gap-first, CORE cities first).
  const rebalance = useMutation({
    mutationFn: api.top100Rebalance,
    onSuccess: (r) => {
      toast.success(
        `Rebalanced ${formatNumber(r.rebalanced)} ranks · ${formatNumber(r.preserved)} manual ranks preserved`,
      );
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const rows = useMemo(() => board.data?.rows ?? [], [board.data]);

  // Group None / One / Both, keeping the backend's rank order inside each.
  const sections = useMemo(() => {
    const buckets: Record<0 | 1 | 2, Top100Row[]> = { 0: [], 1: [], 2: [] };
    rows.forEach((r) => buckets[carriedCount(r)].push(r));
    return ([0, 1, 2] as const).map((key) => ({ key, rows: buckets[key] }));
  }, [rows]);
  const displayOrder = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  function move(displayIdx: number, dir: -1 | 1) {
    const other = displayIdx + dir;
    if (other < 0 || other >= displayOrder.length) return;
    const a = displayOrder[displayIdx];
    const b = displayOrder[other];
    // Swap the two ranks; fall back to visible position when a rank is null.
    const rankA = b.priority_rank ?? other + 1;
    const rankB = a.priority_rank ?? displayIdx + 1;
    setPriority.mutate([
      { store_number: a.store_number, rank: rankA },
      { store_number: b.store_number, rank: rankB },
    ]);
  }

  const busy = setPriority.isPending || setStatus.isPending;

  return (
    <div className="space-y-4">
      {/* Conversion funnel bar — how many of the board reached each stage */}
      <FunnelBar counts={funnel.data?.funnel} total={rows.length || funnel.data?.board_size} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted">
          {rows.length > 0
            ? `${rows.length} stores, ranked. Arrows reorder; every change is audited.`
            : ''}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!effOwner && (
            <button
              onClick={() => setGapOnly(!gapOnly)}
              aria-pressed={gapOnly}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold border ${
                gapOnly
                  ? 'bg-[var(--color-accent)] text-[var(--color-primary-fg)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-card)] border-[var(--color-card-border)]'
              }`}
              title="Show only stores carrying 0 or 1 of the 2 SKUs"
            >
              <Filter size={13} />
              Gap only
            </button>
          )}
          {!effOwner && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Recompute default ranks? Stores carrying neither SKU in CORE cities move to the top. Manual moves are preserved.',
                  )
                ) {
                  rebalance.mutate();
                }
              }}
              disabled={rebalance.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[var(--color-hover)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={rebalance.isPending ? 'animate-spin' : ''} />
              {rebalance.isPending ? 'Rebalancing…' : 'Rebalance'}
            </button>
          )}
          <a
            href={api.exportTop100XlsxUrl(viewOpts)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[var(--color-hover)]"
          >
            <Download size={14} />
            Download .xlsx
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importXlsx.isPending}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[var(--color-hover)] disabled:opacity-50"
            title="Re-import the downloaded top100.xlsx after editing priority_rank (and owner_status)"
          >
            <Upload size={14} className={importXlsx.isPending ? 'animate-pulse' : ''} />
            {importXlsx.isPending ? 'Uploading…' : 'Upload edited Excel'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onFilePicked}
            className="hidden"
            aria-label="Upload edited top-100 Excel"
          />
        </div>
      </div>

      {/* Gate on DATA, not isLoading — a paused/offline query must show
          skeletons, never a false "empty board". */}
      {!board.data &&
        !board.isError &&
        Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24" />)}

      {board.isError && (
        <div className="m-card text-center text-muted py-8 text-sm">
          Top-100 board is not reachable right now. If the backend just woke
          up, try again in a minute.
        </div>
      )}

      {board.data && rows.length === 0 && (
        <div className="m-card text-center text-muted py-8 text-sm">
          No stores on the board yet. The territory seed has to be ingested
          on the backend first.
        </div>
      )}

      {(() => {
        let offset = 0;
        return sections.map((sec) => {
          if (sec.rows.length === 0) return null;
          const start = offset;
          offset += sec.rows.length;
          return (
            <div key={sec.key} className="space-y-2">
              <div className="flex items-baseline justify-between px-1 pt-1">
                <div className="text-xs font-bold uppercase tracking-wider">
                  {GROUP_META[sec.key].label}
                  <span className="ml-2 text-[var(--color-accent)] tabular-nums">
                    {sec.rows.length}
                  </span>
                </div>
                <div className="text-[10px] text-muted">{GROUP_META[sec.key].hint}</div>
              </div>
              {sec.rows.map((row, i) => (
                <BoardRow
                  key={row.store_number}
                  row={row}
                  idx={start + i}
                  last={start + i === displayOrder.length - 1}
                  owner={effOwner}
                  busy={busy}
                  onMove={move}
                  onStatus={(status, note) =>
                    setStatus.mutate({
                      store_number: row.store_number,
                      owner_status: status,
                      note,
                    })
                  }
                />
              ))}
            </div>
          );
        });
      })()}
    </div>
  );
}

function FunnelBar({
  counts,
  total,
}: {
  counts: Record<string, number> | undefined;
  total: number | undefined;
}) {
  const stages: OwnerStatus[] = ['none', 'listing_received', 'order_received', 'completed'];
  const values = stages.map((s) => counts?.[s] ?? 0);
  const sum = values.reduce((a, b) => a + b, 0) || total || 0;
  return (
    <div className="m-card space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Conversion funnel</div>
        <div className="text-xs text-muted">{sum ? `${sum} stores` : '—'}</div>
      </div>
      <div className="flex h-4 w-full rounded-full overflow-hidden bg-[var(--color-background)] border border-[var(--color-card-border)]">
        {sum > 0 &&
          stages.map((s, i) =>
            values[i] > 0 ? (
              <div
                key={s}
                style={{
                  width: `${(values[i] / sum) * 100}%`,
                  background: OWNER_STATUS_META[s].bg,
                }}
                title={`${OWNER_STATUS_META[s].label}: ${values[i]}`}
              />
            ) : null,
          )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: OWNER_STATUS_META[s].bg }}
            />
            <span style={{ color: OWNER_STATUS_META[s].fg }}>{OWNER_STATUS_META[s].label}</span>
            <span className="text-muted tabular-nums">{formatNumber(values[i])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeoChip({ row }: { row: Top100Row }) {
  const tier = geoTier(row);
  return tier === 'core' ? (
    <span
      className="change-chip"
      style={{ background: 'rgba(216,173,88,0.15)', color: '#e8c98d' }}
      title="Core corridor: Toronto / North York / Vaughan / Markham / Richmond Hill…"
    >
      CORE
    </span>
  ) : (
    <span
      className="change-chip"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#9fa8bb' }}
      title="Outer GTA: Mississauga, Brampton and beyond"
    >
      OUTER
    </span>
  );
}

function BoardRow({
  row,
  idx,
  last,
  owner,
  busy,
  onMove,
  onStatus,
}: {
  row: Top100Row;
  idx: number;
  last: boolean;
  owner: boolean;
  busy: boolean;
  onMove: (idx: number, dir: -1 | 1) => void;
  onStatus: (status: OwnerStatus, note?: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(row.owner_status_note ?? '');

  const storeLabel = (
    <>
      <span className="font-semibold">#{row.store_number}</span>
      {row.account && <span className="ml-1.5 text-sm">{row.account}</span>}
    </>
  );

  return (
    <div className="m-card">
      <div className="flex items-start gap-3">
        {/* Rank + arrows */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button
            aria-label="Move up"
            onClick={() => onMove(idx, -1)}
            disabled={busy || idx === 0}
            className="!min-h-0 h-7 w-8 flex items-center justify-center rounded bg-[var(--color-background)] border border-[var(--color-card-border)] disabled:opacity-30"
          >
            <ArrowUp size={13} />
          </button>
          <div className="text-xs font-bold tabular-nums text-[var(--color-accent)]">
            {row.priority_rank ?? idx + 1}
          </div>
          <button
            aria-label="Move down"
            onClick={() => onMove(idx, 1)}
            disabled={busy || last}
            className="!min-h-0 h-7 w-8 flex items-center justify-center rounded bg-[var(--color-background)] border border-[var(--color-card-border)] disabled:opacity-30"
          >
            <ArrowDown size={13} />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {owner ? (
              <span>{storeLabel}</span>
            ) : (
              <Link
                href={`/stores/${row.store_number}`}
                className="hover:text-[var(--color-accent)]"
              >
                {storeLabel}
              </Link>
            )}
            <TierChip tier={row.tier} />
            <GeoChip row={row} />
            {row.class && <span className="change-chip change-BASELINE">{row.class}</span>}
            <AttributionChip tag={row.conversion} />
          </div>
          {(row.address || row.city) && (
            <div className="text-xs text-muted truncate">
              {[row.address, row.city].filter(Boolean).join(', ')}
              {row.route_day != null && ` · route day ${row.route_day}`}
            </div>
          )}

          {/* Both SKUs: SOD on-hand + live qty side by side */}
          <div className="grid grid-cols-2 gap-1.5">
            {TRACKED_SKUS.map((s) => {
              const cell = row.skus?.[s.sku];
              return (
                <div
                  key={s.sku}
                  className="rounded-lg bg-[var(--color-background)] border border-[var(--color-card-border)] px-2 py-1.5"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted">{s.brand}</div>
                  <div className="text-xs tabular-nums">
                    SOD{' '}
                    <span className="font-semibold">
                      {cell?.on_hand != null ? formatNumber(cell.on_hand) : '—'}
                    </span>
                    <span className="text-muted"> · live </span>
                    <span className="font-semibold text-[var(--color-accent)]">
                      {cell?.live_qty != null ? formatNumber(cell.live_qty) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {row.last_touchpoint && (
            <div className="text-[11px] text-muted">
              Last touch: {row.last_touchpoint.activity_type}
              {row.last_touchpoint.rep ? ` by ${row.last_touchpoint.rep}` : ''}
              {row.last_touchpoint.created_at
                ? ` · ${relativeTime(row.last_touchpoint.created_at)}`
                : ''}
            </div>
          )}

          {/* Owner-status dropdown + note — the board's two audited writes */}
          <div className="flex items-center gap-1.5">
            <select
              value={row.owner_status ?? 'none'}
              disabled={busy}
              onChange={(e) => onStatus(e.target.value as OwnerStatus, note || undefined)}
              className="select flex-1 !min-h-0 h-9 text-xs"
              aria-label={`Status for store ${row.store_number}`}
            >
              {OWNER_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              aria-label="Add note"
              onClick={() => setNoteOpen(!noteOpen)}
              className={`!min-h-0 h-9 w-9 flex items-center justify-center rounded-lg border ${
                noteOpen || row.owner_status_note
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-card-border)] text-muted'
              } bg-[var(--color-background)]`}
            >
              <MessageSquare size={14} />
            </button>
          </div>
          {noteOpen && (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Status note (optional)"
                maxLength={300}
                className="select flex-1 !min-h-0 h-9 text-xs"
              />
              <button
                onClick={() => {
                  onStatus((row.owner_status ?? 'none') as OwnerStatus, note || undefined);
                  setNoteOpen(false);
                }}
                disabled={busy}
                className="!min-h-0 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-primary-fg)] text-xs font-semibold disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
          {row.owner_status_note && !noteOpen && (
            <div className="text-[11px] text-muted italic truncate">
              “{row.owner_status_note}”
              {row.owner_status_updated_at && ` · ${formatDate(row.owner_status_updated_at)}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

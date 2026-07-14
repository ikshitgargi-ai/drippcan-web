'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Download, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { api, OWNER_STATUSES, type OwnerStatus, type Top100Row } from '@/lib/api';
import { TRACKED_SKUS } from '@/lib/skus';
import { TierChip, AttributionChip, OWNER_STATUS_META } from '@/components/dripp-bits';
import { formatNumber, formatDate, relativeTime } from '@/lib/utils';

/**
 * Top-100 priority board — shared between /top100 (internal) and /owner
 * (owner view). The `owner` prop rides on every request as X-View: owner so
 * the backend strips rep identity; it also audits writes as changed_by
 * 'owner' instead of the rep name.
 *
 * Both roles may reorder priority and set owner_status — the two writes the
 * owner is allowed. Every write is audited in territory_status_history.
 */
export function Top100Board({ owner = false }: { owner?: boolean }) {
  const qc = useQueryClient();
  const viewOpts = owner ? { owner: true } : undefined;

  const board = useQuery({
    queryKey: ['top100', owner],
    queryFn: () => api.top100(viewOpts),
    retry: 1,
  });
  const funnel = useQuery({
    queryKey: ['top100-funnel', owner],
    queryFn: () => api.top100Funnel(viewOpts),
    retry: 1,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['top100'] });
    qc.invalidateQueries({ queryKey: ['top100-funnel'] });
  };

  const setPriority = useMutation({
    mutationFn: (moves: Array<{ store_number: number; rank: number }>) =>
      Promise.all(moves.map((m) => api.top100Priority(m, viewOpts))),
    onSuccess: () => {
      toast.success('Priority updated (audited)');
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as Error).message),
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

  const rows = board.data?.rows ?? [];

  function move(idx: number, dir: -1 | 1) {
    const other = idx + dir;
    if (other < 0 || other >= rows.length) return;
    const a = rows[idx];
    const b = rows[other];
    // Swap the two ranks; fall back to visible position when a rank is null.
    const rankA = b.priority_rank ?? other + 1;
    const rankB = a.priority_rank ?? idx + 1;
    setPriority.mutate([
      { store_number: a.store_number, rank: rankA },
      { store_number: b.store_number, rank: rankB },
    ]);
  }

  return (
    <div className="space-y-4">
      {/* Conversion funnel bar — how many of the board reached each stage */}
      <FunnelBar counts={funnel.data?.funnel} total={rows.length || funnel.data?.board_size} />

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted">
          {rows.length > 0
            ? `${rows.length} stores, ranked. Arrows reorder; every change is audited.`
            : ''}
        </div>
        <a
          href={api.exportTop100XlsxUrl(viewOpts)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)] text-xs font-semibold hover:bg-[#1a1f29]"
        >
          <Download size={14} />
          Download .xlsx
        </a>
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

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <BoardRow
            key={row.store_number}
            row={row}
            idx={idx}
            last={idx === rows.length - 1}
            owner={owner}
            busy={setPriority.isPending || setStatus.isPending}
            onMove={move}
            onStatus={(status, note) =>
              setStatus.mutate({ store_number: row.store_number, owner_status: status, note })
            }
          />
        ))}
      </div>
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
                className="!min-h-0 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-xs font-semibold disabled:opacity-50"
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

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Target, Filter, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, type Deal, type DealStage } from '@/lib/api';
import { useActiveRep } from '@/lib/active-rep';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'prospecting', label: 'Prospecting', color: '#8b929e' },
  { key: 'pitched', label: 'Pitched', color: '#74b9ff' },
  { key: 'tasting_scheduled', label: 'Tasting Sched', color: '#a78bfa' },
  { key: 'tasting_done', label: 'Tasted', color: '#f59e0b' },
  { key: 'samples_left', label: 'Samples Left', color: '#fdcb6e' },
  { key: 'in_review', label: 'In Review', color: '#d4a574' },
  { key: 'listed', label: 'Listed (Won)', color: '#12c28c' },
  { key: 'lost', label: 'Lost', color: '#ef4b4b' },
];

export default function PipelinePage() {
  const [activeRep] = useActiveRep();
  const [scopeMine, setScopeMine] = useState(true);
  const [includeClosed, setIncludeClosed] = useState(false);
  const qc = useQueryClient();

  const dealsQ = useQuery({
    queryKey: ['deals', { rep: scopeMine ? activeRep : undefined, include_closed: includeClosed }],
    queryFn: () =>
      api.deals({
        rep: scopeMine ? activeRep ?? undefined : undefined,
        include_closed: includeClosed,
      }),
  });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: DealStage }) =>
      api.updateDeal(id, { stage }),
    onSuccess: () => {
      toast.success('Deal moved');
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const dealsByStage = (dealsQ.data?.deals ?? []).reduce<Record<string, Deal[]>>((acc, d) => {
    (acc[d.stage] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[var(--color-accent)]" />
          <span className="muted-small font-semibold uppercase tracking-wider">Pipeline</span>
        </div>
        <h1>Deal Pipeline</h1>
        <p className="text-muted text-sm">
          Every active pitch, by stage. Tap a deal to advance it.
        </p>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <button
          onClick={() => setScopeMine((v) => !v)}
          disabled={!activeRep}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-11 ${
            scopeMine && activeRep
              ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
              : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
          } ${!activeRep ? 'opacity-50' : ''}`}
        >
          <Filter size={14} className="inline mr-1" />
          {activeRep && scopeMine ? `Mine (${activeRep})` : 'All reps'}
        </button>
        <button
          onClick={() => setIncludeClosed((v) => !v)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-11 ${
            includeClosed
              ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
              : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
          }`}
        >
          {includeClosed ? 'Including won/lost' : 'Active only'}
        </button>
        <Link
          href="/today"
          className="ml-auto shrink-0 text-sm text-[var(--color-accent)] hover:underline"
        >
          Today&apos;s plan →
        </Link>
      </div>

      {/* Stage summary chips */}
      {dealsQ.data?.stage_counts && (
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
          {STAGES.filter((s) => (dealsQ.data!.stage_counts[s.key] ?? 0) > 0).map((s) => (
            <div
              key={s.key}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-card-border)]"
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: s.color }}>
                {s.label}
              </div>
              <div className="text-lg font-bold tabular-nums">
                {dealsQ.data!.stage_counts[s.key] ?? 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban-ish columns: stack vertically on mobile, scroll horizontally on tablet+ */}
      <div className="space-y-4 lg:space-y-0 lg:flex lg:gap-3 lg:overflow-x-auto lg:pb-4">
        {STAGES.map((stage) => {
          const list = dealsByStage[stage.key] ?? [];
          if (!includeClosed && (stage.key === 'listed' || stage.key === 'lost') && list.length === 0)
            return null;
          if (list.length === 0) return null;
          return (
            <div key={stage.key} className="lg:w-[300px] lg:shrink-0 space-y-2">
              <div className="flex items-center justify-between sticky lg:static top-14 bg-[var(--color-background)] py-2 z-10">
                <h2 className="text-sm font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  {stage.label}
                </h2>
                <span className="text-xs text-muted tabular-nums">{list.length}</span>
              </div>
              {list.map((d) => (
                <DealCard key={d.id} deal={d} onMove={(stage) => move.mutate({ id: d.id, stage })} />
              ))}
            </div>
          );
        })}
      </div>

      {dealsQ.data?.deals.length === 0 && (
        <div className="m-card text-center py-12 text-muted">
          {scopeMine && activeRep
            ? `${activeRep} has no open deals.`
            : 'No deals in the pipeline yet.'}
          <div className="text-xs mt-2">
            Visit a store and use the &quot;Replace These&quot; tab to add pitches.
          </div>
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, onMove }: { deal: Deal; onMove: (stage: DealStage) => void }) {
  const [expand, setExpand] = useState(false);
  const stage = STAGES.find((s) => s.key === deal.stage);
  return (
    <div className="m-card">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/stores/${deal.store_number}`}
          className="text-sm font-semibold flex-1 min-w-0 hover:text-[var(--color-accent)]"
        >
          {deal.brand} {deal.product_name}
        </Link>
        <span
          className="change-chip text-[10px]"
          style={{ background: (stage?.color ?? '#888') + '33', color: stage?.color }}
        >
          {deal.probability}%
        </span>
      </div>
      <div className="text-xs text-muted mt-0.5">
        Store #{deal.store_number} · <span className="font-mono">{deal.sku}</span>
      </div>
      {deal.next_action && (
        <div className="mt-2 p-2 rounded bg-[var(--color-background)] border border-[var(--color-card-border)] text-xs">
          <strong>{deal.next_action}</strong>
          {deal.next_action_date && (
            <span className="text-muted"> · {formatDate(deal.next_action_date)}</span>
          )}
        </div>
      )}
      <button
        onClick={() => setExpand(!expand)}
        className="mt-2 text-xs text-muted hover:text-[var(--color-accent)] flex items-center gap-1"
      >
        <ChevronRight size={12} className={expand ? 'rotate-90' : ''} />
        Move stage
      </button>
      {expand && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                onMove(s.key);
                setExpand(false);
              }}
              disabled={s.key === deal.stage}
              className={`text-xs p-2 rounded-lg border ${
                s.key === deal.stage
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 opacity-50'
                  : 'border-[var(--color-card-border)] hover:border-[var(--color-accent)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

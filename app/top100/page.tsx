'use client';

import { Trophy } from 'lucide-react';
import { Top100Board } from '@/components/top100-board';

/**
 * TOP-100 PRIORITY BOARD (internal view) — territory stores ranked by
 * priority. Arrows reorder, the dropdown sets owner_status, and every write
 * is audited in territory_status_history on the backend. The owner sees the
 * same board (anonymized) inside /owner.
 */
export default function Top100Page() {
  return (
    <div className="space-y-4 pb-24">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Trophy size={24} className="text-[var(--color-accent)]" />
          Top-100 Board
        </h1>
        <p className="text-sm text-muted">
          The priority board: routed stores first (by route day and stop),
          then AAA/AA territory stores. Reorder with the arrows; set the
          status as listings and orders land. Every change is audited.
        </p>
      </header>
      <Top100Board />
    </div>
  );
}

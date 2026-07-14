'use client';

import { useEffect, useState } from 'react';

const KEY = 'dripp.activeRep';

/**
 * Persist & retrieve the active rep across the app.
 * Used by /today, /log, /pipeline, /quotas to know "who am I."
 *
 * On the server (RSC) this returns null. On the client, it reads localStorage.
 */
export function useActiveRep(): [string | null, (rep: string | null) => void] {
  const [rep, setRepState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem(KEY);
    if (v) setRepState(v);
  }, []);

  const setRep = (next: string | null) => {
    setRepState(next);
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(KEY, next);
      else window.localStorage.removeItem(KEY);
    }
  };

  return [rep, setRep];
}

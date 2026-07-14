'use client';

import { useEffect, useState } from 'react';

const KEY = 'anu.activePortfolio';
const ANU_UNLOCK_KEY = 'anu.anuUnlocked';
const ANU_PASSCODE = '0257';

export type Portfolio = 'NB' | 'Anu' | 'all';

/**
 * Persist & retrieve the active SKU portfolio across the app.
 *
 * - Default 'NB' — every public user (reps, link visitors) sees NB-only
 * - 'Anu' / 'all' require the operator passcode (0257) — gated by
 *   useAnuUnlocked() below
 * - If the unlock is removed/expired, anything other than 'NB' resets
 *   automatically so Anu data never leaks back into the rep view
 */
export function useActivePortfolio(): [Portfolio, (p: Portfolio) => void] {
  const [pf, setPfState] = useState<Portfolio>('NB');
  const [anuUnlocked] = useAnuUnlocked();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem(KEY);
    if (v === 'NB' || v === 'Anu' || v === 'all') setPfState(v);
  }, []);

  // Safety: if Anu got locked again, snap back to NB
  useEffect(() => {
    if (!anuUnlocked && pf !== 'NB') {
      setPfState('NB');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(KEY, 'NB');
      }
    }
  }, [anuUnlocked, pf]);

  const setPf = (next: Portfolio) => {
    // Reject privileged portfolios when locked
    if ((next === 'Anu' || next === 'all') && !anuUnlocked) {
      return;
    }
    setPfState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, next);
    }
  };

  return [pf, setPf];
}

/**
 * Manages the Anu-unlock flag (passcode-gated). Returns:
 *   [unlocked, attemptUnlock(code), lock()]
 *
 * Persist in localStorage so the operator only enters the code once
 * per browser. NOT a security boundary — backend doesn't enforce.
 */
export function useAnuUnlocked(): [boolean, (code: string) => boolean, () => void] {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUnlocked(window.localStorage.getItem(ANU_UNLOCK_KEY) === '1');
  }, []);

  const attemptUnlock = (code: string): boolean => {
    if (code === ANU_PASSCODE) {
      setUnlocked(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ANU_UNLOCK_KEY, '1');
      }
      return true;
    }
    return false;
  };

  const lock = () => {
    setUnlocked(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ANU_UNLOCK_KEY);
      // Also snap back to NB if currently in Anu/all
      const curr = window.localStorage.getItem(KEY);
      if (curr === 'Anu' || curr === 'all') {
        window.localStorage.setItem(KEY, 'NB');
      }
    }
  };

  return [unlocked, attemptUnlock, lock];
}

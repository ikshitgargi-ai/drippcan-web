'use client';

/**
 * Portfolio scoping — superseded for Dripp Tracker.
 *
 * The old fork gated an operator-only portfolio behind a client passcode.
 * Dripp Tracker has ONE portfolio ('Dripp', both SKUs) and the backend
 * returns all tracked SKUs for any portfolio value, so there is nothing
 * to toggle or gate. The limited external view is OWNER mode (/owner),
 * enforced server-side — not a client passcode.
 *
 * Kept as a stub so any straggler import still compiles.
 */
export type Portfolio = 'all';

export function useActivePortfolio(): [Portfolio, (p: Portfolio) => void] {
  return ['all', () => {}];
}

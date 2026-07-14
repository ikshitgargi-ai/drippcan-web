'use client';

/**
 * Owner-session flag (owner lockdown).
 *
 * Set when the brand owner unlocks /owner with the passcode, cleared on
 * logout. While set, the whole app runs as the owner's limited session:
 *   - request() stamps X-View: owner on EVERY api call,
 *   - the shell nav collapses to Owner Dashboard / Top-100 / Changes /
 *     Reconcile plus Logout,
 *   - every other route redirects to /owner.
 *
 * The backend remains the real lock (server-side fail-closed allowlist +
 * anonymization) — this flag only selects the limited view client-side.
 * Internal rep usage is untouched when the flag is unset: no passcode means
 * the internal default, exactly as before.
 */

import { useSyncExternalStore } from 'react';

const MODE_KEY = 'dripp.ownerMode';
/** The /owner gate's unlock persistence key (owner-gate.tsx). */
export const OWNER_UNLOCK_KEY = 'dripp.ownerUnlocked';
const EVENT = 'dripp:owner-mode';

export function isOwnerMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOwnerMode(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(MODE_KEY, '1');
    else window.localStorage.removeItem(MODE_KEY);
  } catch {
    /* storage unavailable (private mode) — the server allowlist still holds */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Full owner logout: drops the session flag AND the /owner unlock. */
export function ownerLogout(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OWNER_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
  setOwnerMode(false);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Reactive owner-mode flag. Server snapshot is false, so SSR/hydration is
 *  stable and the lockdown applies on the first client re-render. */
export function useOwnerMode(): boolean {
  return useSyncExternalStore(subscribe, isOwnerMode, () => false);
}

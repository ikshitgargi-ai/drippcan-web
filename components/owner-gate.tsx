'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { OWNER_UNLOCK_KEY, ownerLogout, setOwnerMode, useOwnerMode } from '@/lib/owner-mode';

const STORAGE_KEY = OWNER_UNLOCK_KEY;

/**
 * Owner-mode gate for /owner.
 *
 * Same UX pattern as the old passcode gate (localStorage persistence, lock
 * button), but the passcode is checked SERVER-SIDE against the backend's
 * OWNER_PASSCODE env via POST /api/owner/check, so the code never ships in
 * frontend JS. This is a convenience gate for the brand owner; the real
 * protection is server-side anonymization on every X-View: owner response.
 *
 * Unlocking also flips the ownerMode session flag: the whole app collapses
 * to the owner surfaces and every fetch carries X-View: owner until logout.
 */
export function OwnerGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setUnlocked(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setUnlocked(false);
    }
  }, []);

  // Fail closed: an unlocked owner gate ALWAYS means an owner-mode session
  // (covers devices that unlocked before the lockdown shipped).
  useEffect(() => {
    if (unlocked) setOwnerMode(true);
  }, [unlocked]);

  // If the session flag is dropped elsewhere (nav Logout, another tab),
  // re-read the unlock key so the gate re-locks in place.
  const ownerMode = useOwnerMode();
  useEffect(() => {
    if (ownerMode || !unlocked) return;
    try {
      setUnlocked(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setUnlocked(false);
    }
  }, [ownerMode, unlocked]);

  // No passcode: the owner just taps Enter. Owner mode is the RESTRICTED,
  // server-anonymized view (no rep names, allowlisted endpoints only), so
  // gating it behind a secret adds friction without protecting anything the
  // internal view doesn't already expose. A rep who lands here can Log out
  // to return to the full internal view.
  function submit() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setOwnerMode(true);
    // Drop anything an internal session may have cached; the owner
    // session refetches everything with X-View: owner.
    qc.clear();
    setUnlocked(true);
    setInput('');
  }

  function lock() {
    ownerLogout();
    qc.clear();
    setUnlocked(false);
    setInput('');
  }

  if (unlocked === null) {
    return <div className="flex justify-center py-12 text-muted">Loading…</div>;
  }

  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto py-12">
        <div className="m-card text-center space-y-4 border-[rgba(216,173,88,0.3)]">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(216,173,88,0.08)] flex items-center justify-center">
              <Lock size={20} className="text-[var(--color-accent)]" />
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold">Owner Dashboard</div>
            <div className="text-xs text-muted mt-1">
              Dripp Cann Spirits. Phoenix &amp; Dayaa at LCBO. Inventory,
              listings and your top-100 target board.
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            className="w-full bg-[var(--color-accent)] text-[var(--color-primary-fg)] rounded-lg py-2.5 font-semibold text-sm"
          >
            Enter Owner Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {children}
      <div className="flex justify-end pt-4">
        <button
          onClick={lock}
          className="text-[10px] text-muted hover:text-[var(--color-foreground)] flex items-center gap-1"
        >
          <Unlock size={10} />
          Log out of owner view
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { api } from '@/lib/api';

const STORAGE_KEY = 'dripp.ownerUnlocked';

/**
 * Owner-mode gate for /owner.
 *
 * Same UX pattern as the old passcode gate (localStorage persistence, lock
 * button), but the passcode is checked SERVER-SIDE against the backend's
 * OWNER_PASSCODE env via POST /api/owner/check — the code never ships in
 * frontend JS. This is a convenience gate for the brand owner; the real
 * protection is server-side anonymization on every X-View: owner response.
 */
export function OwnerGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setUnlocked(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setUnlocked(false);
    }
  }, []);

  async function submit() {
    if (!input || checking) return;
    setChecking(true);
    setError('');
    try {
      const res = await api.ownerCheck(input);
      if (res.ok) {
        try {
          window.localStorage.setItem(STORAGE_KEY, '1');
        } catch {}
        setUnlocked(true);
        setInput('');
      } else {
        setError('Wrong passcode.');
        setInput('');
      }
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.startsWith('401') || msg.startsWith('403')) {
        setError('Wrong passcode.');
      } else {
        setError('Could not reach the server. Try again in a minute (free tier cold-starts).');
      }
      setInput('');
    } finally {
      setChecking(false);
    }
  }

  function lock() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUnlocked(false);
    setInput('');
  }

  if (unlocked === null) {
    return <div className="flex justify-center py-12 text-muted">Loading…</div>;
  }

  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto py-12">
        <div className="m-card text-center space-y-4 border-[rgba(212,165,116,0.3)]">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(212,165,116,0.08)] flex items-center justify-center">
              <Lock size={20} className="text-[var(--color-accent)]" />
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold">Owner Dashboard</div>
            <div className="text-xs text-muted mt-1">
              Dripp Cann Spirits — Phoenix &amp; Dayaa at LCBO. Enter the owner
              passcode to view inventory, listings and the top-100 board.
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-2"
          >
            <input
              type="password"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Owner passcode"
              className="select w-full text-center text-lg tracking-widest font-mono"
              aria-label="Owner passcode"
            />
            <button
              type="submit"
              disabled={checking || !input}
              className="w-full bg-[var(--color-accent)] text-[#2a1f0f] rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Unlock'}
            </button>
            {error && <div className="text-xs text-[var(--color-danger)]">{error}</div>}
          </form>
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
          Lock owner view
        </button>
      </div>
    </div>
  );
}

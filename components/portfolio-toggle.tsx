'use client';

import { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useActivePortfolio, useAnuUnlocked, type Portfolio } from '@/lib/active-portfolio';

/**
 * Portfolio toggle — visible everywhere portfolio scoping is wired.
 *
 * Public users see ONLY the "NB Distillers" label (no toggle) — the
 * tracker presents itself as an NB-only app. A tiny lock icon at the
 * end opens a passcode modal; once unlocked, the full 3-button toggle
 * (NB / Anu / All) appears and persists across pages.
 *
 * Lock button (visible only when unlocked) snaps back to NB on click.
 */
export function PortfolioToggle() {
  const [pf, setPf] = useActivePortfolio();
  const [anuUnlocked, attemptUnlock, lock] = useAnuUnlocked();
  const [showLock, setShowLock] = useState(false);
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);

  // While locked → show only the NB label + an unobtrusive unlock icon
  if (!anuUnlocked) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">Portfolio:</span>
        <span className="px-3 py-1 rounded-md font-semibold bg-[var(--color-accent)] text-[#2a1f0f]">
          NB Distillers
        </span>
        <button
          type="button"
          onClick={() => setShowLock(true)}
          title="Unlock Anu Imports portfolio"
          className="text-muted hover:text-[var(--color-accent)] p-1"
          aria-label="Unlock Anu portfolio"
        >
          <Lock size={12} />
        </button>
        {showLock && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowLock(false); }}
          >
            <div className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl p-5 max-w-xs w-full space-y-3">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-[var(--color-accent)]" />
                <div className="font-semibold">Unlock Anu Imports</div>
              </div>
              <p className="text-xs text-muted">
                Anu Imports portfolio (Goenchi, Fratelli, Rock Paper Rum) is
                operator-only. Enter passcode to switch.
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setCode(v);
                  if (v.length === 4) {
                    if (attemptUnlock(v)) {
                      setShowLock(false);
                      setCode('');
                    } else {
                      setShake(true);
                      setTimeout(() => { setShake(false); setCode(''); }, 500);
                    }
                  }
                }}
                placeholder="••••"
                className={`select w-full text-center text-2xl tracking-widest font-mono ${
                  shake ? 'animate-shake border-[var(--color-danger)]' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => { setShowLock(false); setCode(''); }}
                className="text-xs text-muted underline w-full text-center"
              >
                Cancel
              </button>
            </div>
            <style jsx>{`
              @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-6px); }
                75% { transform: translateX(6px); }
              }
              :global(.animate-shake) {
                animation: shake 0.4s ease-in-out;
              }
            `}</style>
          </div>
        )}
      </div>
    );
  }

  // Unlocked → full 3-button toggle + a tiny re-lock button
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted mr-1">Portfolio:</span>
      {(['NB', 'Anu', 'all'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setPf(p)}
          className={`px-3 py-1 rounded-md font-semibold transition-colors ${
            pf === p
              ? 'bg-[var(--color-accent)] text-[#2a1f0f]'
              : 'bg-[var(--color-card)] border border-[var(--color-card-border)]'
          }`}
        >
          {p === 'NB' ? 'NB Distillers' : p === 'Anu' ? 'Anu Imports' : 'All'}
        </button>
      ))}
      <button
        type="button"
        onClick={lock}
        title="Lock Anu portfolio back behind passcode"
        className="ml-1 text-muted hover:text-[var(--color-warning)] p-1"
        aria-label="Lock Anu portfolio"
      >
        <Unlock size={12} />
      </button>
    </div>
  );
}

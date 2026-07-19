'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';

/**
 * Client-side passcode gate. NOT a security boundary, it just keeps reps
 * out of CEO-level views. The backend already gates with Origin checks.
 *
 * Usage:
 *   <PasscodeGate storageKey="commission_audit_unlocked" passcode="0257" title="Commission Audit">
 *     <YourPage />
 *   </PasscodeGate>
 *
 * Once unlocked, the localStorage key persists across sessions until the
 * user clicks the small "Lock" button at the bottom of the page.
 */
export function PasscodeGate({
  storageKey,
  passcode,
  title,
  description,
  children,
}: {
  storageKey: string;
  passcode: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  // On mount, read localStorage. Use null while loading so SSR and first
  // render don't flash the wrong UI.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setUnlocked(window.localStorage.getItem(storageKey) === '1');
    } catch {
      setUnlocked(false);
    }
  }, [storageKey]);

  // Auto-submit on length match (mobile UX, no Enter key needed)
  useEffect(() => {
    if (input.length !== passcode.length) return;
    if (input === passcode) {
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {}
      setUnlocked(true);
      setInput('');
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setInput('');
      }, 600);
    }
  }, [input, passcode, storageKey]);

  function lock() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
    setUnlocked(false);
    setInput('');
  }

  if (unlocked === null) {
    return (
      <div className="flex justify-center py-12 text-muted">Loading…</div>
    );
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
            <div className="text-lg font-semibold">{title}</div>
            {description && (
              <div className="text-xs text-muted mt-1">{description}</div>
            )}
          </div>
          <div>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter passcode"
              maxLength={passcode.length}
              className={`select w-full text-center text-2xl tracking-widest font-mono ${
                shake ? 'animate-shake border-[var(--color-danger)]' : ''
              }`}
              aria-label="Passcode"
            />
            <div className="text-[10px] text-muted mt-2">
              {input.length} / {passcode.length}
            </div>
          </div>
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
          Lock {title}
        </button>
      </div>
    </div>
  );
}

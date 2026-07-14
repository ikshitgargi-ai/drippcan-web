import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-CA');
}

/** Canonical reporting timezone for the entire app.
 *
 * The whole field team operates in Ontario; every report, every log,
 * every "today" calculation must read out in America/Toronto regardless
 * of where the rendering device sits (Vercel edge in UTC, a rep's iPhone
 * roaming in BC, etc.). DST is handled automatically by the Intl APIs.
 */
export const APP_TZ = 'America/Toronto';

/** Normalize a backend timestamp into a `Date` interpreted as UTC.
 *
 * The backend stores naive UTC strings like "2026-05-12 03:56:55.123456"
 * or "2026-05-12T03:56:55.123456" (no timezone suffix). JS's `new Date(s)`
 * parses these inconsistently across browsers — Safari treats them as
 * local time. We force a UTC interpretation by adding a `Z` suffix when
 * none is present.
 */
function parseAsUtc(d: string | Date): Date {
  if (d instanceof Date) return d;
  const s = String(d).trim();
  // Already has a TZ marker (Z, +HH:MM, -HH:MM) — leave alone
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  // Naive timestamp — replace space with T (for older Safari) and pin to UTC
  return new Date(s.replace(' ', 'T') + 'Z');
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = parseAsUtc(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: APP_TZ,
  });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = parseAsUtc(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TZ,
    timeZoneName: 'short',
  });
}

/** ET-time-only (no date) — for compact "3:42 PM ET" displays. */
export function formatTimeET(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = parseAsUtc(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleTimeString('en-CA', {
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TZ,
  });
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = parseAsUtc(d);
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 1) return 'just now';
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function statusLabel(s: string | null | undefined): string {
  return { L: 'Listed', D: 'Delisting', F: 'Delisted' }[s ?? ''] ?? s ?? '—';
}

export function statusBadgeClass(s: string | null | undefined): string {
  if (s === 'L') return 'badge badge-listed';
  if (s === 'D') return 'badge badge-delisting';
  if (s === 'F') return 'badge badge-delisted';
  return 'badge';
}

export function severityClass(sev: string | null | undefined): string {
  if (sev === 'critical') return 'sev-critical';
  if (sev === 'high') return 'sev-high';
  if (sev === 'medium') return 'sev-medium';
  return '';
}

'use client';

/**
 * Silent geolocation helper.
 *
 * Captures the rep's GPS coords/accuracy/timestamp on activity submit
 * WITHOUT showing anything in the UI. The browser's native permission
 * prompt may still appear (we can't suppress that — it's a privacy
 * guarantee from the platform), but the app itself never displays
 * any geo-related text, indicator, or banner to the rep.
 *
 * The captured fields are sent to the backend in the activity body
 * and surface ONLY in operator-only CSV exports.
 *
 * Returns null if:
 *   - Browser doesn't support geolocation
 *   - User has denied permission
 *   - GPS fix took longer than the timeout
 *
 * Never throws — failure is invisible to the caller.
 */
export interface SilentGeoFix {
  lat: number;
  lng: number;
  accuracy_m: number;
  client_ts: string;
}

const TIMEOUT_MS = 6000;       // don't block submission > 6s
const MAX_AGE_MS = 5 * 60_000; // accept a cached fix up to 5 min old

export function captureSilentGeo(): Promise<SilentGeoFix | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (value: SilentGeoFix | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // Hard timeout — never block UX beyond this
    const t = setTimeout(() => done(null), TIMEOUT_MS);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(t);
          done({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: Math.round(pos.coords.accuracy || 0),
            client_ts: new Date(pos.timestamp || Date.now()).toISOString(),
          });
        },
        () => {
          clearTimeout(t);
          done(null);
        },
        {
          enableHighAccuracy: false,  // GPS or wifi, no need for full GPS lock
          maximumAge: MAX_AGE_MS,
          timeout: TIMEOUT_MS - 500,
        },
      );
    } catch {
      clearTimeout(t);
      done(null);
    }
  });
}

/**
 * Official rep roster — the single source of truth for name pickers.
 * Mirrors REP_ROSTER_DEFAULT in the Flask backend.
 *
 * Owner-facing surfaces must never show these names — the backend
 * anonymizes to "Rep" in ?view=owner responses.
 */
export const REP_ROSTER = ['Ikshit', 'Vaneet', 'Ed', 'Namit'];

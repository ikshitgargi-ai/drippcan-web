/**
 * The two tracked Dripp Cann Spirits SKUs — the single source of truth
 * for hardcoded SKU pickers. Mirrors SOD_TRACKED_SKUS in the Flask backend.
 * Verified live on lcbo.com 2026-07-14.
 */
export const TRACKED_SKUS = [
  { sku: '0014318', brand: 'Phoenix', name: 'Phoenix Ultra Smooth Vodka' },
  { sku: '0044451', brand: 'Dayaa', name: 'Dayaa Arak' },
] as const;

export const PHOENIX_SKU = '0014318';
export const DAYAA_SKU = '0044451';

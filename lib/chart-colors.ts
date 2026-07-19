/**
 * House chart palette for every Recharts usage in the app.
 * Values are the canonical Anu app UI tokens (ANU_DESIGN_SYSTEM/app-ui).
 * Status colors are load-bearing: listed = good, delisting = caution,
 * delisted = bad. Do not remap them.
 */

export const CHART_SERIES = [
  '#d8ad58',
  '#408eff',
  '#9c2848',
  '#2dd4a8',
  '#efd596',
  '#6da7ff',
] as const;

export const CHART_GRID = 'rgba(159,168,187,0.12)';
export const CHART_TICK = '#6b7691';
export const CHART_LABEL = '#e6ecf5';
export const CHART_TOOLTIP_BG = '#101c33';
export const CHART_TOOLTIP_BORDER = 'rgba(216,173,88,0.13)';

export const STATUS = {
  listed: '#2dd4a8',
  delisting: '#fdcb6e',
  delisted: '#e5484d',
} as const;

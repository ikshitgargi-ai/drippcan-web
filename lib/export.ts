import Papa from 'papaparse';

/**
 * Download an array of plain objects as a CSV file.
 *
 * Uses the browser Blob + object URL pattern so no backend round-trip required.
 * Falls back silently if no rows. File name should NOT include extension.
 */
export function downloadCSV<T extends object>(rows: readonly T[], fileNameBase: string): void {
  if (!rows || rows.length === 0) {
    return;
  }
  // Cast to the shape PapaParse expects (UnparseObject-compatible)
  const csv = Papa.unparse(rows as unknown as Record<string, unknown>[]);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNameBase}-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

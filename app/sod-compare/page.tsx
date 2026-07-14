'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  GitCompare,
  Upload,
  FileArchive,
  AlertTriangle,
  RefreshCw,
  Database,
  Eye,
  Trash2,
  Download,
  Folder,
  ChevronDown,
  ChevronRight,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  api,
  type SodCompareUploadsPayload,
  type SodUploadPreviewPayload,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { PasscodeGate } from '@/components/passcode-gate';

/**
 * SOD Compare — operator uploads a historical SOD inventory ZIP from
 * sod.lcbo.com and (optionally) a second ZIP, the backend diffs them
 * and returns per-SKU stores added / lost. Bypasses the "we don't have
 * historical SOD data in the DB" problem because the operator BRINGS
 * the historical data with them.
 *
 * Passcode-gated (operator-only) — same passcode as Commission Audit.
 */
export default function SodComparePage() {
  return (
    <PasscodeGate
      storageKey="commission_audit_unlocked"
      passcode="0257"
      title="SOD Inventory Compare"
      description="Operator-only view. Same passcode as Commission Audit."
    >
      <SodCompareInner />
    </PasscodeGate>
  );
}

function SodCompareInner() {
  const [fromFile, setFromFile] = useState<File | null>(null);
  const [toFile, setToFile] = useState<File | null>(null);
  const [includeLcbo, setIncludeLcbo] = useState(true);
  const [skuFilter, setSkuFilter] = useState('');
  const [fromDatePick, setFromDatePick] = useState<string>('');  // when ZIP has multiple
  const [toDatePick, setToDatePick] = useState<string>('');
  const [fromPreview, setFromPreview] = useState<SodUploadPreviewPayload | null>(null);
  const [result, setResult] = useState<SodCompareUploadsPayload | null>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [rollbackDate, setRollbackDate] = useState<string>('');

  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const preview = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (!fromFile) throw new Error('Please pick a from-zip');
      fd.append('zip', fromFile);
      return api.sodUploadPreview(fd);
    },
    onSuccess: (r) => {
      setFromPreview(r);
      // Auto-pick latest date in the ZIP if user hasn't chosen one
      if (!fromDatePick && r.dates_in_zip.length > 0) {
        setFromDatePick(r.dates_in_zip[r.dates_in_zip.length - 1]);
      }
      toast.success(
        `${formatNumber(r.tracked_rows_in_zip)} tracked rows across dates: ${r.dates_in_zip.join(', ')}`,
        { duration: 8000 },
      );
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Preview failed'),
  });

  const compare = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (!fromFile) throw new Error('Please pick a from-zip');
      fd.append('from_zip', fromFile);
      if (toFile) fd.append('to_zip', toFile);
      if (fromDatePick) fd.append('from_date', fromDatePick);
      if (toDatePick) fd.append('to_date', toDatePick);
      if (skuFilter) fd.append('sku', skuFilter);
      fd.append('include_lcbo', includeLcbo ? '1' : '0');
      return api.sodCompareUploads(fd);
    },
    onSuccess: (r) => {
      setResult(r);
      const fromLabel = r.from_date_used
        ? `${r.from_filename} @ ${r.from_date_used}`
        : r.from_filename;
      const toLabel = r.to_date_used
        ? `${r.to_filename} @ ${r.to_date_used}`
        : r.to_filename;
      toast.success(`Compared ${fromLabel} → ${toLabel}`, { duration: 6000 });
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message || 'Compare failed');
    },
  });

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (!fromFile) throw new Error('Please pick a zip first');
      fd.append('zip', fromFile);
      // If user picked a specific date in the multi-date ZIP, only ingest that
      if (fromDatePick && fromPreview && fromPreview.dates_in_zip.length > 1) {
        fd.append('only_dates', fromDatePick);
      }
      return api.sodUploadHistorical(fd);
    },
    onSuccess: (r) => {
      toast.success(
        `Backfilled ${formatNumber(r.inserted)} rows for dates ${r.dates_in_zip.join(', ')}. Skipped ${formatNumber(r.skipped_existing)} that already existed.`,
        { duration: 10000 },
      );
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message || 'Upload failed');
    },
  });

  const rollback = useMutation({
    mutationFn: (snapshot_date: string) => api.sodRollbackSnapshot(snapshot_date),
    onSuccess: (r) => {
      toast.success(
        `Rolled back ${r.snapshot_date}: deleted ${formatNumber(r.deleted_rows)} rows`,
        { duration: 8000 },
      );
      setRollbackDate('');
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Rollback failed'),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <GitCompare size={24} className="text-[var(--color-accent)]" />
          SOD Inventory Compare
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Download a SOD inventory ZIP from <code>sod.lcbo.com</code> for a
          historical date, upload it here, and get a per-SKU diff against
          today&apos;s data. The right way to compute &quot;new stores added
          since March&quot; or any custom date range.
        </p>
      </header>

      {/* How-to */}
      <div className="m-card flex items-start gap-3 border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.06)]">
        <AlertTriangle size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
        <div className="text-xs text-muted">
          <strong>How to use this page:</strong>
          <ol className="list-decimal ml-4 mt-1 space-y-0.5">
            <li>Log in to <code>sod.lcbo.com</code></li>
            <li>Download the inventory ZIP for the historical date you want as your baseline (e.g. <code>alldlyinventoryMON.zip</code> archived for March 1)</li>
            <li>
              Pick that ZIP as <em>From snapshot</em> below. Optionally pick a second ZIP as <em>To snapshot</em>; if omitted, we use the latest snapshot in our DB.
            </li>
            <li>Click <strong>Compare</strong>. The diff shows up below — per-SKU added / lost stores with clickable store-numbers.</li>
            <li>Or click <strong>Backfill into DB</strong> to ingest the historical ZIP so the regular <Link href="/new-listings" className="text-[var(--color-accent)] underline">/new-listings</Link> page can diff against any date that includes it.</li>
          </ol>
        </div>
      </div>

      {/* Uploaders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload SOD ZIPs</CardTitle>
          <CardDescription>
            Files are stream-parsed in memory. Nothing gets saved unless you
            click &quot;Backfill into DB&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileSlot
            label="From snapshot (REQUIRED) — the historical baseline"
            file={fromFile}
            onChange={(f) => {
              setFromFile(f);
              setFromPreview(null);
              setFromDatePick('');
              setResult(null);
            }}
            inputRef={fromRef}
          />
          <FileSlot
            label="To snapshot (optional) — defaults to latest in DB if omitted"
            file={toFile}
            onChange={(f) => {
              setToFile(f);
              setToDatePick('');
              setResult(null);
            }}
            inputRef={toRef}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="SKU filter (optional)">
              <input
                type="text"
                placeholder="e.g. 0020187 (Red Admiral). Blank = all 8 tracked SKUs"
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
                className="select"
              />
            </Field>
            <Field label="Cross-check">
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={includeLcbo}
                  onChange={(e) => setIncludeLcbo(e.target.checked)}
                />
                Include lcbo.com cross-check (catches lcbo-only adds)
              </label>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => preview.mutate()}
              disabled={!fromFile || preview.isPending}
              title="Inspect the ZIP without persisting — shows dates inside + per-SKU counts"
            >
              {preview.isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Eye size={14} />
              )}
              {preview.isPending ? 'Parsing…' : 'Preview file'}
            </Button>
            <Button
              onClick={() => compare.mutate()}
              disabled={!fromFile || compare.isPending}
            >
              {compare.isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <GitCompare size={14} />
              )}
              {compare.isPending ? 'Comparing…' : 'Compare'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => upload.mutate()}
              disabled={!fromFile || upload.isPending}
              title="Ingest this ZIP into the DB so /new-listings can diff against it later"
            >
              {upload.isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Database size={14} />
              )}
              {upload.isPending ? 'Backfilling…' : 'Backfill into DB'}
            </Button>
          </div>

          {/* Date picker — shown after Preview if ZIP has multiple dates */}
          {fromPreview && fromPreview.dates_in_zip.length > 1 && (
            <div className="rounded-lg border border-[rgba(212,165,116,0.3)] bg-[rgba(212,165,116,0.04)] p-3 space-y-2">
              <div className="text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={12} className="text-[var(--color-accent)]" />
                ZIP contains {fromPreview.dates_in_zip.length} dates — pick which one to use
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fromPreview.dates_in_zip.map((d) => (
                  <button
                    key={d}
                    onClick={() => setFromDatePick(d)}
                    className={`px-2.5 py-1 rounded text-xs font-mono ${
                      fromDatePick === d
                        ? 'bg-[var(--color-accent)] text-[#2a1f0f] font-semibold'
                        : 'bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)]'
                    }`}
                  >
                    {d}
                    {fromPreview.existing_rows_per_date[d] ? (
                      <span className="ml-1 text-[var(--color-warning)]">
                        ({formatNumber(fromPreview.existing_rows_per_date[d])} already in DB)
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview panel */}
      {fromPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview: {fromPreview.filename}</CardTitle>
            <CardDescription>
              Total rows: {formatNumber(fromPreview.total_rows_in_zip)} ·
              tracked: {formatNumber(fromPreview.tracked_rows_in_zip)} · dates:{' '}
              {fromPreview.dates_in_zip.join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fromPreview.per_date.map((d) => (
              <div key={d.snapshot_date}>
                <div className="text-xs font-semibold mb-1.5">
                  {d.snapshot_date}
                  {fromPreview.existing_rows_per_date[d.snapshot_date] > 0 && (
                    <span className="text-[var(--color-warning)] ml-2 font-normal">
                      · already has{' '}
                      {formatNumber(fromPreview.existing_rows_per_date[d.snapshot_date])}{' '}
                      rows in DB (re-upload will be a no-op)
                    </span>
                  )}
                </div>
                <table className="data-table w-full text-xs">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Listed</th>
                      <th>Delisting</th>
                      <th>Fully delisted</th>
                      <th>Total</th>
                      <th>On-hand (Listed)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.tracked_sku_rows.map((s) => (
                      <tr key={s.sku}>
                        <td className="font-mono">{s.sku}</td>
                        <td>
                          <span className="text-muted">{s.brand}</span> {s.product_name}
                        </td>
                        <td className="tabular-nums font-semibold text-[var(--color-success)]">
                          {s.L}
                        </td>
                        <td className="tabular-nums text-[var(--color-warning)]">{s.D}</td>
                        <td className="tabular-nums text-[var(--color-danger)]">{s.F}</td>
                        <td className="tabular-nums">{s.total}</td>
                        <td className="tabular-nums">{formatNumber(s.on_hand_listed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Browse SOD portal — discover annual archives, options, informative */}
      <PortalCatalogCard />

      {/* Bulk historical upload — drag many ZIPs at once */}
      <BulkHistoricalCard />

      {/* Rollback panel — escape hatch when you upload the wrong file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 size={16} className="text-[var(--color-danger)]" />
            Rollback a snapshot
          </CardTitle>
          <CardDescription>
            If you backfilled the wrong ZIP or wrong date, delete the snapshot here.
            Removes all rows for that date from <code>sod_inventory</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <input
            type="date"
            value={rollbackDate}
            onChange={(e) => setRollbackDate(e.target.value)}
            className="select"
          />
          <Button
            variant="secondary"
            onClick={() => {
              if (!rollbackDate) return;
              if (
                window.confirm(
                  `DELETE all sod_inventory rows for ${rollbackDate}?\n\nThis cannot be undone (without re-uploading the ZIP).`,
                )
              ) {
                rollback.mutate(rollbackDate);
              }
            }}
            disabled={!rollbackDate || rollback.isPending}
            title="Delete this snapshot from sod_inventory"
          >
            {rollback.isPending ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {rollback.isPending ? 'Deleting…' : 'Delete snapshot'}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              label="Total stores added"
              value={formatNumber(result.summary.total_added)}
              highlight="success"
              help="Union: SOD-detected + lcbo.com-only"
            />
            <StatCard
              label="Total stores lost"
              value={formatNumber(result.summary.total_lost)}
              highlight={result.summary.total_lost > 0 ? 'warning' : undefined}
            />
            <StatCard
              label="lcbo-only adds"
              value={formatNumber(result.summary.total_lcbo_only)}
              highlight={result.summary.total_lcbo_only > 0 ? 'danger' : undefined}
              help="lcbo.com saw stock, SOD didn't list — potential commission claim"
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">
                    Per-SKU diff (from {result.from_filename || '?'} →{' '}
                    {result.to_source === 'uploaded' ? result.to_filename : 'DB latest'})
                  </CardTitle>
                  <CardDescription>
                    From dates: {result.from_dates_in_zip.join(', ') || '—'}.
                    To dates: {result.to_dates.join(', ') || '—'}.
                  </CardDescription>
                </div>
                <button
                  onClick={() => downloadCompareCsv(result)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
                >
                  <Download size={14} /> Download CSV
                </button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="data-table min-w-full text-xs">
                <thead>
                  <tr>
                    <th></th>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>From listed</th>
                    <th>To listed</th>
                    <th>SOD added</th>
                    <th>lcbo-only added</th>
                    <th>Total added</th>
                    <th>Lost</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {result.per_sku.map((r) => {
                    const open = expandedSku === r.sku;
                    return (
                      <>
                        <tr
                          key={r.sku}
                          onClick={() => setExpandedSku(open ? null : r.sku)}
                          className="cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
                        >
                          <td className="w-6">{open ? '▾' : '▸'}</td>
                          <td className="font-mono">{r.sku}</td>
                          <td>
                            <span className="text-muted">{r.brand}</span> {r.product_name}
                          </td>
                          <td className="tabular-nums">{r.from_listed_count}</td>
                          <td className="tabular-nums">{r.to_listed_count}</td>
                          <td className="tabular-nums">{r.sod_added_count}</td>
                          <td
                            className="tabular-nums font-semibold"
                            style={{ color: r.lcbo_only_added_count > 0 ? 'var(--color-danger)' : undefined }}
                          >
                            {r.lcbo_only_added_count}
                          </td>
                          <td
                            className="tabular-nums font-semibold"
                            style={{ color: r.union_added_count > 0 ? 'var(--color-success)' : undefined }}
                          >
                            {r.union_added_count}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ color: r.sod_lost_count > 0 ? 'var(--color-warning)' : undefined }}
                          >
                            {r.sod_lost_count}
                          </td>
                          <td
                            className="tabular-nums font-bold"
                            style={{
                              color:
                                r.net_change > 0
                                  ? 'var(--color-success)'
                                  : r.net_change < 0
                                    ? 'var(--color-danger)'
                                    : undefined,
                            }}
                          >
                            {r.net_change > 0 ? `+${r.net_change}` : r.net_change}
                          </td>
                        </tr>
                        {open && (
                          <tr key={`${r.sku}-d`} className="bg-[rgba(0,0,0,0.15)]">
                            <td colSpan={10} className="p-3 space-y-2">
                              {r.added_stores.length > 0 ? (
                                <>
                                  <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                                    Stores added ({r.added_stores.length})
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {r.added_stores.map((s) => (
                                      <Link
                                        key={`${s.store_number}-${s.discovered_via}`}
                                        href={`/stores/${s.store_number}`}
                                        className={`text-xs font-mono px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-[var(--color-accent)] hover:text-[#2a1f0f] ${
                                          s.discovered_via === 'lcbo_only'
                                            ? 'bg-[rgba(239,75,75,0.12)] text-[var(--color-danger)]'
                                            : 'bg-[rgba(255,255,255,0.05)]'
                                        }`}
                                        title={
                                          s.discovered_via === 'lcbo_only'
                                            ? 'lcbo.com only — SOD missed this listing'
                                            : 'SOD-detected'
                                        }
                                      >
                                        #{s.store_number}
                                        {s.lcbo_confirmed && <span title="lcbo.com confirmed">✓</span>}
                                      </Link>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-muted py-2">
                                  No stores added in this comparison.
                                </div>
                              )}
                              {r.lost_stores.length > 0 && (
                                <>
                                  <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mt-3">
                                    Stores lost ({r.lost_stores.length})
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {r.lost_stores.map((sn) => (
                                      <Link
                                        key={sn}
                                        href={`/stores/${sn}`}
                                        className="text-xs font-mono px-2 py-1 rounded bg-[rgba(253,203,110,0.12)] text-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-[#2a1f0f]"
                                      >
                                        #{sn}
                                      </Link>
                                    ))}
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Convert the compare result into a CSV and trigger a browser download. */
function downloadCompareCsv(result: SodCompareUploadsPayload) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(
    [
      'from_filename', 'from_date', 'to_source', 'to_filename', 'to_date',
      'sku', 'product_name', 'brand',
      'verdict', 'store_number', 'discovered_via', 'lcbo_confirmed',
      'sod_added_count', 'lcbo_only_added_count', 'union_added_count',
      'sod_lost_count', 'net_change',
    ].join(','),
  );
  for (const r of result.per_sku) {
    for (const s of r.added_stores ?? []) {
      lines.push([
        result.from_filename, result.from_date_used ?? '',
        result.to_source, result.to_filename, result.to_date_used ?? '',
        r.sku, r.product_name, r.brand,
        'ADDED', s.store_number, s.discovered_via, s.lcbo_confirmed,
        r.sod_added_count, r.lcbo_only_added_count, r.union_added_count,
        r.sod_lost_count, r.net_change,
      ].map(esc).join(','));
    }
    for (const sn of r.lost_stores ?? []) {
      lines.push([
        result.from_filename, result.from_date_used ?? '',
        result.to_source, result.to_filename, result.to_date_used ?? '',
        r.sku, r.product_name, r.brand,
        'LOST', sn, 'sod', '',
        r.sod_added_count, r.lcbo_only_added_count, r.union_added_count,
        r.sod_lost_count, r.net_change,
      ].map(esc).join(','));
    }
    if ((r.added_stores?.length ?? 0) === 0 && (r.lost_stores?.length ?? 0) === 0) {
      // SKU with no changes — emit one empty row so the SKU is represented
      lines.push([
        result.from_filename, result.from_date_used ?? '',
        result.to_source, result.to_filename, result.to_date_used ?? '',
        r.sku, r.product_name, r.brand,
        'NO_CHANGE', '', '', '',
        r.sod_added_count, r.lcbo_only_added_count, r.union_added_count,
        r.sod_lost_count, r.net_change,
      ].map(esc).join(','));
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fromTag = (result.from_date_used ?? 'from').replace(/[^0-9-]/g, '');
  const toTag = (result.to_date_used ?? result.to_source ?? 'to').replace(/[^0-9-]/g, '');
  a.download = `anu-sod-compare-${fromTag || 'from'}-to-${toTag || 'today'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * PortalCatalogCard — fetches the live SOD portal index and renders
 * a navigable tree of every available file (Daily Inventory A/B,
 * Informative 2025, Option 1/3/5 2025, etc). One click to import any.
 */
function PortalCatalogCard() {
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<string | null>(null);

  const catalog = useQuery({
    queryKey: ['sod-portal-catalog'],
    queryFn: () => api.sodPortalCatalog(),
    enabled: false,  // explicit refresh
    retry: false,
  });

  const importMut = useMutation({
    mutationFn: (url: string) => api.sodImportFromPortal({ url }),
    onMutate: (url) => setImporting(url),
    onSettled: () => setImporting(null),
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.dates_in_zip.length} day(s): ${r.inserted.toLocaleString()} rows ` +
        `(${r.skipped_existing.toLocaleString()} skipped, already in DB)`,
        { duration: 10000 },
      );
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Import failed'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud size={16} className="text-[var(--color-accent)]" />
          Browse SOD portal — annual archives + options
        </CardTitle>
        <CardDescription>
          Discover every file the supplier portal serves: Daily Inventory A/B
          (already auto-pulled), <strong>Informative 2025</strong>, and the{' '}
          <strong>Option 1/3/5 2025</strong> annual archives. The Option 5
          archive in particular &quot;can be used for tracking over time&quot;
          — one click to backfill our entire 2025 history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => catalog.refetch()}
          disabled={catalog.isFetching}
        >
          {catalog.isFetching ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Folder size={14} />
          )}
          {catalog.isFetching ? 'Crawling portal…' : 'Discover available files'}
        </Button>

        {catalog.isError && (
          <div className="text-xs text-[var(--color-danger)]">
            {(catalog.error as Error).message}
          </div>
        )}

        {catalog.data && (
          <>
            <div className="text-xs text-muted">
              Portal index: <code className="font-mono">{catalog.data.index_url_used ?? '—'}</code>
              {catalog.data.agent_id && (
                <>
                  {' '}· agent <code className="font-mono">{catalog.data.agent_id}</code>
                </>
              )}{' '}
              · {catalog.data.categories.length} categories,{' '}
              {catalog.data.categories.reduce((a, c) => a + c.file_count, 0)} files total
            </div>

            <div className="space-y-1.5">
              {catalog.data.categories.map((cat) => {
                const isOpen = openCats.has(cat.category_key);
                return (
                  <div
                    key={cat.category_key}
                    className="rounded-lg border border-[var(--color-card-border)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        const next = new Set(openCats);
                        if (isOpen) next.delete(cat.category_key);
                        else next.add(cat.category_key);
                        setOpenCats(next);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Folder size={14} className="text-[var(--color-accent)]" />
                      <span className="text-sm font-semibold flex-1 min-w-0 truncate">
                        {cat.category_label}
                      </span>
                      <span className="text-[10px] text-muted font-mono">
                        {cat.category_scope}/{cat.category_id} · {cat.file_count} files
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[var(--color-card-border)] bg-[rgba(0,0,0,0.15)] divide-y divide-[var(--color-card-border)]">
                        {cat.files.map((f) => (
                          <div
                            key={f.url}
                            className="px-3 py-1.5 flex items-center gap-2 text-xs"
                          >
                            <FileArchive size={12} className="text-muted shrink-0" />
                            <span className="font-mono flex-1 min-w-0 truncate">
                              {f.filename}
                            </span>
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted hover:text-[var(--color-accent)] text-[10px]"
                              title="Download in browser"
                            >
                              <Download size={11} />
                            </a>
                            <button
                              onClick={() => importMut.mutate(f.url)}
                              disabled={importing === f.url}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent)] text-[#2a1f0f] hover:opacity-80 disabled:opacity-50"
                              title="Download via backend + ingest into sod_inventory"
                            >
                              {importing === f.url ? 'Importing…' : 'Import'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {catalog.data.categories.length === 0 && (
              <div className="text-xs text-muted py-3">
                No categories discovered. The portal layout may have changed —
                or the agent may not have any active subscriptions. Manual
                upload via the cards below still works.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * BulkHistoricalCard — drag many SOD ZIPs at once for bulk backfill.
 * Each file is parsed + ingested independently. Per-file result table
 * shows what got inserted vs skipped.
 */
function BulkHistoricalCard() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Awaited<ReturnType<typeof api.sodBulkUploadHistorical>> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      files.forEach((f, i) => fd.append(`zip${i}`, f));
      return api.sodBulkUploadHistorical(fd);
    },
    onSuccess: (r) => {
      setResults(r);
      toast.success(
        `Bulk upload complete: ${r.files_processed} files, ${r.total_inserted.toLocaleString()} rows inserted`,
        { duration: 10000 },
      );
    },
    onError: (e: unknown) => toast.error((e as Error).message || 'Bulk upload failed'),
  });

  const totalSize = files.reduce((a, f) => a + f.size, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database size={16} className="text-[var(--color-accent)]" />
          Bulk backfill — multiple historical ZIPs
        </CardTitle>
        <CardDescription>
          Drop or pick many SOD ZIPs at once. Each is ingested independently
          via ON CONFLICT DO NOTHING — re-uploads are idempotent. Use this
          if you have a folder of saved files (e.g. one per weekday for the
          last several weeks) and want to fill our SOD history all at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          multiple
          onChange={(e) => {
            const list = e.target.files;
            if (!list) return;
            setFiles(Array.from(list));
            setResults(null);
          }}
          className="hidden"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <Upload size={14} />
            Pick ZIPs
          </Button>
          {files.length > 0 ? (
            <div className="text-xs text-muted">
              <span className="font-mono">{files.length}</span> file{files.length === 1 ? '' : 's'} ·{' '}
              <span className="font-mono">{(totalSize / (1024 * 1024)).toFixed(1)} MB</span> total
              <button
                onClick={() => setFiles([])}
                className="text-[var(--color-danger)] hover:underline ml-3"
              >
                clear
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted">No files selected (you can pick many at once)</span>
          )}
          <Button
            onClick={() => upload.mutate()}
            disabled={files.length === 0 || upload.isPending}
          >
            {upload.isPending ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Database size={14} />
            )}
            {upload.isPending ? 'Ingesting…' : `Ingest ${files.length || 0} files`}
          </Button>
        </div>

        {files.length > 0 && !results && (
          <ul className="text-xs text-muted space-y-0.5 max-h-32 overflow-y-auto">
            {files.map((f, i) => (
              <li key={i} className="font-mono">
                {f.name} <span className="text-[var(--color-muted)]">({(f.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </li>
            ))}
          </ul>
        )}

        {results && (
          <div className="space-y-2 mt-2 pt-3 border-t border-[var(--color-card-border)]">
            <div className="text-xs">
              Total inserted:{' '}
              <span className="font-semibold text-[var(--color-success)]">
                {results.total_inserted.toLocaleString()}
              </span>{' '}
              · skipped (already in DB):{' '}
              <span className="font-semibold text-muted">
                {results.total_skipped.toLocaleString()}
              </span>
            </div>
            <table className="data-table w-full text-xs">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Dates</th>
                  <th>Tracked rows</th>
                  <th>Inserted</th>
                  <th>Skipped</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.per_file.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono">{r.filename}</td>
                    <td className="font-mono">{(r.dates_in_zip ?? []).join(', ') || '—'}</td>
                    <td className="tabular-nums">{r.tracked_rows ?? 0}</td>
                    <td className="tabular-nums text-[var(--color-success)]">
                      {(r.inserted ?? 0).toLocaleString()}
                    </td>
                    <td className="tabular-nums text-muted">
                      {(r.skipped_existing ?? 0).toLocaleString()}
                    </td>
                    <td>
                      {r.error ? (
                        <span className="text-[var(--color-danger)]">{r.error}</span>
                      ) : (
                        <span className="text-[var(--color-success)]">✓ ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileSlot({
  label,
  file,
  onChange,
  inputRef,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Upload size={14} />
          {file ? 'Change file' : 'Pick ZIP'}
        </Button>
        {file ? (
          <span className="text-xs text-muted flex items-center gap-1.5">
            <FileArchive size={12} />
            <span className="font-mono">{file.name}</span>
            <span>({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
            <button
              onClick={() => onChange(null)}
              className="text-[var(--color-danger)] hover:underline ml-2"
            >
              clear
            </button>
          </span>
        ) : (
          <span className="text-xs text-muted">No file selected</span>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  help,
}: {
  label: string;
  value: string;
  highlight?: 'success' | 'danger' | 'warning';
  help?: string;
}) {
  const color =
    highlight === 'success'
      ? 'var(--color-success)'
      : highlight === 'danger'
        ? 'var(--color-danger)'
        : highlight === 'warning'
          ? 'var(--color-warning)'
          : 'var(--color-foreground)';
  return (
    <div className="rounded-lg border border-[var(--color-card-border)] p-3 bg-[rgba(255,255,255,0.02)]" title={help}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      {help && <div className="text-[10px] text-muted mt-1">{help}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}

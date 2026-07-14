'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Store as StoreIcon, Package, Tag, MapPin, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Cmd+K / Ctrl+K command bar. Palantir-style search-anywhere.
 *
 * Indexes: tracked SKUs, brands, stores (lazy-loaded), nav routes.
 * Keyboard: ↑↓ to navigate, ↵ to go, Esc to close.
 */

type Result =
  | { type: 'route'; label: string; href: string; hint?: string }
  | { type: 'brand'; label: string; href: string; hint?: string }
  | { type: 'sku'; label: string; href: string; hint?: string }
  | { type: 'store'; label: string; href: string; hint?: string };

const ROUTES: Result[] = [
  { type: 'route', label: 'Home', href: '/', hint: 'dashboard' },
  { type: 'route', label: 'Brands', href: '/brands' },
  { type: 'route', label: 'Distribution Intel', href: '/intel', hint: 'new stores · new inventory · delistings' },
  { type: 'route', label: "Today's Plan", href: '/today', hint: 'rep daily plan' },
  { type: 'route', label: 'Pipeline', href: '/pipeline', hint: 'deals kanban' },
  { type: 'route', label: 'Log Activity', href: '/log', hint: 'visit · tasting · sample' },
  { type: 'route', label: 'OOS Risk', href: '/oos', hint: 'low stock alerts' },
  { type: 'route', label: 'Opportunities', href: '/opportunities', hint: 'replace targets' },
  { type: 'route', label: 'Activity Feed', href: '/activity' },
  { type: 'route', label: 'Nearby Stores', href: '/nearby', hint: 'GPS' },
  { type: 'route', label: 'Ask AI', href: '/ask', hint: 'natural-language data' },
  { type: 'route', label: 'SOD Status', href: '/sod' },
  { type: 'route', label: 'Map', href: '/map' },
  { type: 'route', label: 'Reports', href: '/reports' },
  { type: 'route', label: 'Goals', href: '/goals' },
  { type: 'route', label: 'HORECA', href: '/horeca' },
  { type: 'route', label: 'Reps', href: '/reps' },
  { type: 'route', label: 'Territories', href: '/territories' },
];

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const brands = useQuery({ queryKey: ['brands'], queryFn: api.brands, enabled: open });
  const skus = useQuery({
    queryKey: ['sod-products', true],
    queryFn: () => api.sodProducts(true),
    enabled: open,
  });
  // Stores: only load + search when query is at least 1 char (avoids 766-row dump)
  const storeNumberMatch = useMemo(() => {
    if (!query.trim()) return null;
    const n = parseInt(query.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [query]);

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build result list
  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];

    // Direct store-number match (e.g. "217" → /stores/217)
    if (storeNumberMatch) {
      out.push({
        type: 'store',
        label: `Store #${storeNumberMatch}`,
        href: `/stores/${storeNumberMatch}`,
        hint: 'open store drill-down',
      });
    }
    // Brands
    (brands.data?.brands ?? []).forEach((b) => {
      if (!q || b.brand.toLowerCase().includes(q)) {
        out.push({
          type: 'brand',
          label: b.brand,
          href: `/brands/${encodeURIComponent(b.slug)}`,
          hint: `${b.sku_count} SKUs · ${b.total_stores} stores`,
        });
      }
    });
    // SKUs
    const skuList = skus.data?.products ?? skus.data?.rows ?? [];
    skuList.forEach((s) => {
      const label = `${s.brand} ${s.product_name}`;
      if (!q || label.toLowerCase().includes(q) || s.sku.includes(q)) {
        out.push({
          type: 'sku',
          label,
          href: `/skus/${s.sku}`,
          hint: `SKU ${s.sku}`,
        });
      }
    });
    // Routes
    ROUTES.forEach((r) => {
      if (!q || r.label.toLowerCase().includes(q) || r.hint?.toLowerCase().includes(q)) {
        out.push(r);
      }
    });
    return out.slice(0, 50);
  }, [query, brands.data, skus.data, storeNumberMatch]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-background)] text-[var(--color-muted)] text-sm hover:border-[var(--color-accent)] transition-colors"
        aria-label="Open command bar (Cmd+K)"
      >
        <Search size={14} />
        <span>Search…</span>
        <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-card)] border border-[var(--color-card-border)]">
          ⌘K
        </span>
      </button>
    );
  }

  const go = (r: Result) => {
    setOpen(false);
    router.push(r.href);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--color-card-border)]">
          <Search size={16} className="text-[var(--color-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[active]) go(results[active]);
              }
            }}
            placeholder="Search stores, SKUs, brands, routes…"
            className="flex-1 bg-transparent border-0 outline-0 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted)]"
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--color-muted)] hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
              No matches. Try a store number, brand name, SKU, or page name.
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.href}-${i}`}
              onClick={() => go(r)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-l-2',
                i === active
                  ? 'bg-[var(--color-accent)]/10 border-l-[var(--color-accent)]'
                  : 'border-l-transparent hover:bg-white/5',
              )}
            >
              <TypeIcon type={r.type} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{r.label}</div>
                {r.hint && (
                  <div className="text-xs text-[var(--color-muted)] truncate">{r.hint}</div>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] shrink-0 mr-1">
                {r.type}
              </span>
              <ArrowRight size={14} className="text-[var(--color-muted)] shrink-0" />
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-[var(--color-card-border)] flex items-center gap-3 text-[10px] text-[var(--color-muted)] uppercase tracking-wider">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: Result['type'] }) {
  if (type === 'store') return <StoreIcon size={14} className="text-[var(--color-accent)]" />;
  if (type === 'brand') return <Tag size={14} className="text-[#74b9ff]" />;
  if (type === 'sku') return <Package size={14} className="text-[#a78bfa]" />;
  return <MapPin size={14} className="text-[var(--color-muted)]" />;
}

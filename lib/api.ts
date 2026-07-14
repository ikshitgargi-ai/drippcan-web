/**
 * API client for the Flask backend.
 *
 * Base URL:
 *   - Production: NEXT_PUBLIC_API_BASE (e.g. https://drippcan-tracker.onrender.com)
 *   - Dev: set NEXT_PUBLIC_API_BASE empty in .env.local — same-origin, so
 *     next.config.ts rewrites proxy /api/* to localhost:5070
 *   - Unset entirely: falls back to https://drippcan-tracker.onrender.com
 *
 * All report endpoints return payloads with a `freshness` object:
 *   { latest_snapshot, snapshot_age_days, is_stale, last_run_age_hours }
 * Use <FreshnessBanner> to surface stale data to the user.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'https://drippcan-tracker.onrender.com';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

/**
 * Owner-view options. When { owner: true }, the fetcher sends `X-View: owner`
 * so the backend strips rep identity + internal notes server-side. The owner
 * UI (/owner) passes this on EVERY call it makes. Anonymization is enforced
 * by the backend — the header only selects the limited view.
 */
export interface ViewOpts {
  owner?: boolean;
}

function viewHeaders(opts?: ViewOpts): Record<string, string> {
  return opts?.owner ? { 'X-View': 'owner' } : {};
}

/** Append `view=owner` to a URL that is opened via <a href> (downloads),
 *  where request headers can't be set. */
function viewQuery(url: string, opts?: ViewOpts): string {
  if (!opts?.owner) return url;
  return url + (url.includes('?') ? '&' : '?') + 'view=owner';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // For FormData (multipart) bodies, let the browser set Content-Type
  // automatically — including the boundary parameter. Manually setting
  // 'application/json' would break the upload.
  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const authHeaders: Record<string, string> = {};
  if (API_KEY) authHeaders['X-API-Key'] = API_KEY;
  const headers = isFormData
    ? { ...authHeaders, ...(init?.headers ?? {}) }
    : {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers ?? {}),
      };
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!r.ok) {
    let detail = '';
    try {
      detail = (await r.json())?.error ?? (await r.text());
    } catch {
      /* ignore */
    }
    throw new Error(`${r.status} ${r.statusText}: ${detail || path}`);
  }
  return r.json();
}

export const api = {
  // ===== Freshness / health =====
  sodHealth: () => request<SodHealth>('/api/sod/health'),
  healthz: () => request<HealthzPayload>('/healthz'),
  sodStatus: () => request<SodStatus>('/api/sod/status'),
  sodRefreshSnapshot: () =>
    request<{ status: string; sources: string[] }>('/api/sod/refresh-snapshot', { method: 'POST' }),
  sodSync: () => request<unknown>('/api/sod/sync', { method: 'POST' }),

  // ===== Reports =====
  reportDaily: (date?: string) =>
    request<ReportPayload>(`/api/reports/daily${date ? `?date=${date}` : ''}`),
  reportWeekly: (end?: string, mode?: 'mon-sun' | 'rolling7') =>
    request<ReportPayload>(
      `/api/reports/weekly${end || mode ? '?' : ''}${end ? `end=${end}` : ''}${
        end && mode ? '&' : ''
      }${mode ? `mode=${mode}` : ''}`,
    ),
  reportMonthly: (end?: string) =>
    request<ReportPayload>(`/api/reports/monthly${end ? `?end=${end}` : ''}`),
  reportRep: () => request<RepReportPayload>(`/api/reports/rep`),

  // ===== CRM =====
  crmDashboard: (opts?: ViewOpts) =>
    request<CrmDashboard>('/api/crm/dashboard', { headers: viewHeaders(opts) }),
  crmTerritories: () => request<Territory[]>('/api/crm/territories'),
  crmStores: (params: { territory_id?: number; with_coords_only?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.territory_id) qs.set('territory_id', String(params.territory_id));
    if (params.with_coords_only) qs.set('with_coords_only', '1');
    const s = qs.toString();
    return request<Store[]>(`/api/crm/stores${s ? `?${s}` : ''}`);
  },
  oosRisk: (
    params: { sku?: string; territory_id?: number; threshold?: number } = {},
    opts?: ViewOpts,
  ) => {
    const qs = new URLSearchParams();
    if (params.sku) qs.set('sku', params.sku);
    if (params.territory_id) qs.set('territory_id', String(params.territory_id));
    if (params.threshold != null) qs.set('threshold', String(params.threshold));
    const s = qs.toString();
    return request<OosRiskRow[]>(`/api/crm/oos-risk${s ? `?${s}` : ''}`, {
      headers: viewHeaders(opts),
    });
  },
  opportunities: (params: {
    sku?: string;
    territory_id?: number;
    slow_threshold?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.sku) qs.set('sku', params.sku);
    if (params.territory_id) qs.set('territory_id', String(params.territory_id));
    if (params.slow_threshold != null) qs.set('slow_threshold', String(params.slow_threshold));
    if (params.limit != null) qs.set('limit', String(params.limit));
    const s = qs.toString();
    return request<Opportunity[]>(`/api/crm/opportunities${s ? `?${s}` : ''}`);
  },
  listingDigest: (days = 14, trackedOnly = false) => {
    const qs = new URLSearchParams();
    qs.set('days', String(days));
    if (trackedOnly) qs.set('tracked_only', '1');
    return request<ListingDigestPayload>(`/api/crm/listing-digest?${qs.toString()}`);
  },
  goals: () => request<Goal[]>('/api/crm/goals'),
  goalsProgress: () => request<GoalProgress[]>('/api/crm/goals/progress'),
  horeca: (params: { territory_id?: number; status?: string; type?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.territory_id) qs.set('territory_id', String(params.territory_id));
    if (params.status) qs.set('status', params.status);
    if (params.type) qs.set('type', params.type);
    const s = qs.toString();
    return request<HorecaAccount[]>(`/api/crm/horeca${s ? `?${s}` : ''}`);
  },
  storeInventory: (storeNumber: number | string) =>
    request<StoreInventory>(`/api/crm/store/${storeNumber}/inventory`),

  // ===== Sprint 2: drill-down + comparison + GPS + AI =====
  skuTrend: (sku: string, days = 90, opts?: ViewOpts) =>
    request<SkuTrend>(`/api/crm/sku-trend/${sku}?days=${days}`, {
      headers: viewHeaders(opts),
    }),
  storeTrend: (storeNumber: number | string, days = 90) =>
    request<StoreTrend>(`/api/crm/store-trend/${storeNumber}?days=${days}`),
  wowDeltas: () => request<WowDeltasPayload>('/api/crm/wow-deltas'),
  nearby: (params: {
    lat: number;
    lng: number;
    radius_km?: number;
    limit?: number;
    sku?: string;
  }) => {
    const qs = new URLSearchParams();
    qs.set('lat', String(params.lat));
    qs.set('lng', String(params.lng));
    if (params.radius_km != null) qs.set('radius_km', String(params.radius_km));
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.sku) qs.set('sku', params.sku);
    return request<NearbyPayload>(`/api/crm/nearby?${qs.toString()}`);
  },
  aiAsk: (question: string) =>
    request<AiAskPayload>('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  // ===== Movement (authoritative store + listing counts) =====
  movement: (params: { start?: string; end?: string; sku?: string; tracked_only?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.sku) qs.set('sku', params.sku);
    if (params.tracked_only === false) qs.set('tracked_only', '0');
    return request<MovementPayload>(`/api/admin/movement?${qs.toString()}`);
  },

  // ===== Source-drift (UNION of SOD + lcbo.com + master + rep observations) =====
  storeUniverse: (params: { lcbo_hours?: number; verbose?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.lcbo_hours != null) qs.set('lcbo_hours', String(params.lcbo_hours));
    if (params.verbose) qs.set('verbose', '1');
    return request<StoreUniversePayload>(`/api/admin/store-universe?${qs.toString()}`);
  },

  // ===== New-listings-by-range (snapshot diff + lcbo.com triple-check) =====
  newListingsByRange: (params: {
    start?: string;
    end?: string;
    sku?: string;
    include_lcbo?: boolean;
    strict_mode?: boolean;
    fresh_lcbo?: boolean;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.sku) qs.set('sku', params.sku);
    if (params.include_lcbo === false) qs.set('include_lcbo', '0');
    if (params.strict_mode === false) qs.set('strict_mode', '0');
    if (params.fresh_lcbo) qs.set('fresh_lcbo', '1');
    return request<NewListingsByRangePayload>(
      `/api/admin/new-listings-by-range?${qs.toString()}`,
    );
  },

  // ===== SOD Compare Uploads — the user's preferred way to compute new
  // listings between any two dates: download SOD ZIPs from sod.lcbo.com
  // and have the app diff them directly. =====
  sodCompareUploads: (formData: FormData) =>
    request<SodCompareUploadsPayload>('/api/admin/sod/compare-uploads', {
      method: 'POST',
      body: formData,
    }),

  sodUploadHistorical: (formData: FormData) =>
    request<SodUploadHistoricalPayload>('/api/admin/sod/upload-historical', {
      method: 'POST',
      body: formData,
    }),

  sodUploadPreview: (formData: FormData) =>
    request<SodUploadPreviewPayload>('/api/admin/sod/upload-preview', {
      method: 'POST',
      body: formData,
    }),

  sodBulkUploadHistorical: (formData: FormData) =>
    request<SodBulkUploadHistoricalPayload>('/api/admin/sod/bulk-upload-historical', {
      method: 'POST',
      body: formData,
    }),

  sodHistoryCoverage: () =>
    request<SodHistoryCoveragePayload>('/api/admin/sod/history-coverage'),

  // ===== SOD portal catalog (annual archives + options + informative) =====
  // ===== System status (one-glance tier indicator) =====
  systemStatus: () => request<SystemStatusPayload>('/api/admin/system-status'),

  sodPortalCatalog: () =>
    request<SodPortalCatalogPayload>('/api/admin/sod/portal-catalog'),

  sodImportFromPortal: (body: {
    url: string;
    keep_all_rows?: boolean;
    only_dates?: string[];
  }) =>
    request<SodImportFromPortalPayload>('/api/admin/sod/import-from-portal', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sodRollbackSnapshot: (snapshot_date: string) =>
    request<SodRollbackPayload>('/api/admin/sod/rollback-snapshot', {
      method: 'POST',
      body: JSON.stringify({ snapshot_date, confirm: true }),
    }),

  // ===== Rep behavior analysis =====
  repBehavior: (params: { days?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.days != null) qs.set('days', String(params.days));
    return request<RepBehaviorPayload>(`/api/admin/rep-behavior?${qs.toString()}`);
  },

  // ===== Rep activity reports (daily/weekly/monthly downloads) =====
  repActivityReport: (params: {
    rep?: string;
    period?: string;
    start?: string;
    end?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.rep) qs.set('rep', params.rep);
    if (params.period) qs.set('period', params.period);
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    return request<RepActivityReportPayload>(
      `/api/admin/rep-activity-report?${qs.toString()}`,
    );
  },

  // ===== Hidden listings detector (5-pattern audit) =====
  hiddenListings: (params: {
    sku?: string;
    lookback_days?: number;
    flicker_min?: number;
    mass_delist_pct?: number;
    lcbo_window_h?: number;
    start?: string;          // YYYY-MM-DD — overrides lookback_days
    end?: string;            // YYYY-MM-DD — overrides latest snapshot
    min_on_hand?: number;    // floor for inventory_no_listing pattern
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.sku) qs.set('sku', params.sku);
    if (params.lookback_days != null) qs.set('lookback_days', String(params.lookback_days));
    if (params.flicker_min != null) qs.set('flicker_min', String(params.flicker_min));
    if (params.mass_delist_pct != null) qs.set('mass_delist_pct', String(params.mass_delist_pct));
    if (params.lcbo_window_h != null) qs.set('lcbo_window_h', String(params.lcbo_window_h));
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.min_on_hand != null) qs.set('min_on_hand', String(params.min_on_hand));
    return request<HiddenListingsPayload>(
      `/api/admin/hidden-listings?${qs.toString()}`,
    );
  },

  // ===== Commission audit + rep observation override =====
  commissionAudit: (params: { sku?: string; days?: number; include_matches?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.sku) qs.set('sku', params.sku);
    if (params.days != null) qs.set('days', String(params.days));
    if (params.include_matches) qs.set('include_matches', '1');
    return request<CommissionAuditPayload>(`/api/admin/commission-audit?${qs.toString()}`);
  },
  observeListing: (body: {
    sku: string;
    store_number: number;
    rep: string;
    on_shelf?: boolean;
    units?: number;
    notes?: string;
  }) =>
    request<ObserveListingPayload>('/api/crm/observe-listing', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ===== Tracked products =====
  trackedProducts: () => request<ProductRow[]>('/api/products'),
  // Backend param is `tracked_only` (default 1) — send it explicitly so
  // sodProducts(false) actually returns the full catalog.
  sodProducts: (tracked = true) =>
    request<SodProductsResponse>(`/api/sod/products?tracked_only=${tracked ? '1' : '0'}`),

  // ===== System-of-action CRM (Sprint 3 backend) =====
  today: (rep: string, limit = 8) =>
    request<TodayPayload>(`/api/crm/today/${encodeURIComponent(rep)}?limit=${limit}`),
  reps: () => request<{ rep: string; store_count: number }[]>('/api/crm/reps-with-stores'),

  deals: (params: {
    rep?: string; stage?: string; sku?: string; store_number?: number; include_closed?: boolean;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.rep) qs.set('rep', params.rep);
    if (params.stage) qs.set('stage', params.stage);
    if (params.sku) qs.set('sku', params.sku);
    if (params.store_number) qs.set('store_number', String(params.store_number));
    if (params.include_closed) qs.set('include_closed', '1');
    const s = qs.toString();
    return request<DealsPayload>(`/api/crm/deals${s ? `?${s}` : ''}`);
  },
  createDeal: (body: DealCreate) =>
    request<{ status: string; id: number }>('/api/crm/deals', {
      method: 'POST', body: JSON.stringify(body),
    }),
  updateDeal: (id: number, body: Partial<Deal>) =>
    request<{ status: string }>(`/api/crm/deals/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
  deleteDeal: (id: number) =>
    request<{ status: string }>(`/api/crm/deals/${id}`, { method: 'DELETE' }),

  activities: (params: {
    rep?: string; store_number?: number; horeca_account_id?: number; days?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.rep) qs.set('rep', params.rep);
    if (params.store_number) qs.set('store_number', String(params.store_number));
    if (params.horeca_account_id) qs.set('horeca_account_id', String(params.horeca_account_id));
    if (params.days != null) qs.set('days', String(params.days));
    const s = qs.toString();
    return request<{ activities: Activity[]; window_days: number; total: number }>(
      `/api/crm/activities${s ? `?${s}` : ''}`,
    );
  },
  logActivity: (body: ActivityCreate) =>
    request<{ status: string; id: number }>('/api/crm/activities', {
      method: 'POST', body: JSON.stringify(body),
    }),

  quotas: (params: { rep?: string; quarter?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.rep) qs.set('rep', params.rep);
    if (params.quarter) qs.set('quarter', params.quarter);
    const s = qs.toString();
    return request<QuotasPayload>(`/api/crm/quotas${s ? `?${s}` : ''}`);
  },
  upsertQuota: (body: QuotaCreate) =>
    request<{ status: string }>('/api/crm/quotas', {
      method: 'POST', body: JSON.stringify(body),
    }),

  velocity: (sku: string, days = 30, top = 20) =>
    request<VelocityPayload>(`/api/crm/velocity/${sku}?days=${days}&top=${top}`),
  shelfShare: (storeNumber: number | string) =>
    request<ShelfSharePayload>(`/api/crm/shelf-share/${storeNumber}`),

  // ===== Hero charts =====
  portfolioTrend: (days = 30) =>
    request<PortfolioTrendPayload>(`/api/crm/portfolio-trend?days=${days}`),
  ingestCalendar: (days = 14) =>
    request<IngestCalendarPayload>(`/api/sod/ingest-calendar?days=${days}`),

  // ===== Killer rep workflow: in-store replace targets =====
  storeFull: (storeNumber: number | string) =>
    request<StoreFullPayload>(`/api/crm/store/${storeNumber}/full`),
  storeSearch: (q: string) =>
    request<StoreSearchPayload>(`/api/crm/store-search?q=${encodeURIComponent(q)}`),
  // Update editable store fields (manager name, phone, email, rep, priority,
  // spirits ambassador, store notes). Reps fill these in during visits so
  // the directory grows richer over time.
  updateStore: (storeId: number, fields: Partial<{
    account: string; address: string; city: string; postal: string;
    phone: string; email: string; rep: string; priority: string;
    manager_name: string; asst_manager_name: string;
    manager_phone: string; store_email: string; contacts: string; producer: string;
    spirits_ambassador: string; store_notes: string;
  }>) =>
    request<{ success: boolean }>(`/api/stores/${storeId}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    }),

  // Smart store resolver — rep types address OR store# (or postal/account/city)
  // and we return ranked matches with confidence scores. Used by the
  // StoreSearch input on /log and the homepage QuickLog.
  resolveStore: (q: string, limit = 8) =>
    request<ResolveStorePayload>(
      `/api/crm/resolve-store?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  // Portfolio discovery — single 'Dripp' book (both SKUs). The backend
  // returns all tracked SKUs for any portfolio value.
  portfolios: () =>
    request<{ portfolios: Array<{ key: string; label: string; sku_count: number;
              skus: Array<{ sku: string; brand: string; product_name: string }> }>;
              default: string }>(`/api/sod/portfolios`),

  // Rep self-service dashboard — drives /me. One call returns this rep's
  // stats, recent activities, new listings, opportunities, my OOS/low.
  repDashboard: (rep: string, portfolio = 'all') =>
    request<RepDashboardPayload>(
      `/api/crm/rep-dashboard/${encodeURIComponent(rep)}?portfolio=${portfolio}`,
    ),

  // Territory rollup — per-rep distribution + per-SKU drilldown.
  // Powers /territories: pick a rep, see which SKUs are underdistributed.
  territoryRollup: (portfolio = 'all') =>
    request<TerritoryRollupPayload>(
      `/api/crm/territory-rollup?portfolio=${portfolio}`,
    ),

  // Morning digest — OOS + listed-but-low-stock (< 7 by default).
  // Same payload that is rendered to HTML and emailed by the cron.
  morningDigest: (threshold = 7, portfolio = 'all') =>
    request<MorningDigestPayload>(
      `/api/crm/morning-digest?threshold=${threshold}&portfolio=${portfolio}`,
    ),

  // Per-rep performance scoreboard
  repPerformance: (days = 30) =>
    request<RepPerformancePayload>(`/api/crm/rep-performance?days=${days}`),
  // Daily activity log (manager visibility)
  dailyLog: (params: { date?: string; days?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.date) qs.set('date', params.date);
    if (params.days != null) qs.set('days', String(params.days));
    const s = qs.toString();
    return request<DailyLogPayload>(`/api/crm/daily-log${s ? `?${s}` : ''}`);
  },
  // 14-day territory plan per rep
  territoryPlan: (rep: string, days = 14, max_per_day = 9) =>
    request<TerritoryPlanPayload>(`/api/crm/territory-plan?rep=${encodeURIComponent(rep)}&days=${days}&max_per_day=${max_per_day}`),

  storesFinder: (params: { city?: string; rep?: string; territory_id?: number; priority?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.city) qs.set('city', params.city);
    if (params.rep) qs.set('rep', params.rep);
    if (params.territory_id != null) qs.set('territory_id', String(params.territory_id));
    if (params.priority) qs.set('priority', params.priority);
    const s = qs.toString();
    return request<StoresFinderPayload>(`/api/crm/stores-finder${s ? `?${s}` : ''}`);
  },

  // ===== Tasting bookings =====
  bookTasting: (body: {
    store_number: number;
    rep: string;
    scheduled_date: string;
    sku?: string;
    notes?: string;
    expected_units?: number;
  }) =>
    request<{ status: 'booked' | 'exists'; deal_id: number; scheduled_date: string; rep: string }>(
      '/api/crm/tasting-booking',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  upcomingTastings: (params: { days?: number; rep?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.days != null) qs.set('days', String(params.days));
    if (params.rep) qs.set('rep', params.rep);
    const s = qs.toString();
    return request<UpcomingTastingsPayload>(
      `/api/crm/tastings/upcoming${s ? `?${s}` : ''}`,
    );
  },
  calendarIcsUrl: (rep: string, days = 60) =>
    `${API_BASE}/api/crm/calendar/${encodeURIComponent(rep)}.ics?days=${days}`,
  replaceTargets: (storeNumber: number | string, perCat = 5) =>
    request<ReplaceTargetsPayload>(`/api/crm/store/${storeNumber}/replace-targets?per_cat=${perCat}`),

  // ===== Sprint 4: Brand drill-down + distribution additions =====
  brands: () => request<BrandsPayload>('/api/crm/brands'),
  brand: (brand: string) =>
    request<BrandDetailPayload>(`/api/crm/brand/${encodeURIComponent(brand)}`),
  distributionAdditions: (params: { days?: number; sku?: string; brand?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.days != null) qs.set('days', String(params.days));
    if (params.sku) qs.set('sku', params.sku);
    if (params.brand) qs.set('brand', params.brand);
    const s = qs.toString();
    return request<DistributionAdditionsPayload>(
      `/api/crm/distribution-additions${s ? `?${s}` : ''}`,
    );
  },
  backfillStoreChanges: () =>
    request<{ inserted: number; status: string }>('/api/crm/backfill-store-changes', {
      method: 'POST',
    }),

  // ===== Manual listing entry + new-shipment detection =====
  logListing: (body: { sku: string; store_number: number; change_date?: string }) =>
    request<{ status: string; id: number | null; sku: string; brand: string; product_name: string; store_number: number; change_date: string }>(
      '/api/crm/log-listing',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  inventoryAdds: (params: { days?: number; sku?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.days != null) qs.set('days', String(params.days));
    if (params.sku) qs.set('sku', params.sku);
    const s = qs.toString();
    return request<InventoryAddsPayload>(`/api/crm/inventory-adds${s ? `?${s}` : ''}`);
  },

  // ===== Dual-source reconciliation =====
  lcboLiveDiscoveries: (days = 30) =>
    request<LcboLiveDiscoveriesPayload>(`/api/crm/lcbo-live-discoveries?days=${days}`),
  lcboRescan: () =>
    request<{ status: string; note: string }>('/api/crm/lcbo-rescan', { method: 'POST' }),

  // ===== Storage backbone =====
  tastingFollowups: (days = 365) =>
    request<TastingFollowupsPayload>(`/api/crm/tasting-followups?days=${days}`),
  eventLog: (params: { days?: number; entity_type?: string; actor?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.days != null) qs.set('days', String(params.days));
    if (params.entity_type) qs.set('entity_type', params.entity_type);
    if (params.actor) qs.set('actor', params.actor);
    const s = qs.toString();
    return request<EventLogPayload>(`/api/crm/event-log${s ? `?${s}` : ''}`);
  },

  // ===== Manager dashboard =====
  managerDashboard: (params: { days_activity?: number; days_listings?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.days_activity != null) qs.set('days_activity', String(params.days_activity));
    if (params.days_listings != null) qs.set('days_listings', String(params.days_listings));
    const s = qs.toString();
    return request<ManagerDashboardPayload>(`/api/crm/manager-dashboard${s ? `?${s}` : ''}`);
  },
  assignStoresToTerritory: (territoryId: number, body: { store_numbers: number[]; rep_name?: string }) =>
    request<{ status: string; assigned: number; territory_id: number; rep: string | null }>(
      `/api/crm/territories/${territoryId}/assign-stores`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // ===== Territory (Dripp scoping — seeded routed + wider-GTA store book) =====
  territory: (params: { tier?: string; city?: string; q?: string } = {}, opts?: ViewOpts) => {
    const qs = new URLSearchParams();
    if (params.tier) qs.set('tier', params.tier);
    if (params.city) qs.set('city', params.city);
    if (params.q) qs.set('q', params.q);
    const s = qs.toString();
    return request<TerritoryStoresPayload>(`/api/territory${s ? `?${s}` : ''}`, {
      headers: viewHeaders(opts),
    });
  },
  // GTA stores in the SOD/lcbo.com universe that are NOT yet in the territory
  // book — candidates to add (keeps finding future new stores).
  territoryDiscovery: () =>
    request<TerritoryDiscoveryPayload>('/api/territory/discovery'),
  territoryDiscoveryAdd: (store_number: number) =>
    request<{ status: string; store_number: number; tier?: string }>(
      '/api/territory/discovery/add',
      { method: 'POST', body: JSON.stringify({ store_number }) },
    ),

  // ===== Live lcbo.com engine =====
  liveLatest: (sku?: string, opts?: ViewOpts) =>
    request<LiveLatestPayload>(`/api/live/latest${sku ? `?sku=${sku}` : ''}`, {
      headers: viewHeaders(opts),
    }),
  // On-demand polite scrape of lcbo.com for both SKUs (2 per batch, 3s apart).
  liveRefresh: () =>
    request<LiveRefreshPayload>('/api/live/refresh', { method: 'POST' }),
  liveStore: (storeNumber: number | string) =>
    request<LiveStorePayload>(`/api/live/store/${storeNumber}`),

  // ===== 3-way reconciliation: SOD vs lcbo.com vs rep-observed =====
  reconcile: (days = 7, opts?: ViewOpts) =>
    request<ReconcilePayload>(`/api/reconcile?days=${days}`, {
      headers: viewHeaders(opts),
    }),

  // ===== Listings / delistings / restocks over X days (territory-tagged) =====
  changes: (days = 7, sku?: string, opts?: ViewOpts) => {
    const qs = new URLSearchParams();
    qs.set('days', String(days));
    if (sku) qs.set('sku', sku);
    return request<ChangesPayload>(`/api/changes?${qs.toString()}`, {
      headers: viewHeaders(opts),
    });
  },

  // ===== Attribution + conversion (LAUNCH_DATE baseline 2026-07-15) =====
  conversion: (days = 30, opts?: ViewOpts) =>
    request<ConversionPayload>(`/api/conversion?days=${days}`, {
      headers: viewHeaders(opts),
    }),

  // ===== Top-100 priority board =====
  top100: (opts?: ViewOpts) =>
    request<Top100Payload>('/api/top100', { headers: viewHeaders(opts) }),
  top100Priority: (body: { store_number: number; rank: number }, opts?: ViewOpts) =>
    request<{ status: string }>('/api/top100/priority', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: viewHeaders(opts),
    }),
  top100Status: (
    body: { store_number: number; owner_status: OwnerStatus; note?: string },
    opts?: ViewOpts,
  ) =>
    request<{ status: string }>('/api/top100/status', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: viewHeaders(opts),
    }),
  top100Funnel: (opts?: ViewOpts) =>
    request<Top100FunnelPayload>('/api/top100/funnel', { headers: viewHeaders(opts) }),

  // ===== Owner mode =====
  // Server-side passcode check (OWNER_PASSCODE env on the backend). The
  // passcode never lives in frontend code — only the ok/deny result does.
  ownerCheck: (passcode: string) =>
    request<{ ok: boolean }>('/api/owner/check', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  // ===== XLSX exports (openpyxl on the backend) =====
  // URL builders for <a href> downloads — headers can't ride along, so the
  // owner view is selected with ?view=owner instead.
  exportTop100XlsxUrl: (opts?: ViewOpts) =>
    viewQuery(`${API_BASE}/api/export/top100.xlsx`, opts),
  exportTerritoryXlsxUrl: (opts?: ViewOpts) =>
    viewQuery(`${API_BASE}/api/export/territory.xlsx`, opts),
  exportChangesXlsxUrl: (days = 7, opts?: ViewOpts) =>
    viewQuery(`${API_BASE}/api/export/changes.xlsx?days=${days}`, opts),
  exportReconcileXlsxUrl: (opts?: ViewOpts) =>
    viewQuery(`${API_BASE}/api/export/reconcile.xlsx`, opts),
  exportVisitsXlsxUrl: (opts?: ViewOpts) =>
    viewQuery(`${API_BASE}/api/export/visits.xlsx`, opts),

  // ===== Route planner =====
  cities: () => request<{ city: string; store_count: number }[]>('/api/crm/cities'),
  routePlanner: (params: {
    city?: string;
    district?: string;
    max_skus_listed?: number;
    brand?: string;
    max_stops?: number;
    start_lat?: number;
    start_lng?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return request<RoutePlannerPayload>(`/api/crm/route-planner?${qs.toString()}`);
  },

  // ===== Admin: rep roster =====
  roster: () => request<{ roster: string[]; placeholder_for_unassigned: string }>('/api/crm/admin/roster'),
  setRoster: (body: { roster?: string[]; placeholder?: string } = {}) =>
    request<{
      status: string;
      roster: string[];
      cleared_stores_count: number;
      territories_reset_to_placeholder: number;
      placeholder: string;
    }>('/api/crm/admin/set-roster', { method: 'POST', body: JSON.stringify(body) }),
  bulkReassignRep: (body: { from_rep: string; to_rep: string }) =>
    request<{ status: string; reassigned: number; to_rep: string }>(
      '/api/crm/admin/bulk-reassign-rep',
      { method: 'POST', body: JSON.stringify(body) },
    ),
};

// ===== Types =====
export interface Freshness {
  latest_snapshot: string | null;
  snapshot_age_days: number | null;
  is_stale: boolean;
  last_run_age_hours: number | null;
}

export interface SodHealth extends Freshness {
  status: 'healthy' | 'stale' | 'never_synced';
  configured: boolean;
  scheduler_running?: boolean;
  snapshot_date?: string;
}

export interface HealthzPayload extends Freshness {
  status: 'healthy' | 'unhealthy';
}

export interface SodStatus {
  configured: boolean;
  agent_id?: string;
  recent_runs: SodRun[];
  last_by_source: { daily_a?: SodRun; daily_b?: SodRun };
  stats: {
    inv_rows: number;
    sku_count: number;
    snapshot_days: number;
    latest_snapshot: string | null;
    tracked_products: number;
  };
  freshness: Freshness;
  scheduler_running: boolean;
}

export interface SodRun {
  id: number;
  run_at: string;
  source: 'daily_a' | 'daily_b';
  file_name: string | null;
  snapshot_date: string | null;
  status: 'running' | 'success' | 'failed';
  total_rows: number;
  anu_rows: number;
  new_listings: number;
  new_delistings: number;
  duration_seconds: number;
  error: string | null;
}

export interface ReportPayload {
  window: {
    start: string;
    end: string;
    latest_snapshot: string | null;
    window_shifted: boolean;
    requested_window: { start: string; end: string };
  };
  freshness: Freshness;
  per_sku: Array<{
    sku: string;
    product_name: string;
    brand: string;
    day_count: number;
    avg_on_hand: number;
    latest_date: string;
    listed_store_days: number;
    delisting_store_days: number;
  }>;
  snapshot_metrics: Array<{
    sku: string;
    product_name: string;
    brand: string;
    store_count: number;
    total_on_hand: number;
    listed_stores: number;
    delisting_stores: number;
    fully_delisted_stores: number;
  }>;
  listing_changes: Array<{
    sku: string;
    product_name: string;
    brand: string;
    change_type: string;
    change_date: string;
    old_status: string | null;
    new_status: string | null;
  }>;
  totals: {
    products_tracked: number;
    changes_in_window: number;
    new_listings: number;
    delistings: number;
    relistings: number;
  };
}

export interface RepReportPayload {
  snapshot_date: string | null;
  reps: Array<{
    rep: string;
    total_stores: number;
    per_product: Array<{
      sku: string;
      brand: string;
      product_name: string;
      stores_carrying: number;
      stores_delisting: number;
      gap_count: number;
    }>;
  }>;
}

export interface CrmDashboard {
  latest_snapshot: string | null;
  tracked_sku_rollup: Array<{
    sku: string;
    brand: string;
    product_name: string;
    current_status: string;
    store_count: number;
    total_on_hand: number;
  }>;
  oos_brink_count: number;
  digest_last_7_days: Record<string, number>;
  territories: Array<{ code: string; name: string; color: string; store_count: number }>;
}

export interface Territory {
  id: number;
  code: string;
  name: string;
  region: string;
  rep_name: string;
  color: string;
  fsa_prefixes: string;
  city_prefixes: string;
  store_count: number;
  horeca_count: number;
}

export interface Store {
  id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  priority: string;
  rep: string;
  lat: number;
  lng: number;
  territory_id: number | null;
  territory_code: string;
  territory_name: string;
  territory_color: string;
}

export interface OosRiskRow {
  sku: string;
  product_name: string;
  store_number: number;
  status: string;
  on_hand: number;
  snapshot_date: string;
  store_id: number;
  account: string;
  city: string;
  postal: string;
  rep: string;
  territory_id: number | null;
  territory_code: string;
  territory_name: string;
  territory_color: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface Opportunity {
  our_sku: string;
  our_brand: string;
  our_product: string;
  category: string;
  category_group: string;
  competitor_sku: string;
  competitor_name: string;
  competitor_status: string;
  competitor_on_hand: number;
  store_id: number;
  store_number: number;
  account: string;
  city: string;
  postal: string;
  rep: string;
  territory_id: number | null;
  territory_code: string;
  territory_name: string;
  territory_color: string;
  severity: string;
  opportunity_score: number;
}

export interface ListingDigestPayload {
  window_days: number;
  since: string;
  counts: Array<{ change_type: string; count: number }>;
  changes: Array<{
    sku: string;
    product_name: string;
    change_date: string;
    old_status: string | null;
    new_status: string | null;
    change_type: string;
    brand: string;
    is_tracked: boolean;
  }>;
}

export interface Goal {
  id: number;
  scope: 'sku' | 'territory' | 'rep';
  scope_key: string;
  period_start: string;
  period_end: string;
  target_units: number;
  target_revenue: number;
  target_listings: number;
  notes: string;
}

export interface GoalProgress extends Goal {
  achieved_units: number;
  achieved_listings: number;
  pct_units: number | null;
  pct_listings: number | null;
}

export interface HorecaAccount {
  id: number;
  name: string;
  account_type: string;
  address: string;
  city: string;
  postal: string;
  phone: string;
  email: string;
  contact_name: string;
  contact_title: string;
  territory_id: number | null;
  territory_name: string;
  territory_color: string;
  rep_name: string;
  status: string;
  priority: string;
  lat: number;
  lng: number;
  last_visit: string;
  next_visit: string;
  products_carried: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface StoreInventory {
  store_number: number;
  sod: Array<{
    sku: string;
    product_name: string;
    status: string;
    on_hand: number;
    snapshot_date: string;
    brand: string;
  }>;
  /** Tracked SKUs NOT present at this store — missed merchandising opportunities. */
  missing_skus?: Array<{
    sku: string;
    brand: string;
    product_name: string;
    pattern: 'missing_opportunity';
  }>;
  live: Array<{
    sku: string;
    brand: string;
    product_name: string;
    quantity: number;
    store_name: string;
    city: string;
    source: string;
    error?: string;
  }>;
}

export interface ProductRow {
  id: number;
  brand: string;
  name: string;
  lcbo_sku: string;
}

/** GET /api/sod/products → { count, rows } (see api_sod_products).
 *  `products` is kept as a deprecated alias for older call sites. */
export interface SodProductsResponse {
  count: number;
  rows: Array<{
    sku: string;
    product_name: string;
    brand: string;
    current_status?: string;
    store_count?: number;
    total_on_hand?: number;
    is_tracked?: boolean | number;
  }>;
  /** @deprecated the backend never sends this — use `rows`. */
  products?: Array<{ sku: string; product_name: string; brand: string }>;
}

// Sprint 2 types
export interface SkuTrend {
  sku: string;
  brand: string;
  product_name: string;
  days: number;
  since: string;
  series: Array<{
    date: string;
    listed: number;
    delisting: number;
    fully_delisted: number;
    total_on_hand: number;
    avg_on_hand: number;
  }>;
  freshness: Freshness;
}

export interface StoreTrend {
  store_number: number;
  days: number;
  since: string;
  series: Array<{
    date: string;
    sku: string;
    brand: string;
    product_name: string;
    status: string;
    on_hand: number;
  }>;
  freshness: Freshness;
}

export interface Delta {
  abs: number;
  pct: number | null;
}

export interface WowDeltasPayload {
  snapshots: Record<string, string | null>;
  tracked: Array<{
    sku: string;
    brand: string;
    product_name: string;
    now: { listed: number; on_hand: number };
    wow: { listed_delta: Delta; on_hand_delta: Delta; baseline_snapshot: string | null };
    mom: { listed_delta: Delta; on_hand_delta: Delta; baseline_snapshot: string | null };
    yoy: { listed_delta: Delta; on_hand_delta: Delta; baseline_snapshot: string | null };
  }>;
  freshness: Freshness;
}

export interface NearbyStore extends Store {
  distance_km: number;
  sku_status?: string | null;
  sku_on_hand?: number;
  opportunity_score?: number;
}
export interface NearbyPayload {
  origin: { lat: number; lng: number };
  radius_km: number;
  sku: string | null;
  results: NearbyStore[];
  total_within_radius: number;
}

export interface NewListingStoreRow {
  store_number: number;
  /** 'sod' = caught by SOD diff; 'lcbo_only' = SOD missed it but lcbo.com saw it; 'rep_only' = rep observation only */
  discovered_via: 'sod' | 'lcbo_only' | 'rep_only';
  /** True iff the store has a verified change event OR independent source confirmation. */
  confirmed_new: boolean;
  /** True iff sod_listing_changes recorded NEW_LISTING/RELISTED for this (sku, store) in window. */
  has_change_event: boolean;
  /** If our SOD history shows the store was Listed BEFORE the window, this date. Means it's not actually new. */
  last_listed_before_window: string | null;
  /** Human-readable explanation of why this row is/isn't a confirmed new listing. */
  evidence: string;
  lcbo_confirmed: boolean;
  rep_confirmed: boolean;
}

export interface NewListingsPerSkuRow {
  sku: string;
  product_name: string;
  brand: string;
  start_snapshot_date: string | null;
  end_snapshot_date: string | null;
  /** True if the requested start date predates our SOD history for this SKU.
   *  Counts will be 0 — operator should upload a historical SOD ZIP via /sod-compare. */
  start_was_clipped?: boolean;
  /** When clipped, the earliest snapshot we DO have for this SKU. */
  earliest_available_snapshot?: string | null;
  /** When clipped, a human-readable message explaining what happened. */
  message?: string;
  /** Number of stores in new_stores that pass the verification check. */
  confirmed_new_count?: number;
  /** Number of stores in new_stores that DON'T pass — likely baseline gaps. */
  unconfirmed_count?: number;
  sod_new_count: number;
  lcbo_only_new_count: number;
  rep_only_new_count: number;
  union_new_count: number;
  sod_lost_count: number;
  net_change: number;
  start_listed_count: number;
  end_listed_count: number;
  lcbo_confirmed_count: number;
  rep_confirmed_count: number;
  new_stores: NewListingStoreRow[];
  lost_stores: number[];
  error?: string;
}

export interface SodCompareAddedStore {
  store_number: number;
  discovered_via: 'sod' | 'lcbo_only';
  lcbo_confirmed: boolean;
}

export interface SodComparePerSku {
  sku: string;
  product_name: string;
  brand: string;
  from_listed_count: number;
  to_listed_count: number;
  sod_added_count: number;
  sod_lost_count: number;
  lcbo_only_added_count: number;
  lcbo_confirmed_added: number;
  union_added_count: number;
  net_change: number;
  added_stores: SodCompareAddedStore[];
  lost_stores: number[];
}

export interface SodCompareUploadsPayload {
  as_of: string;
  from_filename: string;
  to_filename: string;
  from_dates_in_zip: string[];
  /** Which date inside from_zip was actually used for the comparison.
   *  May be null if the ZIP had no rows for tracked SKUs. */
  from_date_used: string | null;
  to_dates: string[];
  to_date_used: string | null;
  to_source: 'uploaded' | 'db_latest';
  sku_filter: string | null;
  include_lcbo_cross_check: boolean;
  summary: {
    total_added: number;
    total_lost: number;
    total_lcbo_only: number;
  };
  per_sku: SodComparePerSku[];
  parse_stats: {
    from_total_rows: number;
    from_tracked_rows: number;
    to_total_rows: number | null;
    to_tracked_rows: number | null;
  };
  how_to_read: string;
}

export interface SodUploadHistoricalPayload {
  status: string;
  filename: string;
  dates_in_zip: string[];
  tracked_rows_in_zip: number;
  inserted: number;
  skipped_existing: number;
  note: string;
}

export interface SodUploadPreviewPerSku {
  sku: string;
  product_name: string;
  brand: string;
  L: number;
  D: number;
  F: number;
  total: number;
  on_hand_listed: number;
}

export interface SodUploadPreviewPerDate {
  snapshot_date: string;
  tracked_sku_rows: SodUploadPreviewPerSku[];
}

export interface SodUploadPreviewPayload {
  as_of: string;
  filename: string;
  total_rows_in_zip: number;
  tracked_rows_in_zip: number;
  dates_in_zip: string[];
  per_date: SodUploadPreviewPerDate[];
  existing_rows_per_date: Record<string, number>;
  note: string;
}

export interface SodRollbackPayload {
  status: string;
  snapshot_date: string;
  deleted_rows: number;
  note: string;
}

export interface SodHistoryCoveragePerSku {
  sku: string;
  product_name: string;
  brand: string;
  earliest_date: string | null;
  latest_date: string | null;
  distinct_days_in_history: number;
  gap_starts_first_30: string[];
  error?: string;
}

export interface SodHistoryCoveragePayload {
  as_of: string;
  overall_earliest: string | null;
  overall_latest: string | null;
  overall_days: number;
  per_sku: SodHistoryCoveragePerSku[];
  how_to_read: string;
}

export interface SodBulkUploadHistoricalRow {
  filename: string;
  dates_in_zip?: string[];
  tracked_rows?: number;
  inserted?: number;
  skipped_existing?: number;
  note?: string;
  error?: string;
}

export interface SodBulkUploadHistoricalPayload {
  as_of: string;
  files_processed: number;
  total_inserted: number;
  total_skipped: number;
  per_file: SodBulkUploadHistoricalRow[];
}

export interface SystemStatusPayload {
  tier: 'ok' | 'degraded' | 'down';
  issues: string[];
  signals: {
    sod_snapshot_age_days: number | null;
    sod_last_run_age_hours: number | null;
    lcbo_scrape_age_hours?: number | null;
    last_activity_age_hours?: number | null;
    sod_failed_runs_24h?: number;
  };
  sod_latest_snapshot: string | null;
  as_of: string;
}

export interface SodPortalFile {
  url: string;
  filename: string;
  category_scope: string;
  category_id: number;
}

export interface SodPortalCategory {
  category_key: string;
  category_label: string;
  category_scope: string;
  category_id: number;
  file_count: number;
  files: SodPortalFile[];
}

export interface SodPortalCatalogPayload {
  as_of: string;
  index_url_used: string | null;
  agent_id: string | null;
  categories: SodPortalCategory[];
  how_to_use: string;
}

export interface SodImportFromPortalPayload {
  status: string;
  url: string;
  dates_in_zip: string[];
  tracked_rows: number;
  inserted: number;
  skipped_existing: number;
  note: string;
}

export interface RepBehaviorPerRep {
  rep: string;
  window_days: number;
  visits_total: number;
  unique_stores: number;
  repeat_visits: number;
  repeat_visit_pct: number;
  active_days: number;
  days_since_last_visit: number | null;
  territory_size: number;
  coverage_pct: number | null;
  listings_won_in_window: number;
  visit_pace_per_active_day: number | null;
  high_repeat_stores: Array<{
    store_number: number;
    account: string;
    city: string;
    visits: number;
    last_visit: string | null;
  }>;
  top_cities: Array<{ city: string; visits: number }>;
  behavior_flags: string[];
}

export interface RepBehaviorPayload {
  as_of: string;
  window_days: number;
  per_rep: RepBehaviorPerRep[];
  global_findings: string[];
  how_to_read: string;
}

export interface RepActivityRow {
  id: number;
  created_at: string;
  rep: string;
  activity_type: string;
  notes: string | null;
  store_id: number | null;
  store_number: number | null;
  account: string | null;
  address: string | null;
  city: string | null;
  postal: string | null;
  priority: string | null;
  store_rep: string | null;
}

export interface RepActivitySummaryRow {
  rep: string;
  visits: number;
  unique_stores: number;
  repeat_visit_pct: number;
  activity_types: Record<string, number>;
  first_at: string | null;
  last_at: string | null;
}

export interface RepActivityReportPayload {
  as_of: string;
  window: { start: string; end: string; days: number; period_resolved_from: string };
  rep_filter: string | null;
  totals: {
    rows: number;
    unique_reps: number;
    unique_active_days: number;
    activity_type_counts: Record<string, number>;
  };
  per_rep_summary: RepActivitySummaryRow[];
  daily_rollup: Array<{ date: string; visits: number }>;
  rows: RepActivityRow[];
  how_to_read: string;
}

export interface HiddenListingGhost {
  sku: string;
  product_name: string;
  brand: string;
  store_number: number;
  last_listed_date: string | null;
  days_since_last_listed: number | null;
  pattern: 'ghost';
  evidence: string;
}

export interface HiddenListingHidden {
  sku: string;
  product_name: string;
  brand: string;
  store_number: number;
  sod_status: string;
  lcbo_units: number;
  lcbo_seen_at: string | null;
  rep_observed_at: string | null;
  rep_observed_by: string | null;
  pattern: 'hidden_inventory';
  evidence: string;
}

export interface HiddenListingFlicker {
  sku: string;
  product_name: string;
  brand: string;
  store_number: number;
  flip_count: number;
  first_flip_date: string;
  last_flip_date: string;
  sequence: string;
  pattern: 'flicker';
  evidence: string;
}

export interface HiddenListingMassDelist {
  sku: string;
  product_name: string;
  brand: string;
  snapshot_date: string;
  listed_count: number;
  prev_count: number;
  drop_count: number;
  drop_pct: number;
  pattern: 'mass_delist';
  evidence: string;
}

export interface HiddenListingInventoryNoListing {
  sku: string;
  product_name: string;
  brand: string;
  store_number: number;
  snapshot_date: string;
  sod_status: 'D' | 'F';
  on_hand: number;
  pattern: 'inventory_no_listing';
  evidence: string;
}

export interface HiddenListingsPayload {
  as_of: string;
  params: {
    lookback_days: number;
    flicker_min: number;
    mass_delist_pct: number;
    lcbo_window_h: number;
    sku_filter: string | null;
    start?: string | null;
    end?: string | null;
    min_on_hand?: number;
  };
  summary: {
    total_ghost: number;
    total_hidden_inventory: number;
    total_flicker: number;
    total_mass_delist_events: number;
    total_inventory_no_listing?: number;
  };
  patterns: {
    ghost_listings: HiddenListingGhost[];
    hidden_inventory: HiddenListingHidden[];
    flicker_patterns: HiddenListingFlicker[];
    mass_delist_days: HiddenListingMassDelist[];
    inventory_no_listing?: HiddenListingInventoryNoListing[];
  };
  how_to_read: string;
}

export interface NewListingsByRangePayload {
  window: { start: string; end: string; days: number };
  sku_filter: string | null;
  include_lcbo_cross_check: boolean;
  /** When true (default), only stores with verified evidence are counted/returned. */
  strict_mode?: boolean;
  summary: {
    total_new_listings: number;
    total_lost_listings: number;
    net_change: number;
    lcbo_confirmed_new: number;
    rep_confirmed_new: number;
    total_confirmed_new?: number;
    total_unconfirmed?: number;
  };
  per_sku: NewListingsPerSkuRow[];
  how_to_read: string;
  as_of: string;
}

export interface StoreUniversePayload {
  as_of: string;
  lcbo_window_hours: number;
  universe_stats: {
    total_universe_size: number;
    in_all_three: number;
    in_master_only: number;
    in_sod_only: number;
    in_lcbo_only: number;
    in_master_and_sod: number;
    in_master_and_lcbo: number;
    in_sod_and_lcbo: number;
  };
  carrying_stats: {
    total_stores_carrying_any_sku: number;
    sod_only: number;
    lcbo_only: number;
    rep_only: number;
    sod_and_lcbo: number;
    all_three: number;
  };
  drift: {
    sod_only_stores: number[];
    lcbo_only_stores: number[];
    master_only_stores: number[];
    carrying_us_only_in_sod: number[];
    carrying_us_only_in_lcbo: number[];
    carrying_us_only_via_rep: number[];
  };
  how_to_read: string;
  per_store?: Record<
    string,
    {
      in_master: boolean;
      in_sod_latest: boolean;
      in_lcbo_recent: boolean;
      carrying_skus: string[];
      carrying_sources: string[];
    }
  >;
}

export interface MovementPayload {
  window: { start: string; end: string; days: number };
  sku_filter: string | null;
  tracked_only: boolean;
  store_universe: {
    snapshot_date: string | null;
    /** Authoritative LCBO universe — from our master `stores` directory. */
    lcbo_universe_total: number;
    /** Stores that carry at least one of our 8 tracked SKUs in the latest SOD snapshot. */
    stores_carrying_our_skus: number;
    /** Stores in our directory that don't currently carry any of our SKUs (= listing opportunities). */
    stores_without_our_skus: number;
    /** Stores in latest SOD snapshot that aren't in our master directory (= un-onboarded). */
    stores_in_sod_not_in_crm: number;
    /** Pct of LCBO universe that carries at least one of our SKUs. */
    carrying_pct: number;
    /** UNION across master + SOD + lcbo.com — the authoritative count. */
    union_total_stores?: number;
    /** Stores carrying any of our SKUs across ANY source (the truth, ignoring single-source gaps). */
    carrying_us_anywhere?: number;
    /** Carrying-us only in SOD (lcbo.com hasn't confirmed). */
    carrying_only_sod?: number;
    /** Carrying-us only on lcbo.com (SOD missed → potential commission claim). */
    carrying_only_lcbo?: number;
    /** Carrying-us only flagged by a rep on shelf (manual override). */
    carrying_only_rep_observed?: number;
    /** Carrying-us confirmed by both SOD and lcbo.com. */
    carrying_in_sod_and_lcbo?: number;
    /** Per-source drift breakdown. */
    source_drift?: {
      in_sod_not_master: number;
      in_lcbo_not_master: number;
      in_master_not_either: number;
    };
    // Legacy aliases — present for backward compat, prefer the typed names above.
    current_lcbo_stores?: number;
    crm_stores?: number;
    crm_minus_lcbo?: number;
    lcbo_minus_crm?: number;
    error?: string;
  };
  new_stores: {
    added_in_range: number;
    store_list: Array<{ store_number: number; first_seen_date: string }>;
    error?: string;
  };
  listings: {
    new_in_range: number;
    delisted_in_range: number;
    relisted_in_range: number;
    per_sku: Array<{ sku: string; product_name: string; brand: string; new_listings: number }>;
    per_day: Array<{ date: string; NEW_LISTING: number; DELISTED: number; RELISTED: number }>;
    sample_new_listings: Array<{
      date: string;
      sku: string;
      product_name: string;
      brand: string;
      store_number: number | null;
    }>;
    error?: string;
  };
  as_of: string;
}

export type CommissionVerdict = 'lcbo_only' | 'sod_only_empty' | 'sod_only_stale' | 'agree';

export interface CommissionAuditRow {
  sku: string;
  product_name: string;
  brand: string;
  store_number: number;
  verdict: CommissionVerdict;
  claim_units: number;
  sod_status: string | null;
  sod_on_hand: number;
  sod_snapshot_date: string | null;
  lcbo_units: number;
  lcbo_seen_at: string | null;
  rep_observed: boolean;
  rep_observation_at: string | null;
  rep_observation_by: string | null;
}

export interface CommissionAuditPayload {
  as_of: string;
  window_days: number;
  sku_filter: string | null;
  summary: {
    lcbo_only: number;
    sod_only_empty: number;
    sod_only_stale: number;
    agree: number;
    units_undercounted: number;
  };
  rows: CommissionAuditRow[];
  how_to_use: string;
}

export interface ObserveListingPayload {
  id: number;
  sku: string;
  store_number: number;
  rep: string;
  on_shelf: boolean;
  recorded_at: string;
  note: string;
}

export interface AiAskPayload {
  question: string;
  sql: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  row_count: number;
  answer: string;
  model: string;
}

// ===== Sprint 3: workflow types =====
export interface TodayStop {
  store_id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  priority: string;
  lat: number;
  lng: number;
  territory_id: number | null;
  territory_name: string;
  territory_color: string;
  days_since_visit: number | null;
  visit_count: number;
  oos_count: number;
  deals: Array<{ sku: string; stage: string; next_action: string; next_action_date: string | null }>;
  score: number;
}

export interface TodayPayload {
  rep: string;
  plan_date: string;
  stops: TodayStop[];
  total_distance_km: number;
  total_stops: number;
  overdue_deal_actions: number;
  total_candidate_stores: number;
}

export type DealStage =
  | 'prospecting'
  | 'pitched'
  | 'tasting_scheduled'
  | 'tasting_done'
  | 'samples_left'
  | 'in_review'
  | 'listed'
  | 'lost';

export interface Deal {
  id: number;
  store_number: number | null;
  horeca_account_id: number | null;
  sku: string;
  brand: string;
  product_name: string;
  stage: DealStage;
  probability: number;
  expected_close_date: string | null;
  expected_units: number;
  expected_revenue: number;
  owner_rep: string;
  next_action: string;
  next_action_date: string | null;
  notes: string;
  source: string;
  closed_at: string | null;
  closed_reason: string;
  created_at: string | null;
  updated_at: string | null;
  account: string;
  city: string;
  territory_id: number | null;
  territory_name: string;
  territory_color: string;
  horeca_name: string | null;
}

export interface DealCreate {
  store_number?: number;
  horeca_account_id?: number;
  sku: string;
  stage?: DealStage;
  probability?: number;
  expected_close_date?: string;
  expected_units?: number;
  expected_revenue?: number;
  owner_rep?: string;
  next_action?: string;
  next_action_date?: string;
  notes?: string;
  source?: string;
}

export interface DealsPayload {
  deals: Deal[];
  stage_counts: Record<string, number>;
  stages: Array<{ key: DealStage; label: string; probability: number }>;
}

export interface Activity {
  id: number;
  created_at: string | null;
  activity_type: string;
  rep: string;
  outcome: string;
  notes: string;
  rating: number;
  duration_minutes: number;
  next_action: string;
  next_action_date: string | null;
  store_id: number | null;
  store_number: number | null;
  account: string | null;
  city: string | null;
  horeca_account_id: number | null;
  horeca_name: string | null;
}

export interface ActivityCreate {
  rep: string;
  activity_type: string;
  store_number?: number;
  store_id?: number;
  horeca_account_id?: number;
  outcome?: string;
  notes?: string;
  rating?: number;
  duration_minutes?: number;
  next_action?: string;
  next_action_date?: string;
  /** When the activity ACTUALLY happened (allows backdating). Defaults to today. */
  visit_date?: string;
  lat?: number;
  lng?: number;
  /** Optional GPS accuracy in meters — captured silently from navigator.geolocation. */
  accuracy_m?: number;
  /** Optional ISO timestamp of when GPS was read (vs server-side created_at). */
  client_ts?: string;
  sku_outcomes?: Array<{ sku: string; outcome: string; facings?: number; competitor_notes?: string }>;
  advance_pipeline_stage?: DealStage;
}

export interface QuotaTargets {
  activities: number;
  visits: number;
  new_listings: number;
  units: number;
  revenue: number;
}
export interface QuotaAchieved {
  activities: number;
  visits: number;
  new_listings: number;
  units: number;
  revenue: number;
}
export interface Quota {
  id: number;
  rep: string;
  quarter: string;
  period_start: string;
  period_end: string;
  targets: QuotaTargets;
  achieved: QuotaAchieved;
  pct: { activities: number | null; visits: number | null; new_listings: number | null };
  notes: string;
}
export interface QuotasPayload {
  quarter: string;
  quotas: Quota[];
}
export interface QuotaCreate {
  rep: string;
  quarter?: string;
  target_activities?: number;
  target_visits?: number;
  target_new_listings?: number;
  target_units?: number;
  target_revenue?: number;
  notes?: string;
}

export interface VelocityStore {
  store_number: number;
  week_velocity: number | null;
  days_to_oos: number | null;
  current_on_hand: number;
  prior_on_hand: number;
  prior_date: string | null;
}
export interface VelocityPayload {
  sku: string;
  brand: string;
  product_name: string;
  window_days: number;
  overall: VelocityStore;
  per_store_top: VelocityStore[];
  freshness: Freshness;
}

export interface ShelfShareCategory {
  category: string;
  our_facings: number;
  total_facings: number;
  our_on_hand: number;
  total_on_hand: number;
  share_by_facings_pct: number;
  share_by_on_hand_pct: number;
}
export interface ShelfSharePayload {
  store_number: number;
  snapshot_date: string | null;
  categories: ShelfShareCategory[];
}

export interface PortfolioTrendPayload {
  days: number;
  since: string;
  series: Array<{
    date: string;
    listed: number;
    delisting: number;
    fully_delisted: number;
    total_on_hand: number;
    skus_with_data: number;
  }>;
  freshness: Freshness;
}

export interface IngestCalendarDay {
  date: string;
  weekday: string;
  has_snapshot: boolean;
  latest_run_at: string | null;
  success_runs: number;
  failed_runs: number;
  sources: string;
  is_today: boolean;
}
export interface IngestCalendarPayload {
  days: number;
  calendar: IngestCalendarDay[];
}

export interface StoreFullPayload {
  store: {
    id: number;
    store_number: number;
    account: string;
    address: string;
    city: string;
    postal: string;
    phone: string;
    email: string;
    priority: string;
    rep: string;
    lat: number;
    lng: number;
    manager_name: string;
    asst_manager_name: string;
    manager_phone: string;
    store_email: string;
    territory_id: number | null;
    territory_code: string;
    territory_name: string;
    territory_color: string;
    spirits_ambassador: string;
    store_notes: string;
  };
  snapshot_date: string | null;
  /** Latest contacts edit from territory_status_history — "last updated by X on date". */
  contacts_last_updated?: {
    changed_by: string;
    changed_at: string;
    field?: string;
  } | null;
}

export interface ResolveStoreMatch {
  id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  rep: string;
  priority: string;
  lat: number;
  lng: number;
  confidence: number;
  match_reason: string;
}

export interface ResolveStorePayload {
  query: string;
  count: number;
  matches: ResolveStoreMatch[];
  how_to_read?: string;
  error?: string;
}

export interface MissingSkuRow {
  sku: string;
  brand: string;
  product_name: string;
  pattern: 'missing_opportunity';
}

export interface StoreSearchMatch {
  id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  phone: string;
  manager_phone: string;
  manager_name: string;
  rep: string;
  lat: number;
  lng: number;
  last_activity_at?: string | null;
  last_activity_type?: string | null;
  last_activity_rep?: string;
  last_activity_notes?: string;
}
export interface StoreSearchPayload {
  matches: StoreSearchMatch[];
  query: string;
}

export interface FinderStore {
  id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  phone: string;
  manager_phone: string;
  manager_name: string;
  asst_manager_name: string;
  store_email: string;
  rep: string;
  priority: string;
  territory_id: number | null;
  territory_name: string;
  territory_color: string;
  lat: number;
  lng: number;
  last_activity_at: string | null;
  last_activity_type: string | null;
  last_activity_rep: string;
  last_activity_notes: string;
  total_activities: number;
  total_deals: number;
  open_deals: number;
}
export interface StoresFinderPayload {
  count: number;
  stores: FinderStore[];
  filters: { city: string | null; rep: string | null; territory_id: number | null; priority: string | null };
  freshness: Freshness;
}

export interface RepPerformanceRow {
  rep: string;
  activities_total: number;
  activities_by_type: Record<string, number>;
  stores_covered: number;
  days_active: number;
  deals_open: number;
  deals_listed: number;
  deals_lost: number;
  listings_won_in_window: number;
  last_activity_at: string | null;
  last_activity_store: number | null;
  last_activity_type: string | null;
  tasting_to_listing_rate_pct: number | null;
}
export interface RepDashboardStats {
  total: number;
  visits: number;
  tastings: number;
  meetings: number;
  order_commitments: number;
  deliveries: number;
  outreach: number;
  sample_drops: number;
}

export interface RepDashboardActivity {
  id: number;
  activity_type: string;
  notes: string;
  created_at: string;
  store_number: number | null;
  account: string;
  city: string;
  outcome: string;
}

export interface RepDashboardListing {
  id: number;
  sku: string;
  brand: string;
  product_name: string;
  closed_at: string;
  store_number: number | null;
}

export interface RepDashboardDeal {
  id: number;
  sku: string;
  brand: string;
  product_name: string;
  stage: string;
  store_number: number | null;
  next_action: string;
  next_action_date: string;
}

export interface RepDashboardOpportunity {
  sku: string;
  brand: string;
  product_name: string;
  present_stores: number;
  missing_stores: number;
  opportunity_pct: number;
}

export interface RepDashboardStockRow {
  sku: string;
  product_name: string;
  store_number: number;
  on_hand: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  rep: string;
}

export interface RepDashboardPayload {
  rep: string;
  as_of: string;
  my_store_count: number;
  stats_30d: RepDashboardStats;
  stats_90d: RepDashboardStats;
  recent_activities: RepDashboardActivity[];
  new_listings_won: RepDashboardListing[];
  open_deals: RepDashboardDeal[];
  opportunities: RepDashboardOpportunity[];
  my_oos: RepDashboardStockRow[];
  my_low_stock: RepDashboardStockRow[];
}

export interface TerritoryRollupSku {
  sku: string;
  brand: string;
  product_name: string;
  present_stores: number;
  missing_stores: number;
  oos_stores: number;
  low_stock_stores: number;
  distribution_pct: number;
}

export interface TerritoryRollupRep {
  rep: string;
  territory_name: string;
  stores_total: number;
  stores_visited_30d: number;
  visited_pct: number;
  stores_carrying_any_sku: number;
  coverage_pct: number;
  sku_distribution_avg_pct: number;
  per_sku: TerritoryRollupSku[];
}

export interface TerritoryRollupPayload {
  as_of: string;
  snapshot_date: string | null;
  territories: TerritoryRollupRep[];
}

export interface MorningDigestRow {
  sku: string;
  product_name: string;
  store_number: number;
  on_hand: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  rep: string;
}

export interface MorningDigestPayload {
  as_of: string;
  snapshot_date: string | null;
  low_threshold: number;
  portfolio: string;
  buckets: {
    oos: MorningDigestRow[];
    low_stock: MorningDigestRow[];
  };
  summary: {
    total_oos: number;
    total_low_stock: number;
    oos_units_short: number;
    low_stock_total_units: number;
  };
}

export interface RepPerformancePayload {
  window_days: number;
  since: string;
  reps: RepPerformanceRow[];
  totals: {
    activities: number;
    stores_covered: number;
    listings_won: number;
    open_deals: number;
  };
}

export interface DailyLogActivity {
  id: number;
  created_at: string | null;
  visit_date: string | null;
  rep: string;
  activity_type: string;
  notes: string;
  outcome: string;
  duration_minutes: number;
  rating: number;
  store_number: number | null;
  account: string;
  city: string;
  address: string;
  territory_name: string;
  territory_color: string;
}
export interface DailyLogPayload {
  window: { start: string; end: string; days: number };
  count: number;
  activities: DailyLogActivity[];
  by_rep: Array<{ rep: string; count: number; by_type: Record<string, number>; stores_visited: number }>;
}

export interface TerritoryPlanStore {
  id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  priority: string;
  lat: number;
  lng: number;
  manager_name: string;
  phone: string;
  rep_assigned: string;
  territory_name: string;
  territory_color: string;
  last_visit_at: string | null;
  leg_km?: number | null;
}
export interface TerritoryPlanDay {
  day: number;
  date: string;
  stops: number;
  total_km_est: number;
  cluster_label: string;
  stores: TerritoryPlanStore[];
}
export interface TerritoryPlanPayload {
  rep: string;
  territory_name: string;
  days_in_plan: number;
  total_stores_in_territory: number;
  stores_in_plan: number;
  max_per_day: number;
  plan: TerritoryPlanDay[];
}

export interface TastingBooking {
  deal_id: number;
  store_number: number;
  sku: string;
  scheduled_date: string;
  expected_units: number;
  rep: string;
  notes: string;
  booked_at: string | null;
  account: string;
  address: string;
  city: string;
  postal: string;
  manager_name: string;
  phone: string;
  territory_name: string;
  territory_color: string;
}
export interface UpcomingTastingsPayload {
  window: { from: string; to: string; days: number };
  rep: string;
  count: number;
  bookings: TastingBooking[];
}

export interface ReplaceTarget {
  competitor_sku: string;
  competitor_name: string;
  competitor_brand: string;
  competitor_status: string;
  competitor_on_hand: number;
  opportunity_score: number;
}
export interface ReplaceCategory {
  category: string;
  pitch_our_sku: string;
  pitch_our_brand: string;
  pitch_our_product: string;
  targets: ReplaceTarget[];
}
export interface ReplaceTargetsPayload {
  store_number: number;
  snapshot_date: string | null;
  categories: ReplaceCategory[];
}

// Sprint 4 types
export interface BrandSummary {
  brand: string;
  slug: string;
  sku_count: number;
  skus: Array<{ sku: string; product_name: string }>;
  total_listed: number;
  total_delisting: number;
  total_on_hand: number;
  total_stores: number;
  additions_60d: number;
}
export interface BrandsPayload {
  brands: BrandSummary[];
}

export interface BrandDetailPayload {
  brand: string;
  skus: string[];
  per_sku: Array<{
    sku: string;
    brand: string;
    product_name: string;
    snapshot_date: string | null;
    listed: number;
    delisting: number;
    fully_delisted: number;
    total_on_hand: number;
  }>;
  totals: {
    total_stores_with_any_listed: number;
    total_stores_with_all_listed: number;
    total_stores_with_any_delisting: number;
    total_stores_in_matrix: number;
  };
  matrix: Array<{
    store_number: number;
    account: string | null;
    city: string | null;
    territory_name: string | null;
    territory_color: string | null;
    skus: Record<string, { status: string; on_hand: number }>;
  }>;
  recent_changes_60d: {
    counts: Record<string, number>;
    recent: Array<{
      sku: string;
      store_number: number;
      change_date: string;
      change_type: string;
      old_status: string | null;
      new_status: string | null;
      account: string | null;
      city: string | null;
    }>;
  };
  freshness: Freshness;
}

export interface DistributionAddition {
  sku: string;
  brand: string;
  product_name: string;
  store_number: number;
  change_date: string;
  old_status: string | null;
  new_status: string | null;
  change_type: string;
  account: string | null;
  city: string | null;
  postal: string | null;
  rep: string | null;
  priority: string | null;
  territory_name: string;
  territory_color: string;
  current_on_hand: number;
  current_status: string | null;
}
export interface DistributionAdditionsPayload {
  days_requested: number;
  days_of_history_available: number;
  earliest_snapshot: string | null;
  latest_snapshot: string | null;
  // legacy alias for backward compat in case old fields are referenced
  days?: number;
  since: string;
  total: number;
  per_sku: Array<{
    sku: string;
    brand: string;
    product_name: string;
    count: number;
    still_listed: number;
    lost_again: number;
  }>;
  additions: DistributionAddition[];
  freshness: Freshness;
}

export interface InventoryAddEvent {
  sku: string;
  brand: string;
  product_name: string;
  store_number: number;
  snapshot_date: string;
  on_hand: number;
  prev_on_hand: number;
  prev_date: string | null;
  jump: number;
  account: string | null;
  city: string | null;
  postal: string | null;
  rep: string | null;
  territory_name: string;
  territory_color: string;
}
export interface InventoryAddsPayload {
  days_requested: number;
  days_of_history_available: number;
  earliest_snapshot: string | null;
  latest_snapshot: string | null;
  since: string;
  total: number;
  per_sku: Array<{
    sku: string;
    brand: string;
    product_name: string;
    event_count: number;
    unique_stores: number;
    total_units_added: number;
  }>;
  events: InventoryAddEvent[];
  freshness: Freshness;
}

export interface LcboLiveDiscovery {
  sku: string;
  brand: string;
  product_name: string;
  store_number: number;
  change_date: string;
  old_sod_status: string | null;
  account: string | null;
  city: string | null;
  postal: string | null;
  rep: string | null;
  territory_name: string;
  territory_color: string;
  current_sod_status: string | null;
  current_sod_on_hand: number;
  last_lcbo_seen: string | null;
}
export interface LcboLiveDiscoveriesPayload {
  days: number;
  since: string;
  total: number;
  discoveries: LcboLiveDiscovery[];
  freshness: Freshness;
}

export interface TastingFollowup {
  sku: string;
  brand: string;
  product_name: string;
  store_number: number;
  store_id: number | null;
  account: string | null;
  city: string | null;
  postal: string | null;
  territory_name: string;
  territory_color: string;
  tasting_date: string;
  days_since_tasting: number | null;
  tasting_outcome: string;
  tasting_facings: number;
  activity_id: number;
  activity_type: string;
  activity_outcome: string;
  activity_notes: string;
  rep: string;
  current_sod_status: string | null;
  current_sod_on_hand: number;
  priority_score: number;
}
export interface TastingFollowupsPayload {
  days: number;
  since: string;
  total: number;
  followups: TastingFollowup[];
}

export interface EventLogEntry {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor: string;
  payload_json: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}
export interface EventLogPayload {
  events: EventLogEntry[];
  days: number;
  total: number;
}

export interface ManagerRepRow {
  rep: string;
  store_count: number;
  gap_count: number;
  activities_30d: number;
  visits_30d: number;
  tastings_30d: number;
  outreach_30d: number;
  listings_won_60d: number;
  new_stores_60d: number;
  delistings_60d: number;
  quota_activities: number;
  quota_visits: number;
  quota_new_listings: number;
  pct_quota_activities: number | null;
  pct_quota_visits: number | null;
  pct_quota_listings: number | null;
  gap_pct: number | null;
}
export interface ManagerTerritoryRow {
  id: number;
  code: string;
  name: string;
  region: string;
  color: string;
  rep_name: string;
  store_count: number;
}
export interface RouteStop {
  store_id: number;
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  priority: string;
  rep: string;
  lat: number;
  lng: number;
  manager_name: string;
  manager_phone: string;
  territory_id: number | null;
  territory_name: string;
  territory_color: string;
  skus_listed: number;
  leg_distance_km: number;
}
export interface RoutePlannerPayload {
  city: string | null;
  district: string | null;
  brand_filter: string;
  max_skus_listed: number;
  total_stops: number;
  total_distance_km: number;
  total_candidates: number;
  route: RouteStop[];
  freshness?: Freshness;
}

// ===== Dripp territory / live / changes payloads =====

export interface TerritoryStoreRow {
  id: number;
  store_number: number;
  tier: 'routed' | 'territory' | 'discovered';
  class: string;
  account: string;
  address: string;
  city: string;
  postal: string;
  route_day: number | null;
  route_stop: number | null;
  priority_rank: number | null;
  owner_status: 'none' | 'listing_received' | 'order_received' | 'completed';
  owner_status_note: string;
  owner_status_updated_at: string | null;
  added_at: string | null;
  source: 'seed' | 'discovery' | 'manual';
  active: boolean;
  /** Enriched from the master stores directory. */
  lat?: number | null;
  lng?: number | null;
  phone?: string;
  /** Latest SOD presence per tracked SKU, keyed by SKU; null = not listed. */
  sku_presence?: Record<
    string,
    { status: string | null; on_hand: number | null; snapshot_date: string | null } | null
  >;
  last_touchpoint?: { activity_type: string; created_at: string | null; rep?: string } | null;
}

/** GET /api/territory → { count, stores, sod_latest } (see api_territory). */
export interface TerritoryStoresPayload {
  count: number;
  stores: TerritoryStoreRow[];
  /** Latest SOD snapshot date per tracked SKU. */
  sod_latest: Record<string, string | null>;
}

export interface LiveLatestStoreRow {
  store_number: number;
  qty: number;
  checked_at: string | null;
  store_name: string;
  city: string;
}

export interface LiveLatestSkuBlock {
  brand: string;
  product_name: string;
  batch_id: string | null;
  checked_at: string | null;
  store_count: number;
  total_units: number;
  stores: LiveLatestStoreRow[];
}

/** GET /api/live/latest → { skus: { [sku]: {...} } } (see api_live_latest). */
export interface LiveLatestPayload {
  skus: Record<string, LiveLatestSkuBlock>;
}

export type ChangeKind = 'new_listing' | 'delisting' | 'restock' | 'other';

export interface ChangeRow {
  source: 'sod' | 'live';
  sku: string;
  brand: string;
  product_name: string;
  store_number: number;
  change_type: string;
  kind: ChangeKind;
  date: string;
  old_status: string | null;
  new_status: string | null;
  old_qty: number | null;
  new_qty: number | null;
  detected_at: string | null;
  in_territory: boolean;
  tier?: string | null;
  route_day?: number | null;
  attribution: ConversionTag | null;
}

/** GET /api/changes → flat rows tagged with `kind` (see api_changes). */
export interface ChangesPayload {
  days: number;
  since: string;
  count: number;
  rows: ChangeRow[];
  summary: {
    new_listings: number;
    delistings: number;
    restocks: number;
    in_territory: number;
    rep_converted: number;
    organic: number;
    baseline: number;
  };
}

export type OwnerStatus = 'none' | 'listing_received' | 'order_received' | 'completed';

export const OWNER_STATUSES: Array<{ key: OwnerStatus; label: string }> = [
  { key: 'none', label: 'No status' },
  { key: 'listing_received', label: 'Listing received' },
  { key: 'order_received', label: 'Order received' },
  { key: 'completed', label: 'Completed' },
];

export interface TerritoryDiscoveryCandidate {
  store_number: number;
  account: string;
  address: string;
  city: string;
  postal: string;
  /** Where the candidate was seen: 'stores_directory' and/or 'lcbo.com'. */
  seen_in: string[];
  /** Tracked SKUs this store already carries per the latest SOD view. */
  carrying_skus: string[];
}

/** GET /api/territory/discovery → { count, candidates } (see api_territory_discovery). */
export interface TerritoryDiscoveryPayload {
  count: number;
  candidates: TerritoryDiscoveryCandidate[];
}

/** POST /api/live/refresh → run_live_batch summary. status 'already_running'
 *  comes back as HTTP 202 (still resolves); 'error' comes back 502 (throws). */
export interface LiveRefreshPayload {
  status: 'ok' | 'partial' | 'error' | 'already_running';
  batch_id?: string;
  triggered_by?: string;
  skus?: string[];
  row_count?: number;
  store_count?: number;
  events_created?: number;
  errors?: string[];
  error?: string | null;
}

/** GET /api/live/store/N → { store_number, days, count, series }. */
export interface LiveStorePayload {
  store_number: number;
  days: number;
  count: number;
  series: Array<{
    sku: string;
    qty: number;
    checked_at: string;
    batch_id: string | null;
    brand: string;
  }>;
}

export type ReconcileFlag =
  | 'MATCH'
  | 'SOD_LAGS_LIVE'
  | 'LIVE_LAGS_SOD'
  | 'REP_MISMATCH'
  | 'MISSING_FROM_SOD'
  | 'MISSING_FROM_LIVE';

export interface ReconcileRow {
  sku: string;
  brand: string;
  product_name: string;
  store_number: number;
  account: string;
  city: string;
  tier: string | null;
  route_day: number | null;
  sod_on_hand: number | null;
  sod_status: string | null;
  sod_snapshot_date: string | null;
  live_qty: number | null;
  live_checked_at: string | null;
  rep_units: number | null;
  rep_on_shelf: boolean | null;
  rep_observed_at: string | null;
  /** Rep name — stripped to "Rep" in owner view by the backend. */
  rep: string | null;
  delta_sod_live: number | null;
  delta_rep_live: number | null;
  flag: ReconcileFlag;
}

/** Per-SKU last-checked timestamps — surfaced so a diff is never silent. */
export interface ReconcileSourceInfo {
  sod_latest_snapshot: string | null;
  live_batch_id: string | null;
  live_checked_at: string | null;
  rep_observation_window_days: number;
}

/** GET /api/reconcile → { days, rows, summary, sources } (see api_reconcile). */
export interface ReconcilePayload {
  days: number;
  rows: ReconcileRow[];
  summary: Partial<Record<ReconcileFlag, number>>;
  sources?: Record<string, ReconcileSourceInfo>;
  /** Present only when the territory book is empty. */
  note?: string;
}

/** Listings on/before LAUNCH_DATE are 'baseline' (pre-field-work). */
export type ConversionTag = 'baseline' | 'rep_converted' | 'organic';

export interface ConversionPerStoreRow {
  sku: string;
  brand: string;
  store_number: number;
  account: string;
  city: string;
  tier: string | null;
  in_territory: boolean;
  listing_date: string;
  source: 'sod' | 'live';
  attribution: ConversionTag | null;
  first_touch_date: string | null;
  /** Rep name — becomes "Rep" in owner view (server-side). */
  rep: string | null;
  /** Owner-safe: "Rep visit on 2026-07-16" — internal view includes the name. */
  touch_description: string | null;
}

/** GET /api/conversion → attribution scoreboard (see api_conversion). */
export interface ConversionPayload {
  days: number;
  since: string;
  launch_date: string;
  touchpoints: number;
  stores_touched: number;
  new_listings: number;
  rep_converted: number;
  organic: number;
  baseline: number;
  /** Already a percentage (0-100), rounded to 1 decimal on the backend. */
  conversion_rate: number;
  per_store: ConversionPerStoreRow[];
}

/** Per-SKU cell on a top-100 row: SOD + live + conversion side by side. */
export interface Top100SkuCell {
  brand: string;
  listed: boolean;
  sod_status: string | null;
  on_hand: number | null;
  live_qty: number | null;
  conversion: ConversionTag | null;
}

export interface Top100Row {
  store_number: number;
  priority_rank: number | null;
  tier: 'routed' | 'territory' | 'discovered';
  class?: string | null;
  account?: string | null;
  address?: string | null;
  city?: string | null;
  postal?: string | null;
  route_day?: number | null;
  route_stop?: number | null;
  owner_status: OwnerStatus;
  owner_status_note?: string;
  owner_status_updated_at?: string | null;
  /** Latest SOD presence + live qty per tracked SKU, keyed by SKU. */
  skus?: Record<string, Top100SkuCell>;
  last_touchpoint?: {
    activity_type: string;
    created_at: string | null;
    rep?: string | null;
  } | null;
  conversion?: ConversionTag | null;
}

/** GET /api/top100 → { count, rows, owner_statuses } (see api_top100). */
export interface Top100Payload {
  count: number;
  rows: Top100Row[];
  owner_statuses: string[];
}

/** GET /api/top100/funnel → { board_size, funnel, order } (see api_top100_funnel). */
export interface Top100FunnelPayload {
  board_size: number;
  funnel: Record<string, number>;
  order: string[];
}

export interface ManagerDashboardPayload {
  days_activity: number;
  days_listings: number;
  reps: ManagerRepRow[];
  territories: ManagerTerritoryRow[];
  totals: {
    reps: number;
    territories: number;
    total_stores: number;
    total_listings_won_60d: number;
    total_new_stores_60d: number;
    total_delistings_60d: number;
    total_activities_30d: number;
    total_gap: number;
  };
  freshness: Freshness;
}

'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { SkuTrend } from '@/lib/api';
import {
  CHART_SERIES,
  CHART_GRID,
  CHART_TICK,
  CHART_LABEL,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  STATUS,
} from '@/lib/chart-colors';

/**
 * Stacked-area chart of listed / delisting / fully-delisted store counts over time.
 * Designed to sit inside a Card on the SKU drill-down page.
 */
export function SkuTrendChart({ trend }: { trend: SkuTrend | undefined }) {
  if (!trend) {
    return <div className="skeleton h-64 w-full rounded-lg" />;
  }
  if (trend.series.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-muted)] text-sm">
        No snapshot history for {trend.sku} in the last {trend.days} days.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="listedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STATUS.listed} stopOpacity={0.7} />
              <stop offset="95%" stopColor={STATUS.listed} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STATUS.delisting} stopOpacity={0.7} />
              <stop offset="95%" stopColor={STATUS.delisting} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="fullDelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STATUS.delisted} stopOpacity={0.7} />
              <stop offset="95%" stopColor={STATUS.delisted} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis
            dataKey="date"
            tick={{ fill: CHART_TICK, fontSize: 11 }}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: CHART_TOOLTIP_BG,
              border: `1px solid ${CHART_TOOLTIP_BORDER}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: CHART_LABEL }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="listed"
            stackId="1"
            stroke={STATUS.listed}
            fill="url(#listedGrad)"
            name="Listed"
          />
          <Area
            type="monotone"
            dataKey="delisting"
            stackId="1"
            stroke={STATUS.delisting}
            fill="url(#delGrad)"
            name="Delisting"
          />
          <Area
            type="monotone"
            dataKey="fully_delisted"
            stackId="1"
            stroke={STATUS.delisted}
            fill="url(#fullDelGrad)"
            name="Fully delisted"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkuStockChart({ trend }: { trend: SkuTrend | undefined }) {
  if (!trend || trend.series.length === 0) return null;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="ohGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_SERIES[0]} stopOpacity={0.6} />
              <stop offset="95%" stopColor={CHART_SERIES[0]} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis
            dataKey="date"
            tick={{ fill: CHART_TICK, fontSize: 11 }}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: CHART_TOOLTIP_BG,
              border: `1px solid ${CHART_TOOLTIP_BORDER}`,
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="total_on_hand"
            stroke={CHART_SERIES[0]}
            fill="url(#ohGrad)"
            name="Total on-hand"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

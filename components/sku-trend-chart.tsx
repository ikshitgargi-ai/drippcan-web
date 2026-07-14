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
              <stop offset="5%" stopColor="#00b894" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#00b894" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fdcb6e" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#fdcb6e" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="fullDelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#e74c3c" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2430" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#7a818c', fontSize: 11 }}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis tick={{ fill: '#7a818c', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#12151b',
              border: '1px solid #1f2430',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#e6e8eb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="listed"
            stackId="1"
            stroke="#00b894"
            fill="url(#listedGrad)"
            name="Listed"
          />
          <Area
            type="monotone"
            dataKey="delisting"
            stackId="1"
            stroke="#fdcb6e"
            fill="url(#delGrad)"
            name="Delisting"
          />
          <Area
            type="monotone"
            dataKey="fully_delisted"
            stackId="1"
            stroke="#e74c3c"
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
              <stop offset="5%" stopColor="#d4a574" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#d4a574" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2430" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#7a818c', fontSize: 11 }}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis tick={{ fill: '#7a818c', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#12151b',
              border: '1px solid #1f2430',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="total_on_hand"
            stroke="#d4a574"
            fill="url(#ohGrad)"
            name="Total on-hand"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { UtensilsCrossed, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export default function HorecaPage() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [territoryFilter, setTerritoryFilter] = useState<number | undefined>();

  const territories = useQuery({ queryKey: ['territories'], queryFn: api.crmTerritories });
  const accounts = useQuery({
    queryKey: ['horeca', typeFilter, statusFilter, territoryFilter],
    queryFn: () =>
      api.horeca({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        territory_id: territoryFilter,
      }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <UtensilsCrossed size={24} className="text-[var(--color-accent)]" />
            HORECA Accounts
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Bars, restaurants, hotels, and catering. On-premise CRM alongside LCBO retail.
          </p>
        </div>
        <button className="flex items-center gap-2 h-11 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[#c13030]">
          <Plus size={16} /> New Account
        </button>
      </header>

      <Card>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Type">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="select"
            >
              <option value="">All types</option>
              <option value="restaurant">Restaurant</option>
              <option value="bar">Bar</option>
              <option value="hotel">Hotel</option>
              <option value="catering">Catering</option>
              <option value="club">Club / Lounge</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select"
            >
              <option value="">Any</option>
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="lost">Lost</option>
            </select>
          </Field>
          <Field label="Territory">
            <select
              value={territoryFilter ?? ''}
              onChange={(e) =>
                setTerritoryFilter(e.target.value ? Number(e.target.value) : undefined)
              }
              className="select"
            >
              <option value="">All territories</option>
              {territories.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{accounts.data?.length ?? 0} accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="data-table table-to-cards min-w-[900px] sm:min-w-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Last Visit</th>
                  <th>Products</th>
                </tr>
              </thead>
              <tbody>
                {accounts.data?.map((h) => (
                  <tr key={h.id}>
                    <td data-label="Name" className="font-medium">
                      {h.name}
                    </td>
                    <td data-label="Type" className="capitalize">
                      {h.account_type}
                    </td>
                    <td data-label="City">{h.city || '—'}</td>
                    <td data-label="Contact" className="text-xs">
                      <div>{h.contact_name || '—'}</div>
                      <div className="text-[var(--color-muted)]">{h.contact_title || ''}</div>
                    </td>
                    <td data-label="Status">
                      <span className={`badge status-${h.status}`}>{h.status}</span>
                    </td>
                    <td data-label="Priority">{h.priority}</td>
                    <td data-label="Last Visit" className="text-xs">
                      {formatDate(h.last_visit)}
                    </td>
                    <td data-label="Products" className="text-xs text-[var(--color-muted)]">
                      {h.products_carried?.slice(0, 30) || '—'}
                    </td>
                  </tr>
                ))}
                {accounts.data?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-[var(--color-muted)]">
                      No HORECA accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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

'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

const StoreMap = dynamic(() => import('@/components/store-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[min(70vh,600px)] w-full rounded-xl bg-[var(--color-card)] skeleton" />
  ),
});

export default function MapPage() {
  const [territoryId, setTerritoryId] = useState<number | undefined>();
  const territories = useQuery({ queryKey: ['territories'], queryFn: api.crmTerritories });
  const stores = useQuery({
    queryKey: ['stores', territoryId],
    queryFn: () => api.crmStores({ territory_id: territoryId, with_coords_only: true }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <MapPin size={24} className="text-[var(--color-accent)]" />
          Store Map
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          All LCBO stores colored by territory. Free OpenStreetMap tiles.
        </p>
      </header>

      <Card>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
              Territory
            </span>
            <select
              value={territoryId ?? ''}
              onChange={(e) => setTerritoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="select"
            >
              <option value="">All territories</option>
              {territories.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.store_count})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end text-sm text-[var(--color-muted)]">
            {stores.data?.length ?? 0} stores plotted
          </div>
        </CardContent>
      </Card>

      <StoreMap stores={stores.data ?? []} colorBy="territory" />

      {territories.data && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              {territories.data.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: t.color }}
                  />
                  <span>
                    {t.name} ({t.store_count})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

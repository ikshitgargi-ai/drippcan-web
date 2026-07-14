'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Plus,
  CheckCircle2,
  Download,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StoreLookup } from '@/components/store-lookup';
import { useActiveRep } from '@/lib/active-rep';

const REPS = ['Ikshit', 'Virat', 'Namit', 'Surya', 'Neeraj'];

const TRACKED_SKUS = [
  { sku: '0020187', label: 'Red Admiral Vodka' },
  { sku: '0022246', label: 'Chak De Canadian Whisky' },
  { sku: '0046340', label: 'Goenchi Cashew Feni' },
  { sku: '0046343', label: 'Goenchi Coconut Feni' },
  { sku: '0046282', label: 'Fratelli Classic Shiraz' },
  { sku: '0046285', label: 'Fratelli Chenin Blanc' },
  { sku: '0046286', label: 'Fratelli Sauvignon Blanc' },
  { sku: '0046287', label: 'Fratelli Cabernet Sauvignon' },
];

function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TastingsPage() {
  const queryClient = useQueryClient();
  const [activeRep] = useActiveRep();
  const [storeNum, setStoreNum] = useState('');
  const [storeQuery, setStoreQuery] = useState('');
  const [resolvedStore, setResolvedStore] = useState<{
    store_number: number;
    account: string;
    address: string;
  } | null>(null);
  const [rep, setRep] = useState<string>(activeRep || REPS[0]);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [sku, setSku] = useState('');
  const [units, setUnits] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [filterRep, setFilterRep] = useState<string>('');
  const [filterDays, setFilterDays] = useState(14);

  const upcoming = useQuery({
    queryKey: ['upcoming-tastings', filterRep, filterDays],
    queryFn: () => api.upcomingTastings({ days: filterDays, rep: filterRep || undefined }),
    refetchInterval: 60_000,
  });

  const book = useMutation({
    mutationFn: () =>
      api.bookTasting({
        store_number: resolvedStore?.store_number ?? Number(storeNum),
        rep,
        scheduled_date: date,
        sku: sku || undefined,
        notes: notes || undefined,
        expected_units: units ? Number(units) : undefined,
      }),
    onSuccess: (res) => {
      toast.success(
        res.status === 'booked' ? 'Tasting booked' : 'Already booked for this slot',
        {
          description: `${rep} · ${formatDate(date)} · #${
            resolvedStore?.store_number ?? storeNum
          }`,
        },
      );
      setStoreQuery('');
      setStoreNum('');
      setResolvedStore(null);
      setNotes('');
      setUnits('');
      setSku('');
      queryClient.invalidateQueries({ queryKey: ['upcoming-tastings'] });
    },
    onError: (e: Error) => toast.error('Booking failed', { description: e.message }),
  });

  const groupedByDate = useMemo(() => {
    const out: Record<string, typeof upcoming.data extends { bookings: infer B } ? B : never[]> =
      {};
    for (const b of upcoming.data?.bookings ?? []) {
      const k = b.scheduled_date;
      if (!out[k]) out[k] = [] as never;
      (out[k] as unknown as typeof b[]).push(b);
    }
    return out;
  }, [upcoming.data]);

  const canBook = (resolvedStore || /^\d+$/.test(storeNum)) && rep && date;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <Calendar size={24} className="text-[var(--color-accent)]" />
          Tastings
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Book future tastings, see what&apos;s on the calendar, subscribe to a per-rep iCal feed
          on your phone. Daily 06:30 ET email of tomorrow&apos;s schedule auto-sends to{' '}
          <code className="text-[var(--color-accent)]">TASTING_DIGEST_TO</code>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus size={18} /> Book a tasting
          </CardTitle>
          <CardDescription>
            Type a store number, name, or address — last conversation surfaces in the dropdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1 block">
              Store
            </label>
            <StoreLookup
              value={storeQuery}
              onChange={(v) => {
                setStoreQuery(v);
                if (/^\d+$/.test(v)) setStoreNum(v);
              }}
              onResolved={(s) => {
                setResolvedStore(s);
                if (s) setStoreNum(String(s.store_number));
              }}
              placeholder="e.g. 217, Yonge, M5V…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1 block">
                Rep
              </label>
              <select
                value={rep}
                onChange={(e) => setRep(e.target.value)}
                className="select w-full"
              >
                {REPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1 block">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="select w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1 block">
                SKU (optional)
              </label>
              <select value={sku} onChange={(e) => setSku(e.target.value)} className="select w-full">
                <option value="">Any / multiple</option>
                {TRACKED_SKUS.map((s) => (
                  <option key={s.sku} value={s.sku}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1 block">
                Expected units
              </label>
              <input
                type="number"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="0"
                className="select w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1 block">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. confirmed with manager, will set up table near entrance"
              rows={2}
              className="select w-full"
            />
          </div>

          <Button
            onClick={() => book.mutate()}
            disabled={!canBook || book.isPending}
            className="w-full"
          >
            <CheckCircle2 size={16} />
            {book.isPending ? 'Booking…' : 'Book Tasting'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock size={18} /> Upcoming ({upcoming.data?.count ?? '—'})
              </CardTitle>
              <CardDescription>
                Next {filterDays} days. Daily digest emails at 06:30 ET.
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={filterRep}
                onChange={(e) => setFilterRep(e.target.value)}
                className="select text-xs"
              >
                <option value="">All reps</option>
                {REPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={filterDays}
                onChange={(e) => setFilterDays(Number(e.target.value))}
                className="select text-xs"
              >
                <option value={7}>7d</option>
                <option value={14}>14d</option>
                <option value={30}>30d</option>
                <option value={60}>60d</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedByDate).length === 0 && (
            <div className="text-sm text-muted py-4 text-center">
              No tastings booked in this window. Book one above ↑
            </div>
          )}
          <div className="space-y-4">
            {Object.entries(groupedByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([d, items]) => (
                <div key={d}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                    <Calendar size={12} />
                    {formatDate(d)}
                    <span className="text-[10px] font-normal">
                      ({(items as unknown as { length: number }).length})
                    </span>
                  </div>
                  <div className="space-y-2 ml-4">
                    {(items as unknown as Array<{
                      deal_id: number;
                      store_number: number;
                      account: string;
                      address: string;
                      city: string;
                      manager_name: string;
                      phone: string;
                      sku: string;
                      rep: string;
                      notes: string;
                      territory_color: string;
                      territory_name: string;
                    }>).map((b) => (
                      <div
                        key={b.deal_id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-card-border)] bg-white/[0.02]"
                      >
                        <div
                          className="w-1 self-stretch rounded-full"
                          style={{ background: b.territory_color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            #{b.store_number} · {b.account || '—'}
                          </div>
                          {b.address && (
                            <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                              <MapPin size={11} />
                              {b.address}, {b.city}
                            </div>
                          )}
                          {b.manager_name && (
                            <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                              <User size={11} />
                              {b.manager_name}
                              {b.phone && (
                                <a
                                  href={`tel:${b.phone.replace(/[^0-9+]/g, '')}`}
                                  className="ml-1 text-[var(--color-accent)] flex items-center gap-1"
                                >
                                  <Phone size={11} />
                                  {b.phone}
                                </a>
                              )}
                            </div>
                          )}
                          {b.notes && (
                            <div className="text-xs text-muted mt-1 italic">{b.notes}</div>
                          )}
                          <div className="text-[10px] text-muted mt-1">
                            {b.rep}
                            {b.sku ? ` · SKU ${b.sku}` : ''} · {b.territory_name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download size={18} /> Calendar feeds (.ics)
          </CardTitle>
          <CardDescription>
            Subscribe in Google Calendar / Apple Calendar to see tastings on your phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {REPS.map((r) => (
            <a
              key={r}
              href={api.calendarIcsUrl(r, 90)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg border border-[var(--color-card-border)] bg-white/[0.02] hover:border-[var(--color-accent)] transition-colors"
            >
              <span className="font-medium text-sm">{r}</span>
              <span className="text-xs text-[var(--color-accent)] flex items-center gap-1">
                <Download size={12} />
                Subscribe (90d)
              </span>
            </a>
          ))}
          <div className="text-xs text-muted mt-3 flex items-start gap-2">
            <Mail size={12} className="mt-0.5 shrink-0" />
            <span>
              Plus: every morning at 06:30 ET, the day-before digest auto-emails to{' '}
              <code>TASTING_DIGEST_TO</code> (configure on the host&apos;s env vars). To test
              manually:{' '}
              <code>POST /api/admin/send-tasting-digest</code>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

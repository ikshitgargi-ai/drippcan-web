'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CommandBar } from './command-bar';
import { LiveTicker } from './live-ticker';
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Target,
  MapPin,
  UtensilsCrossed,
  Flag,
  Globe2,
  Menu,
  X,
  ArrowDownUp,
  Database,
  Navigation,
  Sparkles,
  Zap,
  Calendar,
  Plus,
  TrendingUp,
  Tag,
  Trophy,
  Download,
  Scale,
  Crown,
  ListOrdered,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ownerLogout, useOwnerMode } from '@/lib/owner-mode';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  anchor?: string;
};

// PRIMARY rep nav (5 mobile bottom-tab items). Anchor scroll within the home page
// so reps never feel like they're "leaving the app." Plus ONE manager link.
const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutDashboard, anchor: 'top' },
  { href: '/#skus', label: 'SKUs', icon: Tag, anchor: 'skus' },
  { href: '/#intel', label: 'Intel', icon: Activity, anchor: 'intel' },
  { href: '/log', label: 'Log', icon: Plus },
  { href: '/manager', label: 'Manager', icon: Trophy },
  // Drawer-only (after the 5-tab bar):
  { href: '/territory', label: 'Territory Book', icon: MapPin },
  { href: '/top100', label: 'Top-100 Board', icon: ListOrdered },
  { href: '/reconcile', label: 'Reconcile (3-way)', icon: Scale },
  { href: '/changes', label: 'Changes (X-day)', icon: TrendingUp },
  { href: '/finder', label: 'Store Finder', icon: MapPin },
  { href: '/today', label: "Today's Plan", icon: Calendar },
  { href: '/territory-plan', label: '14-Day Territory Plan', icon: Calendar },
  { href: '/daily-log', label: 'Daily Log', icon: Activity },
  { href: '/rep-performance', label: 'Rep Performance', icon: Trophy },
  { href: '/route-planner', label: 'Route Planner', icon: Navigation },
  { href: '/me', label: 'My Dashboard', icon: Trophy },
  { href: '/new-listings', label: 'New Listings (date range)', icon: TrendingUp },
  { href: '/follow-ups', label: 'Tasting Follow-ups', icon: AlertTriangle },
  { href: '/pipeline', label: 'Pipeline', icon: Target },
  { href: '/nearby', label: 'Nearby (GPS)', icon: Navigation },
  { href: '/ask', label: 'Ask AI', icon: Sparkles },
];

// OWNER SESSION LOCKDOWN — while ownerMode is set (owner passcode unlocked)
// the nav collapses to these four surfaces plus Logout, and every other
// route redirects to /owner. The backend allowlist is the real lock; this
// keeps the owner's phone from ever even asking for internal pages.
const OWNER_NAV: NavItem[] = [
  { href: '/owner', label: 'Owner Dashboard', icon: Crown },
  { href: '/top100', label: 'Top-100', icon: ListOrdered },
  { href: '/changes', label: 'Changes', icon: TrendingUp },
  { href: '/reconcile', label: 'Reconcile', icon: Scale },
];
const OWNER_ALLOWED_ROUTES = OWNER_NAV.map((n) => n.href);

// Secondary — only visible if explicitly opened (drawer "More" section)
const NAV_SECONDARY: NavItem[] = [
  { href: '/owner', label: 'Owner View', icon: Crown },
  { href: '/exports', label: 'Exports & Rep Audit', icon: Download },
  { href: '/oos', label: 'OOS Risk', icon: AlertTriangle },
  { href: '/opportunities', label: 'Opportunities', icon: Trophy },
  { href: '/activity', label: 'Activity Feed', icon: Zap },
  { href: '/sod', label: 'SOD Status', icon: Database },
  { href: '/map', label: 'Store Map', icon: MapPin },
  { href: '/territories', label: 'Territories', icon: Globe2 },
  { href: '/reports', label: 'Reports', icon: Activity },
  { href: '/goals', label: 'Goals', icon: Flag },
  { href: '/horeca', label: 'HORECA', icon: UtensilsCrossed },
  { href: '/reps', label: 'Reps', icon: ArrowDownUp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const ownerMode = useOwnerMode();

  const nav = ownerMode ? OWNER_NAV : NAV;
  const navSecondary = ownerMode ? [] : NAV_SECONDARY;
  const ownerBlocked = ownerMode && !OWNER_ALLOWED_ROUTES.includes(pathname);

  // Owner lockdown: any route outside the owner surfaces bounces to /owner.
  useEffect(() => {
    if (ownerBlocked) router.replace('/owner');
  }, [ownerBlocked, router]);

  function handleOwnerLogout() {
    ownerLogout();
    // Drop the owner session's cache so nothing bleeds across views.
    qc.clear();
    router.replace('/owner');
  }

  // Close mobile nav on route change
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll when mobile nav open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="min-h-[100dvh] bg-brand-grad">
      {/* Always-on global search (Cmd+K) — internal only; the owner session
          has no business searching stores or reps */}
      {!ownerMode && <CommandBar />}

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-[var(--color-card-border)] bg-[rgba(10,12,16,0.8)] backdrop-blur safe-top">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold">Dripp Tracker</span>
        </Link>
        <button
          aria-label="Open menu"
          onClick={() => setOpen(!open)}
          className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-[var(--color-card)]"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <nav
            className="absolute top-0 right-0 bottom-0 w-[85%] max-w-sm bg-[var(--color-card)] border-l border-[var(--color-card-border)] safe-top overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--color-card-border)]">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="font-semibold">Dripp Tracker</span>
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-[#1a1f29]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-3 space-y-1">
              {nav.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} />
              ))}
              {navSecondary.length > 0 && (
                <>
                  <div className="mt-4 mb-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-semibold">
                    More
                  </div>
                  {navSecondary.map((item) => (
                    <NavLink key={item.href} item={item} active={pathname === item.href} />
                  ))}
                </>
              )}
              {ownerMode && <OwnerLogoutButton onClick={handleOwnerLogout} />}
            </div>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-[var(--color-card-border)] bg-[rgba(18,21,27,0.8)] backdrop-blur safe-top">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[var(--color-card-border)]">
          <Logo />
          <div>
            <div className="text-sm font-semibold">Dripp Tracker</div>
            <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">
              Phoenix &amp; Dayaa at LCBO
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
          {navSecondary.length > 0 && (
            <>
              <div className="mt-5 mb-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-semibold">
                More
              </div>
              {navSecondary.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} />
              ))}
            </>
          )}
          {ownerMode && <OwnerLogoutButton onClick={handleOwnerLogout} />}
        </nav>
        <div className="p-4 text-[10px] text-[var(--color-muted)] border-t border-[var(--color-card-border)]">
          Dripp Tracker
        </div>
      </aside>

      {/* Mobile bottom tab bar — always visible. Anchor tabs scroll instead of navigating. */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[rgba(10,12,16,0.96)] backdrop-blur border-t border-[var(--color-card-border)] safe-bottom">
        <div className="flex items-stretch justify-around">
          {nav.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isAnchor = !!item.anchor;
            const onHome = pathname === '/';
            const active = isAnchor && onHome ? false : pathname === item.href;
            const handleClick = (e: React.MouseEvent) => {
              if (isAnchor && onHome) {
                e.preventDefault();
                if (item.anchor === 'top') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  document.getElementById(item.anchor!)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }
              }
              // Otherwise let Next.js Link navigate normally
            };
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClick}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px]',
                  active ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]',
                )}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {ownerMode && (
            <button
              onClick={handleOwnerLogout}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[var(--color-muted)]"
            >
              <LogOut size={20} />
              <span className="text-[10px] font-medium">Logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main content — with bottom padding for mobile tab bar */}
      <main className="lg:pl-64 min-h-[100dvh]">
        {/* Desktop top bar: search + ticker. Mobile already has its own header above */}
        <div className="hidden lg:flex sticky top-0 z-20 items-center gap-3 px-6 h-14 bg-[rgba(10,12,16,0.85)] backdrop-blur border-b border-[var(--color-card-border)]">
          <div className="flex-1">{!ownerMode && <CommandBar />}</div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span className="pulse-dot" />
            <span className="font-semibold uppercase tracking-wider">Live · 24/7</span>
          </div>
        </div>
        {/* Live ticker sits right under top bar on all device sizes >=sm.
            Its feed endpoint is internal, so the owner session skips it. */}
        {!ownerMode && <LiveTicker />}
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 pb-24 lg:pb-6 max-w-[1400px] mx-auto">
          {ownerBlocked ? (
            <div className="py-16 text-center text-sm text-[var(--color-muted)]">
              Owner view — taking you to the Owner Dashboard…
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}

function OwnerLogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 h-11 px-3 rounded-lg text-sm text-[var(--color-foreground)] hover:bg-[#1a1f29] transition-colors"
    >
      <LogOut size={18} className="text-[var(--color-muted)]" />
      Logout
    </button>
  );
}

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 h-11 px-3 rounded-lg text-sm transition-colors',
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-foreground)] hover:bg-[#1a1f29]',
      )}
    >
      <Icon size={18} className={active ? 'text-white' : 'text-[var(--color-muted)]'} />
      {item.label}
    </Link>
  );
}

function Logo() {
  return (
    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[#b89060] flex items-center justify-center text-[9px] font-bold text-[#7a1717]">
      DRIPP
    </div>
  );
}

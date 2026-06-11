'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { key: 'home', label: 'HOME', href: '/' },
  { key: 'dashboard', label: 'DASHBOARD', href: '/dashboard' },
  { key: 'rebalance', label: 'REBALANCE', href: '/rebalance' },
  { key: 'vault', label: 'VAULT', href: '/vault' },
  { key: 'aureus', label: 'AUREUS', href: '/aureus' },
  { key: 'agents', label: 'AGENTS', href: '/agents' },
];

export function MinimalTopNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link className="flex items-center gap-2.5" href="/">
          <span className="font-bold tracking-wide text-amber-400">GBLIN</span>
          <span className="hidden text-[10px] uppercase tracking-[0.28em] text-zinc-500 sm:inline">
            Base Treasury Protocol
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 px-2 py-1.5 shadow-inner">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] transition sm:px-4 sm:text-[11px] ${
                  active
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-amber-300'
                }`}
                href={item.href}
                key={item.key}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

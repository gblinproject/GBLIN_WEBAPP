/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, Globe, Menu, Zap, X } from 'lucide-react';
import type { Language } from '@/translations/index';
import { DISPLAY_CONTRACT_ADDRESS, LANGUAGES, LOGO_URL, WHITEPAPER_URL, shortenAddress } from './protocol-data';
import type { ProtocolView } from './protocol-sections';

interface ProtocolShellProps {
  view: ProtocolView;
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  isConnected: boolean;
  address?: string;
  openWallet: () => void;
  disconnectWallet: () => void;
  children: ReactNode;
}

const navItems: Array<{ key: 'home' | 'buy' | 'dashboard' | 'rebalance' | 'vault' | 'aureus' | 'agents'; href: string; view: ProtocolView | null }> = [
  { key: 'home', href: '/', view: 'home' },
  { key: 'buy', href: '/buy-gblin', view: 'buy' },
  { key: 'dashboard', href: '/dashboard', view: 'dashboard' },
  { key: 'rebalance', href: '/rebalance', view: 'rebalance' },
  { key: 'vault', href: '/vault', view: 'vault' },
  { key: 'aureus', href: '/aureus', view: null },
  { key: 'agents', href: '/agents', view: null }
];

const shellCard = 'rounded-[2rem] border border-white/10 bg-[#0A0A0A]/90 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl';
const shellContainer = 'mx-auto w-full max-w-[1720px]';
const CONTACT_EMAIL = 'info@gblin.digital';
const CONTACT_LINKS = [
  { key: 'email', platform: 'Email', label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, external: false },
  { key: 'farcaster', platform: 'Farcaster', label: '@gblin', href: 'https://warpcast.com/gblin', external: true },
  { key: 'x', platform: 'X', label: '@GBLIN_Protocol', href: 'https://x.com/GBLIN_Protocol', external: true }
] as const;

function LiveClock() {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString());
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <span>{currentTime}</span>;
}

function ContactMenuPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0A0A0A]/95 shadow-2xl backdrop-blur-2xl ${className}`}>
      {CONTACT_LINKS.map((item, index) => (
        <a
          className={`flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5 ${index > 0 ? 'border-t border-white/5' : ''}`}
          href={item.href}
          key={item.key}
          rel={item.external ? 'noreferrer' : undefined}
          target={item.external ? '_blank' : undefined}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">{item.platform}</p>
            <p className="truncate text-sm font-semibold text-white">{item.label}</p>
          </div>
          {item.external ? <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" /> : null}
        </a>
      ))}
    </div>
  );
}

export function ProtocolShell(props: ProtocolShellProps) {
  const { language, setLanguage, t, isConnected, address, openWallet, disconnectWallet, children } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const pathname = usePathname();

  const activeLanguage = useMemo(() => LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0], [language]);
  const contactLabel = language === 'it' ? 'CONTATTI' : 'CONTACTS';
  const isActiveNavItem = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  useEffect(() => {
    setMenuOpen(false);
    setShowLangSelector(false);
    setShowContactMenu(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#040404] text-white selection:bg-amber-500/30 selection:text-amber-100">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#050505_0%,#050505_100%)]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020202]/80 shadow-lg backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className={`${shellContainer} px-4 py-4 sm:px-6 lg:px-8 2xl:px-10`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link className="flex items-center gap-3 sm:gap-4" href="/">
                <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-amber-500/20 bg-black/40 transition-transform duration-500 hover:scale-105">
                  <img alt="GBLIN" className="h-full w-full object-cover" src={LOGO_URL} />
                </span>
                <div className="min-w-0">
                  <p className="bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200 bg-clip-text font-serif text-xl font-bold tracking-tight text-transparent">GBLIN</p>
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="truncate text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">{t('site.brandSubtitle')}</p>
                  </div>
                </div>
              </Link>
            </div>

            <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 shadow-inner lg:flex">
              {navItems.map((item) => {
                const isActive = isActiveNavItem(item.href);

                return (
                  <Link
                    aria-current={isActive ? 'page' : undefined}
                    className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] transition ${isActive ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-amber-300'}`}
                    href={item.href}
                    key={item.key}
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="relative">
                <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:bg-white/10 hover:text-amber-400" onClick={() => {
                  setShowLangSelector((value) => !value);
                  setMenuOpen(false);
                  setShowContactMenu(false);
                }} type="button">
                  <Globe className="h-4 w-4" />
                </button>
                {showLangSelector ? (
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-2 shadow-2xl backdrop-blur-2xl">
                    {LANGUAGES.map((item) => (
                      <button
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${item.code === language ? 'text-amber-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                        key={item.code}
                        onClick={() => {
                          setLanguage(item.code);
                          setShowLangSelector(false);
                        }}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.flag}</span>
                          <span>{item.name}</span>
                        </span>
                        {item.code === activeLanguage.code ? <span className="text-[10px] font-mono uppercase tracking-[0.22em]">live</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <button aria-expanded={showContactMenu} aria-haspopup="true" className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200 transition-all hover:bg-amber-500/25 hover:text-white shadow-[0_0_24px_rgba(245,158,11,0.16)]" onClick={() => {
                  setShowContactMenu((value) => !value);
                  setShowLangSelector(false);
                  setMenuOpen(false);
                }} type="button">
                  {contactLabel}
                </button>
                {showContactMenu ? <ContactMenuPanel className="absolute right-0 top-full mt-2 w-[320px]" /> : null}
              </div>
              {isConnected && address ? (
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] font-mono text-zinc-300 transition-all hover:bg-white/10"
                  onClick={disconnectWallet}
                  title="Click to disconnect"
                  type="button"
                >
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {shortenAddress(address)}
                </button>
              ) : null}
              <Link
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:from-amber-400 hover:to-amber-300 hover:shadow-[0_0_32px_rgba(245,158,11,0.5)]"
                href="/account"
                prefetch={true}
              >
                <Zap className="h-3.5 w-3.5" />
                {t('nav.hubCta')}
              </Link>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <div className="relative">
                <button className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-200 transition hover:bg-white/10 hover:text-amber-300" onClick={() => {
                  setShowLangSelector((value) => !value);
                  setMenuOpen(false);
                  setShowContactMenu(false);
                }} type="button">
                  <Globe className="h-4 w-4" />
                  <span>{activeLanguage.code.toUpperCase()}</span>
                </button>
                {showLangSelector ? (
                  <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-2 shadow-2xl backdrop-blur-2xl">
                    {LANGUAGES.map((item) => (
                      <button
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${item.code === language ? 'text-amber-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                        key={item.code}
                        onClick={() => {
                          setLanguage(item.code);
                          setShowLangSelector(false);
                        }}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span>{item.flag}</span>
                          <span>{item.name}</span>
                        </span>
                        {item.code === activeLanguage.code ? <span className="text-[10px] font-mono uppercase tracking-[0.22em]">live</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10" onClick={() => {
                setMenuOpen((value) => !value);
                setShowLangSelector(false);
                setShowContactMenu(false);
              }} type="button">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mt-3 lg:hidden">
            <div className="grid gap-2">
              <Link
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:from-amber-400 hover:to-amber-300"
                href="/account"
                prefetch={true}
              >
                <Zap className="h-3.5 w-3.5" />
                {t('nav.hubCta')}
              </Link>
              <div className="relative">
                <button aria-expanded={showContactMenu} aria-haspopup="true" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200 transition-all hover:bg-amber-500/25 hover:text-white shadow-[0_0_24px_rgba(245,158,11,0.16)]" onClick={() => {
                  setShowContactMenu((value) => !value);
                  setShowLangSelector(false);
                  setMenuOpen(false);
                }} type="button">
                  {contactLabel}
                </button>
                {showContactMenu ? <ContactMenuPanel className="mt-2 w-full" /> : null}
              </div>
              {isConnected && address ? (
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                  onClick={disconnectWallet}
                  type="button"
                >
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {shortenAddress(address)} · Disconnect
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/5 px-4 py-4 lg:hidden sm:px-6">
            <div className={`${shellContainer} space-y-3`}>
              {navItems.map((item) => (
                <Link
                  className={`block rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] transition ${isActiveNavItem(item.href) ? 'bg-white text-black' : 'border border-white/10 bg-white/5 text-zinc-200'}`}
                  href={item.href}
                  key={item.key}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              ))}
              <Link
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] transition ${isActiveNavItem('/account') ? 'bg-amber-500 text-black' : 'bg-gradient-to-r from-amber-500/20 to-amber-400/10 border border-amber-500/30 text-amber-300'}`}
                href="/account"
                prefetch={true}
              >
                <Zap className="h-3.5 w-3.5" />
                {t('nav.hubCta')}
              </Link>
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">{contactLabel}</p>
                <ContactMenuPanel className="w-full" />
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className={`${shellContainer} px-4 py-8 sm:px-6 sm:py-10 lg:px-8 2xl:px-10`}>
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-400">
            <span>{t('site.network')}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            <span>{t('site.live')}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            <LiveClock />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-400">
            <span>{shortenAddress(DISPLAY_CONTRACT_ADDRESS)}</span>
          </div>
        </div>
        {children}
      </main>

      <footer className="border-t border-white/10 pb-10 pt-8">
        <div className={`${shellContainer} grid gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8 2xl:px-10`}>
          <div className={`${shellCard} p-5`}>
            <p className="font-serif text-xl tracking-tight text-white">GBLIN</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              {t('site.footerDesc')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <a className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10" href={WHITEPAPER_URL} rel="noreferrer" target="_blank">
              {t('site.whitepaper')}
              <ExternalLink className="h-4 w-4" />
            </a>
            <a className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10" href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`} rel="noreferrer" target="_blank">
              {t('site.basescan')}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

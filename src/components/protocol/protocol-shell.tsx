/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConnect } from 'wagmi';
import { ArrowRight, ChevronDown, ExternalLink, Globe, Menu, X } from 'lucide-react';
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
  /** Kept for panels that ask the visitor to connect from inside the page; the header
   *  connects in place and does not use it. */
  openWallet: () => void;
  disconnectWallet: () => void;
  children: ReactNode;
}

interface NavLeaf {
  key: string;
  href: string;
}

// Five destinations in the bar; everything else one click deep under "More".
const PRIMARY_NAV: NavLeaf[] = [
  { key: 'overview', href: '/' },
  { key: 'vault', href: '/vault' },
  { key: 'auction', href: '/rebalance' },
  { key: 'agents', href: '/agents' },
];
const MORE_NAV: NavLeaf[] = [
  { key: 'buy', href: '/buy-gblin' },
  { key: 'dashboard', href: '/dashboard' },
  { key: 'observatory', href: '/observatory' },
  { key: 'coherence', href: '/coherence' },
  { key: 'receipts', href: '/receipts' },
  { key: 'aureus', href: '/aureus' },
  { key: 'faq', href: '/faq' },
  { key: 'operatedByAi', href: '/operated-by-ai' },
];

const CONTAINER = 'mx-auto w-full max-w-[1200px] px-5 sm:px-6 lg:px-8';
const CONTACT_EMAIL = 'info@gblin.digital';
const GITHUB_URL = 'https://github.com/gblinproject';
const REVIEWS_URL = 'https://github.com/gblinproject/GBLIN-Protocol/blob/main/audits/README.md';

const CONTACT_LINKS = [
  { key: 'email', label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, external: false },
  { key: 'farcaster', label: 'Farcaster', href: 'https://warpcast.com/gblin', external: true },
  { key: 'x', label: 'X', href: 'https://x.com/GBLIN_Protocol', external: true },
] as const;

function useClickOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return ref;
}

function Dropdown({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  if (!open) return null;
  return (
    <div className={`absolute right-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0b] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${className}`}>
      {children}
    </div>
  );
}

const menuItem = 'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white';

/**
 * Connect from the header, in place. Sending the visitor to another page to pick a wallet
 * loses whatever they were reading; the wallet list opens where the button is, and the page
 * stays put. Duplicate connector names are collapsed: several injected wallets announce
 * themselves under the same label and would otherwise appear twice.
 */
function HeaderConnect({ label, variant }: { label: string; variant: 'bar' | 'sheet' }) {
  const { connectors, connect, isPending } = useConnect();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const seen = new Set<string>();
  const list = connectors.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));

  const choices = (
    <div className="grid gap-1">
      {list.map((c) => (
        <button
          className={menuItem}
          disabled={isPending}
          key={c.uid}
          onClick={() => { connect({ connector: c }); setOpen(false); }}
          type="button"
        >
          {c.name}
          <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      ))}
    </div>
  );

  if (variant === 'sheet') {
    return (
      <div className="grid gap-2">
        <button className="g-btn g-btn-primary w-full" onClick={() => setOpen((v) => !v)} type="button">
          {label}
        </button>
        {open ? <div className="rounded-xl border border-white/10 bg-[#0b0b0b] p-1.5">{choices}</div> : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button aria-expanded={open} className="g-btn g-btn-ghost g-btn-sm" onClick={() => setOpen((v) => !v)} type="button">
        {label}
      </button>
      <Dropdown open={open}>{choices}</Dropdown>
    </div>
  );
}

export function ProtocolShell(props: ProtocolShellProps) {
  const { language, setLanguage, t, isConnected, address, disconnectWallet, children } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // The bar starts invisible and only separates itself from the page once the
  // reader has left the hero.
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const activeLanguage = useMemo(() => LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0], [language]);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const moreActive = MORE_NAV.some((item) => isActive(item.href));

  const langRef = useClickOutside<HTMLDivElement>(langOpen, () => setLangOpen(false));
  const moreRef = useClickOutside<HTMLDivElement>(moreOpen, () => setMoreOpen(false));
  const accountRef = useClickOutside<HTMLDivElement>(accountOpen, () => setAccountOpen(false));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setLangOpen(false);
    setMoreOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Lock the page behind the mobile sheet.
  //
  // NOT with `overflow: hidden` on the body: that turns the body into a scroll container and
  // kills `position: sticky`, so the bar drops to its place in the document and disappears
  // from view. The page is pinned by taking the body out of flow at its current offset, and
  // the header switches to `fixed` for as long as the sheet is open, so it stays where it is.
  //
  // The offset is restored on close, but only when the route has not changed: following a
  // link from inside the sheet must land at the top of the new page, not at the old scroll
  // position.
  const lockRef = useRef<{ y: number; path: string } | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const y = window.scrollY;
    lockRef.current = { y, path: window.location.pathname };
    const body = document.body;
    const prima = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    return () => {
      body.style.position = prima.position;
      body.style.top = prima.top;
      body.style.width = prima.width;
      const stato = lockRef.current;
      lockRef.current = null;
      if (!stato || stato.path !== window.location.pathname) return;
      // After a frame: the header goes back into flow and the document regains its height,
      // so restoring before layout settles lands a few dozen pixels short.
      requestAnimationFrame(() => window.scrollTo(0, stato.y));
    };
  }, [menuOpen]);

  const nav = (key: string) => t(`ui.nav.${key}`);

  const LanguageList = ({ onPick }: { onPick: () => void }) => (
    <>
      {LANGUAGES.map((item) => (
        <button
          className={`${menuItem} ${item.code === language ? 'text-amber-300' : ''}`}
          key={item.code}
          onClick={() => {
            setLanguage(item.code);
            onPick();
          }}
          type="button"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{item.flag}</span>
            <span>{item.name}</span>
          </span>
          {item.code === language ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
        </button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header
        className={`${menuOpen ? 'fixed inset-x-0' : 'sticky'} top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-500 ${
          scrolled || menuOpen ? 'border-b border-[color:var(--line)] bg-[#050505]/90 backdrop-blur-md' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className={`${CONTAINER} grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4`}>
          <Link className="flex shrink-0 items-center gap-3" href="/">
            <img alt="" className="h-7 w-7" height={28} src={LOGO_URL} width={28} />
            <span className="text-[15px] font-medium tracking-[0.2em] text-amber-200">GBLIN</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center justify-center gap-8 lg:flex">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors ${active ? 'text-[color:var(--ink)]' : 'text-zinc-500 hover:text-[color:var(--ink)]'} after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-amber-300 after:transition-opacity ${active ? 'after:opacity-100' : 'after:opacity-0'}`}
                  href={item.href}
                  key={item.key}
                >
                  {nav(item.key)}
                </Link>
              );
            })}
            <div className="relative" ref={moreRef}>
              <button
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className={`inline-flex items-center gap-1.5 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors ${moreActive ? 'text-[color:var(--ink)]' : 'text-zinc-500 hover:text-[color:var(--ink)]'}`}
                onClick={() => setMoreOpen((v) => !v)}
                type="button"
              >
                {nav('more')}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              <Dropdown open={moreOpen} className="left-0 right-auto">
                {MORE_NAV.map((item) => (
                  <Link className={`${menuItem} ${isActive(item.href) ? 'text-white' : ''}`} href={item.href} key={item.key}>
                    {nav(item.key)}
                  </Link>
                ))}
              </Dropdown>
            </div>
          </nav>

          <div className="col-start-3 flex items-center justify-end gap-2">
            <div className="relative" ref={langRef}>
              <button
                aria-label={nav('language')}
                className="g-btn g-btn-ghost g-btn-sm gap-1.5 px-2.5"
                onClick={() => setLangOpen((v) => !v)}
                type="button"
              >
                <Globe className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">{activeLanguage.code}</span>
              </button>
              <Dropdown open={langOpen}>
                <LanguageList onPick={() => setLangOpen(false)} />
              </Dropdown>
            </div>

            <span className="hidden lg:block">
              <Link className="g-btn g-btn-secondary g-btn-sm" href="/buy-gblin">
                {t('landing.cta')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </span>

            {isConnected && address ? (
              <div className="relative hidden lg:block" ref={accountRef}>
                <button
                  aria-expanded={accountOpen}
                  className="g-btn g-btn-secondary g-btn-sm gap-2 font-mono text-xs"
                  onClick={() => setAccountOpen((v) => !v)}
                  type="button"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {shortenAddress(address)}
                </button>
                <Dropdown open={accountOpen}>
                  <Link className={menuItem} href="/account">{nav('account')}</Link>
                  <button className={menuItem} onClick={disconnectWallet} type="button">{nav('disconnect')}</button>
                </Dropdown>
              </div>
            ) : (
              <span className="hidden lg:block">
                <HeaderConnect label={nav('connect')} variant="bar" />
              </span>
            )}

            <button
              aria-expanded={menuOpen}
              aria-label={nav('menu')}
              className="g-btn g-btn-ghost g-btn-sm px-2.5 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              type="button"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-white/[0.07] bg-[#050505] lg:hidden">
            <div className={`${CONTAINER} py-4`}>
              <nav aria-label="Mobile" className="grid gap-1">
                {[...PRIMARY_NAV, ...MORE_NAV].map((item) => (
                  <Link
                    className={`rounded-lg px-3 py-3 text-base font-medium ${isActive(item.href) ? 'bg-white/[0.07] text-white' : 'text-zinc-300'}`}
                    href={item.href}
                    key={item.key}
                  >
                    {nav(item.key)}
                  </Link>
                ))}
              </nav>
              <div className="mt-4 grid gap-2">
                {isConnected && address ? (
                  <>
                    <Link className="g-btn g-btn-secondary w-full font-mono text-xs" href="/account">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {shortenAddress(address)}
                    </Link>
                    <button className="g-btn g-btn-ghost w-full" onClick={disconnectWallet} type="button">{nav('disconnect')}</button>
                  </>
                ) : (
                  <HeaderConnect label={nav('connect')} variant="sheet" />
                )}
              </div>
              <div className="mt-6">
                <p className="g-eyebrow px-3">{nav('contacts')}</p>
                <div className="mt-2 grid gap-1">
                  {CONTACT_LINKS.map((item) => (
                    <a className={menuItem} href={item.href} key={item.key} rel={item.external ? 'noreferrer' : undefined} target={item.external ? '_blank' : undefined}>
                      {item.label}
                      {item.external ? <ExternalLink className="h-3.5 w-3.5 text-zinc-500" /> : null}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className={`${CONTAINER} py-8 sm:py-10`}>{children}</main>

      <footer className="mt-16 border-t border-[color:var(--line)]">
        <div className={`${CONTAINER} py-12`}>
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <img alt="" className="h-7 w-7 rounded-full" height={28} src={LOGO_URL} width={28} />
                <span className="text-[15px] font-semibold tracking-tight text-amber-300">GBLIN</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-400">{t('site.footerDesc')}</p>
              <p className="mt-5 g-eyebrow">{t('ui.footer.vaultInService')}</p>
              <a
                className="mt-2 inline-flex items-center gap-2 font-mono text-xs text-zinc-300 hover:text-amber-300"
                href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="break-all">{DISPLAY_CONTRACT_ADDRESS}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>

            <div>
              <p className="g-eyebrow">{t('ui.footer.protocol')}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {PRIMARY_NAV.filter((i) => i.key !== 'agents').map((item) => (
                  <li key={item.key}><Link className="text-zinc-400 hover:text-white" href={item.href}>{nav(item.key)}</Link></li>
                ))}
                <li><Link className="text-zinc-400 hover:text-white" href="/dashboard">{nav('dashboard')}</Link></li>
                <li><Link className="text-zinc-400 hover:text-white" href="/faq">{nav('faq')}</Link></li>
              </ul>
            </div>

            <div>
              <p className="g-eyebrow">{t('ui.footer.forAgents')}</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="text-zinc-400 hover:text-white" href="/agents">{nav('agents')}</Link></li>
                <li><Link className="text-zinc-400 hover:text-white" href="/observatory">{nav('observatory')}</Link></li>
                <li><Link className="text-zinc-400 hover:text-white" href="/coherence">{nav('coherence')}</Link></li>
                <li><Link className="text-zinc-400 hover:text-white" href="/receipts">{nav('receipts')}</Link></li>
                <li><Link className="text-zinc-400 hover:text-white" href="/operated-by-ai">{nav('operatedByAi')}</Link></li>
              </ul>
            </div>

            <div>
              <p className="g-eyebrow">{t('ui.footer.resources')}</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a className="text-zinc-400 hover:text-white" href={WHITEPAPER_URL} rel="noreferrer" target="_blank">{t('site.whitepaper')}</a></li>
                <li><a className="text-zinc-400 hover:text-white" href={GITHUB_URL} rel="noreferrer" target="_blank">{t('ui.footer.source')}</a></li>
                <li><a className="text-zinc-400 hover:text-white" href={REVIEWS_URL} rel="noreferrer" target="_blank">{t('ui.footer.reviews')}</a></li>
                <li><a className="text-zinc-400 hover:text-white" href={`https://basescan.org/address/${DISPLAY_CONTRACT_ADDRESS}`} rel="noreferrer" target="_blank">{t('site.basescan')}</a></li>
              </ul>
              <p className="g-eyebrow mt-6">{t('ui.footer.contact')}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {CONTACT_LINKS.map((item) => (
                  <li key={item.key}>
                    <a className="text-zinc-400 hover:text-white" href={item.href} rel={item.external ? 'noreferrer' : undefined} target={item.external ? '_blank' : undefined}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.07] pt-6 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl leading-5">{t('ui.footer.disclaimer')} {t('ui.footer.previousDeployments')}</p>
            <div className="flex items-center gap-4">
              <Link className="hover:text-zinc-300" href="/terms">{t('ui.footer.terms')}</Link>
              <Link className="hover:text-zinc-300" href="/privacy">{t('ui.footer.privacy')}</Link>
              <span>Base · {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
        {/* The closing line of the reference: the name, what it is for, and the
            invitation to check it. */}
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--line)] py-6`}>
          <span className="flex items-baseline gap-4">
            <span className="text-[15px] font-medium tracking-[0.2em] text-amber-200">GBLIN</span>
            <span className="text-xs text-zinc-600">{t('site.footerTagline')}</span>
          </span>
          <span className="flex items-center gap-4">
            <span aria-hidden="true" className="hidden h-px w-24 bg-[color:var(--line-strong)] sm:block" />
            <Link className="g-eyebrow hover:text-[color:var(--ink)]" href="/vault">{t('ui.home.trustTitle')}</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

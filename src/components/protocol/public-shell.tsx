'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { translations, type Language } from '@/translations/index';
import { protocolTranslations } from './protocol-translations';
import { LANGUAGES } from './protocol-data';
import { ProtocolShell } from './protocol-shell';

function isSupportedLanguage(value: string | null): value is Language {
  return LANGUAGES.some((item) => item.code === value);
}

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const [language, setLanguageState] = useState<Language>('en');

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gblin-language', next);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('gblin-language');
    if (isSupportedLanguage(stored)) {
      setLanguageState(stored);
      return;
    }
    const browser = navigator.language.split('-')[0].toLowerCase();
    if (isSupportedLanguage(browser)) setLanguageState(browser);
  }, []);

  const t = useCallback(
    (key: string) => {
      const segs = key.split('.');
      const getValue = (src: any) =>
        segs.reduce<any>(
          (acc, part) => (acc && typeof acc === 'object' && part in acc ? acc[part] : null),
          src,
        );
      const cur = getValue(protocolTranslations[language]) ?? getValue(translations[language]);
      if (typeof cur === 'string') return cur;
      const fb = getValue(protocolTranslations.en) ?? getValue(translations.en);
      return typeof fb === 'string' ? fb : key;
    },
    [language],
  );

  const handleDisconnect = useCallback(() => {
    if (activeWallet) disconnect(activeWallet);
  }, [activeWallet, disconnect]);

  return (
    <ProtocolShell
      address={account?.address}
      disconnectWallet={handleDisconnect}
      isConnected={!!account?.address}
      language={language}
      openWallet={() => router.push('/account')}
      setLanguage={setLanguage}
      t={t}
      view="home"
    >
      {children}
    </ProtocolShell>
  );
}

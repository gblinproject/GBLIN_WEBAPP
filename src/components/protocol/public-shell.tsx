'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { translations, type Language } from '@/translations/index';
import { protocolTranslations } from './protocol-translations';
import { LANGUAGES } from './protocol-data';
import { ProtocolShell } from './protocol-shell';
import { I18nContext } from './i18n-context';

function isSupportedLanguage(value: string | null): value is Language {
  return LANGUAGES.some((item) => item.code === value);
}

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const { address: accountAddress } = useAccount();
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
    disconnect();
  }, [disconnect]);

  return (
    <ProtocolShell
      address={accountAddress}
      disconnectWallet={handleDisconnect}
      isConnected={!!accountAddress}
      language={language}
      openWallet={() => router.push('/account')}
      setLanguage={setLanguage}
      t={t}
      view="home"
    >
      <I18nContext.Provider value={{ t, language }}>
        {children}
      </I18nContext.Provider>
    </ProtocolShell>
  );
}

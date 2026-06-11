'use client';

import { createContext, useContext } from 'react';
import type { Language } from '@/translations/index';

interface I18nContextValue {
  t: (key: string) => string;
  language: Language;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback when used outside the provider: return the key.
    return { t: (k: string) => k, language: 'en' as Language };
  }
  return ctx;
}

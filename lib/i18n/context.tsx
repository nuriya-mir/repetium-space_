'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { Locale, Translations, translations, LOCALES } from './translations'

const STORAGE_KEY = 'repetium_locale'
const DEFAULT_LOCALE: Locale = 'ru'

interface I18nContextValue {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
  toggle: () => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: translations[DEFAULT_LOCALE],
  setLocale: () => {},
  toggle: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && LOCALES.includes(saved)) {
      setLocaleState(saved)
    }
  }, [])

  // Sync <html lang> attribute
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggle = useCallback(() => {
    setLocale(locale === 'ru' ? 'en' : 'ru')
  }, [locale, setLocale])

  return (
    <I18nContext.Provider value={{ locale, t: translations[locale], setLocale, toggle }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

/** Shorthand: just the translation object */
export function useT(): Translations {
  return useContext(I18nContext).t
}

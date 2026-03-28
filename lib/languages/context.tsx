'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import {
  TargetLanguage,
  LanguageConfig,
  TARGET_LANGUAGES,
  DEFAULT_TARGET,
  AVAILABLE_TARGETS,
} from './config'

const STORAGE_KEY = 'repetium_target_lang'

interface TargetLangContextValue {
  targetLang: TargetLanguage
  targetLangConfig: LanguageConfig
  setTargetLang: (lang: TargetLanguage) => void
  available: TargetLanguage[]
}

const TargetLangContext = createContext<TargetLangContextValue>({
  targetLang: DEFAULT_TARGET,
  targetLangConfig: TARGET_LANGUAGES[DEFAULT_TARGET],
  setTargetLang: () => {},
  available: AVAILABLE_TARGETS,
})

export function TargetLangProvider({ children }: { children: ReactNode }) {
  const [targetLang, setTargetLangState] = useState<TargetLanguage>(DEFAULT_TARGET)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as TargetLanguage | null
    if (saved && AVAILABLE_TARGETS.includes(saved)) {
      setTargetLangState(saved)
    }
  }, [])

  const setTargetLang = useCallback((lang: TargetLanguage) => {
    setTargetLangState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }, [])

  return (
    <TargetLangContext.Provider
      value={{
        targetLang,
        targetLangConfig: TARGET_LANGUAGES[targetLang],
        setTargetLang,
        available: AVAILABLE_TARGETS,
      }}
    >
      {children}
    </TargetLangContext.Provider>
  )
}

export function useTargetLang(): TargetLangContextValue {
  return useContext(TargetLangContext)
}

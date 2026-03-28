'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  PreferencesContext,
  UserPreferences,
  DEFAULTS,
  loadPreferences,
  savePreferences,
  applyBodyClasses,
} from '@/lib/hooks/usePreferences'

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS)

  // Load from localStorage on mount and apply body classes
  useEffect(() => {
    const loaded = loadPreferences()
    setPrefs(loaded)
    applyBodyClasses(loaded)
  }, [])

  // Listen for changes from other tabs / components
  useEffect(() => {
    function onStorage() {
      const loaded = loadPreferences()
      setPrefs(loaded)
      applyBodyClasses(loaded)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('repetium-prefs-changed', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('repetium-prefs-changed', onStorage)
    }
  }, [])

  const set = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      // noSurprises automatically enables no-animations
      if (key === 'noSurprises' && value === true) {
        next.animations = false
      }
      savePreferences(next)
      applyBodyClasses(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    savePreferences(DEFAULTS)
    applyBodyClasses(DEFAULTS)
    setPrefs(DEFAULTS)
  }, [])

  return (
    <PreferencesContext.Provider value={{ prefs, set, reset }}>
      {children}
    </PreferencesContext.Provider>
  )
}

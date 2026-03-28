'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  // Appearance
  darkMode: boolean
  animations: boolean
  readingOverlay: 'none' | 'yellow' | 'blue' | 'pink' | 'green' | 'peach'
  readingFont: 'atkinson' | 'opendyslexic'

  // Reading & perception
  dyslexiaMode: boolean
  autoTTS: boolean
  ttsSpeed: 0.7 | 1 | 1.3

  // Exercises
  adaptiveTiming: boolean
  manualFadeDuration: number | null  // ms; null = adaptive
  hintThreshold: 0 | 1 | 2 | 3     // 0 = show immediately

  // Comfort
  microRewards: boolean
  noSurprises: boolean
  showPreview: boolean
  sound: boolean
}

export const DEFAULTS: UserPreferences = {
  darkMode: false,
  animations: true,
  readingOverlay: 'none',
  readingFont: 'atkinson',
  dyslexiaMode: false,
  autoTTS: false,
  ttsSpeed: 1,
  adaptiveTiming: false,
  manualFadeDuration: null,
  hintThreshold: 3,
  microRewards: true,
  noSurprises: false,
  showPreview: false,
  sound: true,
}

const STORAGE_KEY = 'repetium-preferences'

// ── Storage helpers ───────────────────────────────────────────────────────────

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new Event('repetium-prefs-changed'))
  } catch {}
}

// ── Body class applicator ────────────────────────────────────────────────────

const OVERLAY_CLASSES = ['overlay-yellow', 'overlay-blue', 'overlay-pink', 'overlay-green', 'overlay-peach'] as const

export function applyBodyClasses(prefs: UserPreferences): void {
  if (typeof document === 'undefined') return
  const b = document.body
  b.classList.toggle('dark', prefs.darkMode)
  b.classList.toggle('dyslexia', prefs.dyslexiaMode)
  b.classList.toggle('no-animations', !prefs.animations)
  b.classList.toggle('no-surprises', prefs.noSurprises)
  b.classList.toggle('font-opendyslexic', prefs.readingFont === 'opendyslexic')
  for (const cls of OVERLAY_CLASSES) {
    b.classList.remove(cls)
  }
  if (prefs.readingOverlay !== 'none') {
    b.classList.add(`overlay-${prefs.readingOverlay}`)
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface PreferencesContextValue {
  prefs: UserPreferences
  set: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  reset: () => void
}

import React from 'react'

export const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: DEFAULTS,
  set: () => {},
  reset: () => {},
})

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext)
}

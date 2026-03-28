'use client'

import { useState, useEffect, useCallback } from 'react'

export interface RecentExercise {
  key: string      // e.g. 'g1', 'g2'
  label: string    // human-readable name
  href: string     // e.g. '/exercises/g1'
  visitedAt: number // Date.now()
}

const STORAGE_KEY = 'repetium:recent_exercises'
const MAX_ENTRIES = 4

function readStorage(): RecentExercise[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecentExercise[]) : []
  } catch {
    return []
  }
}

function writeStorage(entries: RecentExercise[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

/** Read-only hook — returns the last MAX_ENTRIES exercises, most recent first */
export function useRecentExercises(): RecentExercise[] {
  const [recent, setRecent] = useState<RecentExercise[]>([])

  useEffect(() => {
    setRecent(readStorage())
  }, [])

  return recent
}

/** Call this once on mount inside an exercise page to record the visit */
export function useTrackExercise(key: string, label: string, href: string) {
  useEffect(() => {
    const prev = readStorage().filter((e) => e.key !== key)
    const next: RecentExercise[] = [
      { key, label, href, visitedAt: Date.now() },
      ...prev,
    ].slice(0, MAX_ENTRIES)
    writeStorage(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

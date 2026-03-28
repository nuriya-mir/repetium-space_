'use client'

import { useState, useEffect } from 'react'

export type TextFormat = 'normal' | 'adapted'

const STORAGE_KEY = 'rep_text_format'

export function useTextFormat() {
  const [format, setFormatState] = useState<TextFormat>('normal')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'normal' || saved === 'adapted') setFormatState(saved)
  }, [])

  function setFormat(f: TextFormat) {
    setFormatState(f)
    localStorage.setItem(STORAGE_KEY, f)
  }

  return { format, setFormat }
}

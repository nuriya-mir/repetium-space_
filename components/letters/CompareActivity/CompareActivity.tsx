'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './CompareActivity.module.css'

const Letter3D = dynamic(
  () => import('@/components/letters/Letter3D').then((m) => ({ default: m.Letter3D })),
  { ssr: false }
)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Diacritics stored as lowercase — displayed upper/lower based on caseMode
const DIACRITICS: string[] = ['à', 'â', 'æ', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ü', 'ÿ']

// Suggested confusable pairs — stored as uppercase keys (base) or lowercase (diacritics)
const SUGGESTED_PAIRS: { label: string; letters: string[] }[] = [
  { label: 'b / d', letters: ['B', 'D'] },
  { label: 'p / q', letters: ['P', 'Q'] },
  { label: 'm / n', letters: ['M', 'N'] },
  { label: 'n / u', letters: ['N', 'U'] },
]

const MAX_SELECTED = 4

type CaseMode = 'upper' | 'lower'

interface Props {
  onClose: () => void
}

function playTTS(text: string) {
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then((r) => r.json())
    .then(({ url }) => { if (url) new Audio(url).play() })
    .catch(() => {})
}

export function CompareActivity({ onClose }: Props) {
  const t = useT()
  const [chosen, setChosen] = useState<string[]>([])   // always uppercase keys
  const [caseMode, setCaseMode] = useState<CaseMode>('upper')
  const [comparing, setComparing] = useState(false)
  const [letterSize, setLetterSize] = useState(160)

  useEffect(() => {
    function updateSize() {
      setLetterSize(window.innerWidth < 480 ? 120 : 160)
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  function displayLetter(key: string) {
    // Base letters (uppercase key A-Z)
    if (/^[A-Z]$/.test(key)) return caseMode === 'lower' ? key.toLowerCase() : key
    // Diacritics (stored lowercase)
    return caseMode === 'upper' ? key.toUpperCase() : key
  }

  function toggleLetter(key: string) {
    setChosen((prev) => {
      if (prev.includes(key)) return prev.filter((l) => l !== key)
      if (prev.length >= MAX_SELECTED) return prev
      return [...prev, key]
    })
  }

  function applyPair(letters: string[]) {
    setChosen(letters)
  }

  function handleCaseSwitch(mode: CaseMode) {
    setCaseMode(mode)
    setChosen([])   // clear selection when switching case
  }

  function startCompare() {
    if (chosen.length >= 2) setComparing(true)
  }

  // ── Compare view ──────────────────────────────────────────────
  if (comparing) {
    return (
      <div className={styles.compareWrap}>
        <div className={styles.letterRow}>
          {chosen.map((key) => {
            const display = displayLetter(key)
            return (
              <div key={key} className={styles.letterSlot}>
                <Letter3D letter={display} size={letterSize} interactive />
                <button
                  className={styles.audioBtn}
                  onClick={() => playTTS(display)}
                  aria-label={display}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
                  </svg>
                  {display}
                </button>
              </div>
            )
          })}
        </div>

        <button
          className={styles.playAllBtn}
          onClick={() => playTTS(chosen.map(displayLetter).join(''))}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
          </svg>
          {chosen.map(displayLetter).join(' + ')}
        </button>

        <div className={styles.compareActions}>
          <Button variant="ghost" size="sm" onClick={() => setComparing(false)}>
            {t.letters.house1.compareEdit}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.letters.house1.close}
          </Button>
        </div>
      </div>
    )
  }

  // ── Selection view ────────────────────────────────────────────
  return (
    <div className={styles.selectWrap}>
      {/* Case toggle */}
      <div className={styles.caseToggle}>
        <button
          className={`${styles.caseBtn} ${caseMode === 'upper' ? styles.caseBtnActive : ''}`}
          onClick={() => handleCaseSwitch('upper')}
        >
          {t.letters.house1.compareUpper}
        </button>
        <button
          className={`${styles.caseBtn} ${caseMode === 'lower' ? styles.caseBtnActive : ''}`}
          onClick={() => handleCaseSwitch('lower')}
        >
          {t.letters.house1.compareLower}
        </button>
      </div>

      <p className={styles.hint}>{t.letters.house1.compareHint}</p>

      <div className={styles.suggestedPairs}>
        {SUGGESTED_PAIRS.map((pair) => {
          const label = caseMode === 'lower' ? pair.label : pair.label.toUpperCase()
          const isActive =
            chosen.length === pair.letters.length &&
            pair.letters.every((l) => chosen.includes(l))
          return (
            <button
              key={pair.label}
              className={`${styles.pairChip} ${isActive ? styles.pairChipActive : ''}`}
              onClick={() => applyPair(pair.letters)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className={styles.alphabetGrid}>
        {ALPHABET.map((key) => {
          const active = chosen.includes(key)
          const disabled = !active && chosen.length >= MAX_SELECTED
          return (
            <button
              key={key}
              className={`${styles.letterBtn} ${active ? styles.letterBtnActive : ''} ${disabled ? styles.letterBtnDisabled : ''}`}
              onClick={() => toggleLetter(key)}
              disabled={disabled}
              aria-pressed={active}
            >
              {displayLetter(key)}
            </button>
          )
        })}
      </div>

      <div className={styles.diacriticsSection}>
        <span className={styles.diacriticsLabel}>с диакритикой</span>
        <div className={styles.diacriticsGrid}>
          {DIACRITICS.map((key) => {
            const active = chosen.includes(key)
            const disabled = !active && chosen.length >= MAX_SELECTED
            return (
              <button
                key={key}
                className={`${styles.letterBtn} ${active ? styles.letterBtnActive : ''} ${disabled ? styles.letterBtnDisabled : ''}`}
                onClick={() => toggleLetter(key)}
                disabled={disabled}
                aria-pressed={active}
              >
                {displayLetter(key)}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.selectFooter}>
        <span className={styles.counter}>{chosen.length} / {MAX_SELECTED}</span>
        <Button
          variant="primary"
          size="sm"
          onClick={startCompare}
          disabled={chosen.length < 2}
        >
          {t.letters.house1.compareStart}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './CloseLettersActivity.module.css'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const WIDE = new Set(['M', 'W'])

function buildChoices(letter: string): string[] {
  const pool = ALPHABET.filter((l) => l !== letter)
  const picks: string[] = []
  const used = new Set<string>()
  while (picks.length < 3) {
    const p = pool[Math.floor(Math.random() * pool.length)]
    if (!used.has(p)) { used.add(p); picks.push(p) }
  }
  return shuffle([letter, ...picks])
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Phase = 'study' | 'recall'

interface Props {
  onClose: () => void
}

export function CloseLettersActivity({ onClose }: Props) {
  const t = useT()

  const [phase, setPhase] = useState<Phase>('study')
  const [uncovered, setUncovered] = useState<Set<string>>(new Set())
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [wrongChoice, setWrongChoice] = useState<string | null>(null)

  const allDone = uncovered.size === 26

  // ── Start recall phase ──────────────────────────────────────────────────────
  function handleClose() {
    setPhase('recall')
    setUncovered(new Set())
    setActiveCell(null)
  }

  // ── Cell click in recall phase ──────────────────────────────────────────────
  function handleCellClick(letter: string) {
    if (uncovered.has(letter)) return
    if (activeCell === letter) {
      setActiveCell(null)
      return
    }
    setActiveCell(letter)
    setChoices(buildChoices(letter))
    setWrongChoice(null)
  }

  // ── Choice answer ───────────────────────────────────────────────────────────
  function handleChoice(pick: string) {
    if (!activeCell) return
    if (pick === activeCell) {
      setUncovered((prev) => new Set([...prev, activeCell]))
      setActiveCell(null)
    } else {
      setWrongChoice(pick)
      setTimeout(() => setWrongChoice(null), 500)
    }
  }

  // ── Restart ─────────────────────────────────────────────────────────────────
  function handleRestart() {
    setPhase('study')
    setUncovered(new Set())
    setActiveCell(null)
    setWrongChoice(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <p className={styles.prompt}>
        {phase === 'study'
          ? t.letters.house1.closeLettersStudyPrompt
          : allDone
            ? t.letters.house1.closeLettersDone
            : t.letters.house1.closeLettersRecallPrompt}
      </p>

      {/* Counter in recall phase */}
      {phase === 'recall' && !allDone && (
        <span className={styles.counter}>{uncovered.size} / 26</span>
      )}

      {/* House grid */}
      <div className={styles.houseWrap}>
        <svg className={styles.roofSvg} viewBox="0 0 280 36" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="0,36 140,0 280,36" fill="var(--paper-e)" />
        </svg>
        <div className={styles.houseBody}>
          <div className={styles.grid}>
            {ALPHABET.map((letter) => {
              const wide = WIDE.has(letter)

              if (phase === 'study') {
                return (
                  <div
                    key={letter}
                    className={`${styles.cell} ${styles.cellVisible} ${wide ? styles.wide : ''}`}
                  >
                    <span className={styles.cellLetter}>{letter}</span>
                  </div>
                )
              }

              // Recall phase
              const isUncovered = uncovered.has(letter)
              const isActive = activeCell === letter

              if (isUncovered) {
                return (
                  <div
                    key={letter}
                    className={`${styles.cell} ${styles.cellPlaced} ${wide ? styles.wide : ''}`}
                  >
                    <span className={styles.cellLetterTeal}>{letter}</span>
                  </div>
                )
              }

              return (
                <div
                  key={letter}
                  className={`${styles.cell} ${styles.cellCovered} ${isActive ? styles.cellActive : ''} ${wide ? styles.wide : ''}`}
                  onClick={() => handleCellClick(letter)}
                >
                  <span className={styles.coverMark}>?</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Choice buttons — shown when a covered cell is active */}
      {phase === 'recall' && activeCell && !allDone && (
        <div className={styles.choices}>
          {choices.map((ch) => (
            <button
              key={ch}
              className={[
                styles.choiceBtn,
                wrongChoice === ch ? styles.choiceBtnWrong : '',
              ].join(' ')}
              onClick={() => handleChoice(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {phase === 'study' && (
        <Button variant="primary" size="sm" onClick={handleClose}>
          {t.letters.house1.closeLettersBtn}
        </Button>
      )}

      {allDone && (
        <Button variant="primary" size="sm" onClick={handleRestart}>
          {t.letters.house1.closeLettersAgain}
        </Button>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.closeLettersClose}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './AlphabetActivity.module.css'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const WIDE = new Set(['M', 'W'])

type Direction = 'forward' | 'backward'
type SlotState = 'empty' | 'correct' | 'wrong'

function getDistractors(letter: string): string[] {
  const idx = ALPHABET.indexOf(letter)
  const pool = ALPHABET.filter((l) => l !== letter)
  const nearby = pool.filter((l) => Math.abs(ALPHABET.indexOf(l) - idx) <= 4)
  const source = nearby.length >= 3 ? nearby : pool
  const result: string[] = []
  const used = new Set<string>()
  while (result.length < 3) {
    const pick = source[Math.floor(Math.random() * source.length)]
    if (!used.has(pick)) { used.add(pick); result.push(pick) }
  }
  return result
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Props {
  onClose: () => void
}

export function AlphabetActivity({ onClose }: Props) {
  const t = useT()
  const [direction, setDirection] = useState<Direction>('forward')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [doneSet, setDoneSet] = useState(new Set<number>())
  const [slotState, setSlotState] = useState<SlotState>('empty')
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[]>([])

  const allDone = doneSet.size === ALPHABET.length

  const letter = ALPHABET[currentIdx]

  const buildChoices = useCallback((ltr: string) => {
    return shuffle([ltr, ...getDistractors(ltr)])
  }, [])

  // Reset when direction changes
  function switchDirection(dir: Direction) {
    if (dir === direction) return
    setDirection(dir)
    setCurrentIdx(dir === 'forward' ? 0 : ALPHABET.length - 1)
    setDoneSet(new Set())
    setSlotState('empty')
    setWrongKey(null)
  }

  useEffect(() => {
    if (!allDone) setChoices(buildChoices(letter))
  }, [letter, allDone, buildChoices])

  function handleChoice(choice: string) {
    if (slotState === 'correct' || allDone) return
    if (choice === letter) {
      setSlotState('correct')
      setTimeout(() => {
        setDoneSet((prev) => new Set(prev).add(currentIdx))
        const nextIdx = direction === 'forward' ? currentIdx + 1 : currentIdx - 1
        const isLast = direction === 'forward'
          ? currentIdx === ALPHABET.length - 1
          : currentIdx === 0
        if (!isLast) {
          setCurrentIdx(nextIdx)
          setSlotState('empty')
        } else {
          // Mark last letter done and show completion
          setSlotState('empty')
        }
      }, 600)
    } else {
      setWrongKey(choice)
      setSlotState('wrong')
      setTimeout(() => {
        setWrongKey(null)
        setSlotState('empty')
      }, 500)
    }
  }

  // Determine cell state for grid display
  function cellStatus(idx: number): 'done' | 'current' | 'upcoming' {
    if (doneSet.has(idx)) return 'done'
    if (idx === currentIdx && !allDone) return 'current'
    return 'upcoming'
  }

  return (
    <div className={styles.wrap}>
      {/* Direction toggle */}
      <div className={styles.dirToggle}>
        <button
          className={`${styles.dirBtn} ${direction === 'forward' ? styles.dirBtnActive : ''}`}
          onClick={() => switchDirection('forward')}
        >
          A → Z
        </button>
        <button
          className={`${styles.dirBtn} ${direction === 'backward' ? styles.dirBtnActive : ''}`}
          onClick={() => switchDirection('backward')}
        >
          Z → A
        </button>
      </div>

      {/* House grid (progress tracker) */}
      <div className={styles.houseWrap}>
        <svg
          className={styles.roofSvg}
          viewBox="0 0 280 36"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points="0,36 140,0 280,36" fill="var(--paper-e)" />
        </svg>
        <div className={styles.houseBody}>
          <div className={styles.grid}>
            {ALPHABET.map((l, idx) => {
              const status = cellStatus(idx)
              return (
                <div
                  key={l}
                  className={`${styles.cell} ${styles[status]} ${WIDE.has(l) ? styles.wide : ''}`}
                  aria-current={status === 'current' ? 'true' : undefined}
                >
                  {l}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Choices or completion */}
      {allDone ? (
        <div className={styles.completionWrap}>
          <p className={styles.completionText}>{t.letters.house1.alphabetDone}</p>
          <Button variant="primary" size="sm" onClick={() => switchDirection(direction)}>
            {t.letters.house1.alphabetRestart}
          </Button>
        </div>
      ) : (
        <>
          <p className={styles.prompt}>{t.letters.house1.alphabetPrompt} «{letter}»</p>
          <div className={styles.choices}>
            {choices.map((ch) => (
              <button
                key={ch}
                className={`${styles.choiceBtn}
                  ${wrongKey === ch ? styles.choiceBtnWrong : ''}
                  ${slotState === 'correct' && ch === letter ? styles.choiceBtnCorrect : ''}`}
                onClick={() => handleChoice(ch)}
                disabled={slotState === 'correct'}
              >
                {ch}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Always visible close */}
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.alphabetClose}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './NeighborsActivity.module.css'

const Letter3D = dynamic(
  () => import('@/components/letters/Letter3D').then((m) => ({ default: m.Letter3D })),
  { ssr: false }
)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Returns 2 distractor letters that are not prev or next
function getDistractors(letter: string, prev: string | null, next: string | null): string[] {
  const idx = ALPHABET.indexOf(letter)
  const exclude = new Set([letter, prev, next].filter(Boolean) as string[])
  const pool = ALPHABET.filter((l) => !exclude.has(l))
  // Prefer letters near the center letter for plausibility
  const nearby = pool.filter((l) => Math.abs(ALPHABET.indexOf(l) - idx) <= 5)
  const source = nearby.length >= 2 ? nearby : pool
  const result: string[] = []
  const used = new Set<string>()
  while (result.length < 2) {
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

type SlotState = 'empty' | 'correct' | 'wrong'

interface Props {
  onClose: () => void
}

export function NeighborsActivity({ onClose }: Props) {
  const t = useT()

  const [letterIdx, setLetterIdx] = useState(() => Math.floor(Math.random() * ALPHABET.length))
  const [phase, setPhase] = useState<'before' | 'after'>('before')
  const [choices, setChoices] = useState<string[]>([])
  const [beforeState, setBeforeState] = useState<SlotState>('empty')
  const [afterState, setAfterState] = useState<SlotState>('empty')
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [letterSize, setLetterSize] = useState(140)

  const letter = ALPHABET[letterIdx]
  const prev = letterIdx > 0 ? ALPHABET[letterIdx - 1] : null
  const next = letterIdx < ALPHABET.length - 1 ? ALPHABET[letterIdx + 1] : null

  const buildChoices = useCallback((ltr: string, p: string | null, n: string | null, ph: 'before' | 'after') => {
    const correct = ph === 'before' ? p : n
    if (!correct) return []
    const distractors = getDistractors(ltr, p, n)
    return shuffle([correct, ...distractors])
  }, [])

  useEffect(() => {
    setChoices(buildChoices(letter, prev, next, phase))
  }, [letter, prev, next, phase, buildChoices])

  useEffect(() => {
    function onResize() { setLetterSize(window.innerWidth < 480 ? 100 : 140) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleChoice(choice: string) {
    const correct = phase === 'before' ? prev : next
    if (choice === correct) {
      if (phase === 'before') {
        setBeforeState('correct')
        // Move to 'after' phase (skip if no next letter)
        if (next) {
          setPhase('after')
        }
      } else {
        setAfterState('correct')
      }
    } else {
      setWrongKey(choice)
      setTimeout(() => setWrongKey(null), 500)
      if (phase === 'before') setBeforeState('wrong')
      else setAfterState('wrong')
      setTimeout(() => {
        if (phase === 'before') setBeforeState('empty')
        else setAfterState('empty')
      }, 500)
    }
  }

  function handleNext() {
    const nextIdx = (letterIdx + 1) % ALPHABET.length
    setLetterIdx(nextIdx)
    setPhase('before')
    setBeforeState('empty')
    setAfterState('empty')
    setWrongKey(null)
  }

  const bothDone = beforeState === 'correct' && (afterState === 'correct' || !next)
  const prevDone = beforeState === 'correct'

  const prompt = phase === 'before'
    ? `${t.letters.house1.neighborsPromptBefore} ${letter}?`
    : `${t.letters.house1.neighborsPromptAfter} ${letter}?`

  // If this letter has no prev, skip before phase on mount
  useEffect(() => {
    if (!prev) {
      setBeforeState('correct')
      setPhase('after')
    }
  }, [letter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.wrap}>
      {/* Neighbor slots + center letter */}
      <div className={styles.row}>
        {/* Before slot */}
        <div className={`${styles.slot} ${beforeState === 'correct' ? styles.slotCorrect : beforeState === 'wrong' ? styles.slotWrong : ''}`}>
          {beforeState === 'correct' && prev ? (
            <span className={styles.slotLetter}>{prev}</span>
          ) : (
            <span className={styles.slotQ}>?</span>
          )}
        </div>

        {/* Center letter */}
        <div className={styles.center}>
          <Letter3D letter={letter} size={letterSize} interactive={false} />
        </div>

        {/* After slot */}
        <div className={`${styles.slot} ${afterState === 'correct' ? styles.slotCorrect : afterState === 'wrong' ? styles.slotWrong : ''}`}>
          {afterState === 'correct' && next ? (
            <span className={styles.slotLetter}>{next}</span>
          ) : next ? (
            <span className={styles.slotQ}>?</span>
          ) : (
            <span className={styles.slotEnd}>—</span>
          )}
        </div>
      </div>

      {/* Prompt */}
      {!bothDone && (
        <p className={styles.prompt}>{prompt}</p>
      )}

      {/* Choice buttons */}
      {!bothDone && choices.length > 0 && (
        <div className={styles.choices}>
          {choices.map((ch) => (
            <button
              key={ch}
              className={`${styles.choiceBtn} ${wrongKey === ch ? styles.choiceBtnWrong : ''} ${
                (phase === 'before' && beforeState === 'correct' && ch === prev) ||
                (phase === 'after' && afterState === 'correct' && ch === next)
                  ? styles.choiceBtnCorrect
                  : ''
              }`}
              onClick={() => handleChoice(ch)}
              disabled={
                (phase === 'before' && beforeState === 'correct') ||
                (phase === 'after' && afterState === 'correct')
              }
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {bothDone ? (
          <Button variant="primary" size="sm" onClick={handleNext}>
            {t.letters.house1.neighborsNext}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.neighborsClose}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './BetweenActivity.module.css'

const Letter3D = dynamic(
  () => import('@/components/letters/Letter3D').then((m) => ({ default: m.Letter3D })),
  { ssr: false }
)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
// Only letters B–Y have both a prev and next
const ELIGIBLE_INDICES = Array.from({ length: 24 }, (_, i) => i + 1)

function getDistractors(letter: string, left: string, right: string): string[] {
  const idx = ALPHABET.indexOf(letter)
  const exclude = new Set([letter, left, right])
  const pool = ALPHABET.filter((l) => !exclude.has(l))
  const nearby = pool.filter((l) => Math.abs(ALPHABET.indexOf(l) - idx) <= 5)
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

type SlotState = 'empty' | 'correct' | 'wrong'

interface Props {
  onClose: () => void
}

export function BetweenActivity({ onClose }: Props) {
  const t = useT()

  const [letterIdx, setLetterIdx] = useState(
    () => ELIGIBLE_INDICES[Math.floor(Math.random() * ELIGIBLE_INDICES.length)]
  )
  const [slotState, setSlotState] = useState<SlotState>('empty')
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [letterSize, setLetterSize] = useState(120)

  const letter = ALPHABET[letterIdx]
  const left   = ALPHABET[letterIdx - 1]
  const right  = ALPHABET[letterIdx + 1]

  const buildChoices = useCallback((ltr: string, l: string, r: string) => {
    return shuffle([ltr, ...getDistractors(ltr, l, r)])
  }, [])

  useEffect(() => {
    setChoices(buildChoices(letter, left, right))
  }, [letter, left, right, buildChoices])

  useEffect(() => {
    function onResize() { setLetterSize(window.innerWidth < 480 ? 88 : 120) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleChoice(choice: string) {
    if (slotState === 'correct') return
    if (choice === letter) {
      setSlotState('correct')
    } else {
      setWrongKey(choice)
      setSlotState('wrong')
      setTimeout(() => {
        setWrongKey(null)
        setSlotState('empty')
      }, 500)
    }
  }

  function handleNext() {
    let newIdx: number
    do {
      newIdx = ELIGIBLE_INDICES[Math.floor(Math.random() * ELIGIBLE_INDICES.length)]
    } while (newIdx === letterIdx)
    setLetterIdx(newIdx)
    setSlotState('empty')
    setWrongKey(null)
  }

  const done = slotState === 'correct'

  return (
    <div className={styles.wrap}>
      <p className={styles.prompt}>{t.letters.house1.betweenPrompt}</p>

      {/* Flanking letters with ? slot in the middle */}
      <div className={styles.row}>
        <div className={styles.flanker}>
          <Letter3D letter={left} size={letterSize} interactive={false} />
        </div>

        <div className={`${styles.slot} ${slotState === 'correct' ? styles.slotCorrect : slotState === 'wrong' ? styles.slotWrong : ''}`}>
          {done ? (
            <span className={styles.slotLetter}>{letter}</span>
          ) : (
            <span className={styles.slotQ}>?</span>
          )}
        </div>

        <div className={styles.flanker}>
          <Letter3D letter={right} size={letterSize} interactive={false} />
        </div>
      </div>

      {/* Choice buttons */}
      {!done && (
        <div className={styles.choices}>
          {choices.map((ch) => (
            <button
              key={ch}
              className={`${styles.choiceBtn} ${wrongKey === ch ? styles.choiceBtnWrong : ''}`}
              onClick={() => handleChoice(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {done && (
          <Button variant="primary" size="sm" onClick={handleNext}>
            {t.letters.house1.betweenNext}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.betweenClose}
        </Button>
      </div>
    </div>
  )
}

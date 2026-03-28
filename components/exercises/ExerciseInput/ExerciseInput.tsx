'use client'

import { useState, useRef, useEffect } from 'react'
import type { FeedbackState } from '@/types'
import styles from './ExerciseInput.module.css'

interface ExerciseInputProps {
  expected: string
  label?: string
  onCorrect?: () => void
  onAttempt?: (value: string) => void
  autoFocus?: boolean
}

export function ExerciseInput({ expected, label, onCorrect, onAttempt, autoFocus = true }: ExerciseInputProps) {
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value
    setValue(input)
    onAttempt?.(input)

    if (input.toLowerCase() === expected.toLowerCase()) {
      setFeedback('correct')
      onCorrect?.()
    } else if (input.length >= expected.length) {
      setFeedback('try-again')
      // Reset after flicker
      setTimeout(() => {
        setFeedback('idle')
        setValue('')
        inputRef.current?.focus()
      }, 800)
    } else {
      setFeedback('idle')
    }
  }

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        className={`${styles.input} ${styles[feedback]}`}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        lang="fr"
      />
      {feedback === 'correct' && (
        <span className={styles.feedbackIcon} aria-label="Верно">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </div>
  )
}

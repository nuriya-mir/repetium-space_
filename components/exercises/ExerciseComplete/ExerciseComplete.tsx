'use client'

import { Button } from '@/components/ui/Button'
import styles from './ExerciseComplete.module.css'

interface ExerciseCompleteProps {
  onContinue: () => void
  onReturnHome?: () => void
}

export function ExerciseComplete({ onContinue, onReturnHome }: ExerciseCompleteProps) {
  return (
    <div className={styles.container}>
      <div className={styles.icon} aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="var(--teal)" strokeWidth="2" fill="var(--teal-dim)" />
          <path d="M15 24l6 6 12-12" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 className={styles.title}>Отлично</h2>
      <p className={styles.message}>
        Вы поработали с восприятием. Каждый такой шаг укрепляет связи.
      </p>

      <div className={styles.actions}>
        <Button variant="primary" onClick={onContinue}>
          Продолжить
        </Button>
        {onReturnHome && (
          <Button variant="ghost" onClick={onReturnHome}>
            На главную
          </Button>
        )}
      </div>
    </div>
  )
}

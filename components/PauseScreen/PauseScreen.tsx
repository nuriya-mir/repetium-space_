'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import styles from './PauseScreen.module.css'

interface PauseScreenProps {
  /** Number of tasks completed so far — shown in the pause message */
  tasksCompleted?: number
  /** Called when user clicks "Continue" */
  onContinue?: () => void
  /** Where to navigate on "End session". Defaults to /exercises */
  exitHref?: string
}

export function PauseScreen({ tasksCompleted = 0, onContinue, exitHref = '/exercises' }: PauseScreenProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useT()

  function handleContinue() {
    setOpen(false)
    onContinue?.()
  }

  function handleExit() {
    setOpen(false)
    router.push(exitHref)
  }

  return (
    <>
      <button
        className={styles.pauseBtn}
        onClick={() => setOpen(true)}
        aria-label={t.exercises.pauseLabel}
        title={t.exercises.pauseLabel}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="2" width="4" height="12" rx="1.5" fill="currentColor" />
          <rect x="9" y="2" width="4" height="12" rx="1.5" fill="currentColor" />
        </svg>
        <span>{t.exercises.pauseLabel}</span>
      </button>

      {open && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t.exercises.pauseTitle}>
          <div className={styles.card}>
            <p className={styles.title}>{t.exercises.pauseTitle}</p>
            <p className={styles.sub}>
              {tasksCompleted > 0
                ? t.exercises.pauseSub.replace('{n}', String(tasksCompleted))
                : t.exercises.pauseSubZero}
            </p>
            <div className={styles.actions}>
              <button className={styles.continueBtn} onClick={handleContinue}>
                {t.exercises.pauseContinue}
              </button>
              <button className={styles.exitBtn} onClick={handleExit}>
                {t.exercises.pauseExit}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

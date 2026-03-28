'use client'

import { useState, useEffect } from 'react'
import styles from './ExerciseText.module.css'

interface HighlightRange {
  start: number
  end: number
  level: 1 | 2 | 3 | 4
}

interface ExerciseTextProps {
  text: string
  highlights: HighlightRange[]
  phase: 'show' | 'fade' | 'recall'
  onPlayAudio?: () => void
}

export function ExerciseText({ text, highlights, phase, onPlayAudio }: ExerciseTextProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (phase === 'fade') {
      const timer = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(timer)
    }
    setVisible(phase === 'show')
  }, [phase])

  function renderText() {
    if (!highlights.length) {
      return <span className="fr-text">{text}</span>
    }

    const parts: React.ReactElement[] = []
    let lastIdx = 0

    const sorted = [...highlights].sort((a, b) => a.start - b.start)

    sorted.forEach((hl, i) => {
      if (hl.start > lastIdx) {
        parts.push(
          <span key={`text-${i}`} className="fr-text">
            {text.slice(lastIdx, hl.start)}
          </span>
        )
      }
      parts.push(
        <span
          key={`hl-${i}`}
          className={`${styles.highlight} ${styles[`hl${hl.level}`]} ${phase === 'recall' ? styles.hidden : ''}`}
        >
          {text.slice(hl.start, hl.end)}
        </span>
      )
      lastIdx = hl.end
    })

    if (lastIdx < text.length) {
      parts.push(
        <span key="text-end" className="fr-text">
          {text.slice(lastIdx)}
        </span>
      )
    }

    return parts
  }

  return (
    <div className={`${styles.container} ${!visible ? styles.fadeOut : ''}`}>
      <div className={styles.textBlock}>
        {renderText()}
      </div>
      {onPlayAudio && (
        <button className={styles.audioBtn} onClick={onPlayAudio} aria-label="Озвучить" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

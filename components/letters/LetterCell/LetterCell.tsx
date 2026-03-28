'use client'

import { LetterCell as LetterCellType } from '@/types'
import styles from './LetterCell.module.css'

interface LetterCellProps {
  cell: LetterCellType
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  showDiacriticDot?: boolean
}

export function LetterCell({ cell, onClick, size = 'md', showDiacriticDot = true }: LetterCellProps) {
  return (
    <button
      className={`${styles.cell} ${styles[cell.status]} ${styles[size]}`}
      onClick={onClick}
      aria-label={`${cell.letter}${cell.diacritics.length > 0 ? ', со значками' : ''}`}
    >
      <span className={styles.letter}>{cell.letter}</span>
      {showDiacriticDot && cell.diacritics.length > 0 && (
        <span className={styles.dot} aria-hidden="true" />
      )}
    </button>
  )
}

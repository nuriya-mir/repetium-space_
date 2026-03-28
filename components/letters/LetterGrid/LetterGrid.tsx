'use client'

import { LetterCell } from '@/types'
import styles from './LetterGrid.module.css'

// French diacritics per base letter
const DIACRITICS: Record<string, string[]> = {
  A: ['à', 'â', 'æ'],
  C: ['ç'],
  E: ['é', 'è', 'ê', 'ë'],
  I: ['î', 'ï'],
  O: ['ô', 'œ'],
  U: ['ù', 'û', 'ü'],
  Y: ['ÿ'],
}

// M and W are "wide residents" — they get double-width cells (grid-column: span 2)
// Grid layout: 7 columns × 4 rows = 28 column-slots for 26 letters
// Row 1: A B C D E F G          (7 × 1-col = 7)
// Row 2: H I J K L M(wide)      (5 × 1-col + 1 × 2-col = 7)
// Row 3: N O P Q R S T          (7 × 1-col = 7)
// Row 4: U V W(wide) X Y Z      (2 × 1-col + 1 × 2-col + 3 × 1-col = 7)
const WIDE_LETTERS = new Set(['M', 'W'])

interface LetterGridProps {
  cells: LetterCell[]
  onLetterClick?: (cell: LetterCell) => void
}

export function LetterGrid({ cells, onLetterClick }: LetterGridProps) {
  return (
    <div className={styles.houseWrap}>
      <svg
        className={styles.roofSvg}
        viewBox="0 0 280 36"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon points="0,36 140,0 280,36" style={{ fill: 'var(--blue-dim)' }} />
      </svg>
      <div className={styles.houseBody}>
        <div className={styles.grid} role="list" aria-label="Французский алфавит">
          {cells.map((cell) => {
            const isWide = WIDE_LETTERS.has(cell.letter)
            const diacritics = DIACRITICS[cell.letter] ?? []

            return (
              <button
                key={cell.letter}
                className={`${styles.cell} ${styles[cell.status]} ${isWide ? styles.wide : ''}`}
                onClick={() => onLetterClick?.(cell)}
                role="listitem"
                aria-label={`${cell.letter}${diacritics.length > 0 ? ', со значками' : ''}`}
              >
                <span className={styles.letter}>{cell.letter}</span>
                {diacritics.length > 0 && (
                  <span className={styles.diacriticDot} aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

'use client'

import styles from './DiacriticPopover.module.css'

interface DiacriticPopoverProps {
  letter: string
  diacritics: string[]
  onSelect?: (diacritic: string) => void
  onClose: () => void
}

export function DiacriticPopover({ letter, diacritics, onSelect, onClose }: DiacriticPopoverProps) {
  if (diacritics.length === 0) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.baseLetter}>{letter}</span>
        </div>
        <div className={styles.grid}>
          {diacritics.map((d) => (
            <button
              key={d}
              className={styles.chip}
              onClick={() => onSelect?.(d)}
              aria-label={d}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

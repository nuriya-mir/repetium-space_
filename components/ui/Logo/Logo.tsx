// Repetium Logo · Mark: geometric lowercase r, single stroke.
// Wordmark: Outfit 300, color var(--blue), ".space" at opacity 0.60.

import styles from './Logo.module.css'

const MARK_PATH = 'M 14 54 L 14 18 C 14 6 46 6 46 24'
const VIEWBOX_W = 52
const VIEWBOX_H = 60

interface Props {
  /** Height of the SVG mark in px. Width is computed proportionally. */
  markHeight?: number
  /** Font-size of the wordmark text in px. */
  wordmarkSize?: number
  /** Layout variant */
  layout?: 'horizontal' | 'stack' | 'mark' | 'wordmark'
  className?: string
}

export function Logo({
  markHeight = 24,
  wordmarkSize,
  layout = 'horizontal',
  className,
}: Props) {
  const markW = Math.round(markHeight * VIEWBOX_W / VIEWBOX_H)
  const fontSize = wordmarkSize ?? Math.round(markHeight * 0.60)

  const mark = (
    <svg
      width={markW}
      height={markHeight}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={MARK_PATH} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )

  const wordmark = (
    <span className={styles.wordmark} style={{ fontSize }}>
      repetium<span className={styles.dotSpace}>.space</span>
    </span>
  )

  if (layout === 'mark')     return <span className={`${styles.root} ${className ?? ''}`}>{mark}</span>
  if (layout === 'wordmark') return <span className={`${styles.root} ${className ?? ''}`}>{wordmark}</span>

  return (
    <span
      className={`${styles.root} ${layout === 'stack' ? styles.stack : styles.horizontal} ${className ?? ''}`}
    >
      {mark}
      {wordmark}
    </span>
  )
}

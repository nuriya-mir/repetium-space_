'use client'

import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  variant?: 'default' | 'teal' | 'gold'
  size?: 'sm' | 'md'
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  variant = 'default',
  size = 'md',
}: ProgressBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={styles.wrapper}>
      {(label || showValue) && (
        <div className={styles.meta}>
          {label && <span className={styles.label}>{label}</span>}
          {showValue && <span className={styles.value}>{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        className={`${styles.track} ${styles[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={`${styles.fill} ${styles[variant]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

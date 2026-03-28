'use client'

import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.disabled : ''}`}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`${styles.track} ${checked ? styles.on : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        type="button"
      >
        <span className={styles.thumb} />
      </button>
    </label>
  )
}

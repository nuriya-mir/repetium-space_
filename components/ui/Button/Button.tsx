'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'fb-ok' | 'fb-try' | 'fb-done' | 'skip' | 'icon'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, loading, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          styles.button,
          styles[variant],
          styles[size],
          fullWidth ? styles.fullWidth : '',
          loading ? styles.loading : '',
          className,
        ].filter(Boolean).join(' ')}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className={styles.spinner} aria-hidden="true" />}
        <span className={loading ? styles.hiddenText : ''}>{children}</span>
      </button>
    )
  }
)

Button.displayName = 'Button'

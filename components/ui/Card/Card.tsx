import { HTMLAttributes, forwardRef } from 'react'
import styles from './Card.module.css'

type CardVariant = 'default' | 'elevated' | 'interactive' | 'accent'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'sm' | 'md' | 'lg'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          styles.card,
          styles[variant],
          styles[`pad-${padding}`],
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

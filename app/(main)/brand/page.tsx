'use client'

import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import styles from './page.module.css'

export default function BrandPage() {
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.mark}>
          <Logo layout="mark" markHeight={120} />
        </div>
        <div className={styles.wordmark}>
          <Logo layout="wordmark" wordmarkSize={32} />
        </div>
        <p className={styles.tagline}>Повторение создаёт пространство</p>
      </div>

      <Link href="/" className={styles.back} aria-label="На лендинг">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </Link>
    </div>
  )
}

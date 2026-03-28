'use client'

import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

export default function AboutPage() {
  const t = useT()

  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.hero}>
        <Logo markHeight={80} wordmarkSize={36} layout="stack" />
        <p className={styles.tagline}>{t.about.tagline}</p>
      </div>

      {/* What */}
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{t.about.what}</h2>
        <p className={styles.blockText}>{t.about.whatDesc}</p>
      </section>

      {/* How */}
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{t.about.how}</h2>
        <p className={styles.blockText}>{t.about.howDesc}</p>
      </section>

      {/* Method */}
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{t.about.method}</h2>
        <div className={styles.methodGrid}>
          <div className={styles.methodItem}>
            <span className={styles.methodName}>{t.about.m1}</span>
            <span className={styles.methodDesc}>{t.about.m1desc}</span>
          </div>
          <div className={styles.methodItem}>
            <span className={styles.methodName}>{t.about.m2}</span>
            <span className={styles.methodDesc}>{t.about.m2desc}</span>
          </div>
          <div className={styles.methodItem}>
            <span className={styles.methodName}>{t.about.m3}</span>
            <span className={styles.methodDesc}>{t.about.m3desc}</span>
          </div>
        </div>
      </section>

      {/* Quote */}
      <blockquote className={styles.quote}>{t.about.quote}</blockquote>

      {/* CTA */}
      <Link href="/home" style={{ textDecoration: 'none' }}>
        <Button variant="primary">{t.about.start}</Button>
      </Link>

    </div>
  )
}

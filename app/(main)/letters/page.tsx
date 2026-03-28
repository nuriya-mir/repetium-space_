'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const MINI_WIDE = new Set(['M', 'W'])

const IPA_SOUNDS = [
  '[a]','[e]','[ɛ]','[i]','[o]','[ɔ]','[u]',
  '[y]','[ø]','[œ]','[ə]','[ã]','[ɔ̃]','[ɛ̃]',
  '[œ̃]','[j]','[w]','[ɥ]','[b]','[d]','[f]',
  '[g]','[k]','[l]','[m]','[n]','[p]','[ʁ]',
  '[s]','[t]','[v]','[z]','[ʃ]','[ʒ]','[ɲ]',
]

function MiniHouseGrid({ items, variant }: { items: string[]; variant: 'blue' | 'gold' | 'teal' }) {
  const roofFill =
    variant === 'gold' ? 'rgba(200,148,42,0.15)' :
    variant === 'teal' ? 'rgba(58,158,152,0.12)' :
    'rgba(58,110,160,0.10)'

  return (
    <div className={styles.miniHouse}>
      <svg className={styles.miniRoof} viewBox="0 0 280 28" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="0,28 140,0 280,28" fill={roofFill} />
      </svg>
      <div className={`${styles.miniBody} ${styles[variant]}`}>
        <div className={`${styles.miniGrid} ${variant === 'teal' ? styles.ipaGrid : ''}`}>
          {items.map((item, i) => (
            <span
              key={i}
              className={styles.miniCell}
              style={MINI_WIDE.has(item) ? { gridColumn: 'span 2', aspectRatio: 'auto' } : undefined}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LettersOverviewPage() {
  const t = useT()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t.nav.letters}</h1>

      <div className={styles.cardsRow}>
        <Link href="/letters/house-1" className={`${styles.card} ${styles.cardBlue}`}>
          <MiniHouseGrid items={ALPHABET} variant="blue" />
          <div className={styles.cardInfo}>
            <span className={styles.cardName}>{t.letters.house1.title}</span>
            <span className={styles.cardDesc}>{t.letters.house1.desc}</span>
            <span className={styles.cardCount}>26</span>
          </div>
        </Link>

        <Link href="/letters/house-2" className={`${styles.card} ${styles.cardGold}`}>
          <MiniHouseGrid items={ALPHABET} variant="gold" />
          <div className={styles.cardInfo}>
            <span className={styles.cardName}>{t.letters.house2.title}</span>
            <span className={styles.cardDesc}>{t.letters.house2.desc}</span>
            <span className={styles.cardCount}>26</span>
          </div>
        </Link>

        <Link href="/letters/house-3" className={`${styles.card} ${styles.cardTeal}`}>
          <MiniHouseGrid items={IPA_SOUNDS} variant="teal" />
          <div className={styles.cardInfo}>
            <span className={styles.cardName}>{t.letters.house3.title}</span>
            <span className={styles.cardDesc}>{t.letters.house3.desc}</span>
            <span className={styles.cardCount}>35</span>
          </div>
        </Link>
      </div>
    </div>
  )
}

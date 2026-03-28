'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { useRecentExercises } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

function getGreeting(t: ReturnType<typeof useT>): string {
  const h = new Date().getHours()
  if (h < 6) return t.home.greetings.night
  if (h < 12) return t.home.greetings.morning
  if (h < 18) return t.home.greetings.day
  return t.home.greetings.evening
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const MINI_WIDE = new Set(['M', 'W'])

const ROOF_STROKE: Record<string, string> = {
  default: 'var(--blue-line)',
  gold:    'rgba(200,148,42,0.35)',
  ipa:     'rgba(58,126,90,0.35)',
}

function MiniHouseGrid({ letters, variant = 'default', isSilhouette = false }: { letters: string[]; variant?: 'default' | 'gold' | 'ipa', isSilhouette?: boolean }) {
  const stroke = ROOF_STROKE[variant]
  return (
    <div className={styles.miniHouse}>
      <svg className={styles.miniRoof} viewBox="0 0 280 36" preserveAspectRatio="none" aria-hidden="true">
        <polygon
          points="0,36 140,0 280,36"
          style={{
            fill: variant === 'gold' ? 'rgba(200,148,42,0.12)' :
                  variant === 'ipa'  ? 'var(--teal-dim)'       :
                  'var(--blue-dim)'
          }}
        />
        {/* Roof outline — only the two slanted sides, not the bottom */}
        <path
          d="M0,36 L140,0 L280,36"
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className={styles.miniHouseBody}>
        <div className={`${styles.miniHouseGrid} ${variant === 'ipa' ? styles.miniIpa : ''}`}>
          {letters.map((l, i) => (
            <span
              key={i}
              className={`${styles.miniCell} ${isSilhouette ? styles.silhouette : ''}`}
              style={MINI_WIDE.has(l) ? { gridColumn: 'span 2', aspectRatio: 'auto' } : undefined}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const IPA_SOUNDS = [
  '[a]','[e]','[ɛ]','[i]','[o]','[ɔ]','[u]',
  '[y]','[ø]','[œ]','[ə]','[ã]','[ɔ̃]','[ɛ̃]',
  '[œ̃]','[j]','[w]','[ɥ]','[b]','[d]','[f]',
  '[g]','[k]','[l]','[m]','[n]','[p]','[ʁ]',
  '[s]','[t]','[v]','[z]','[ʃ]','[ʒ]','[ɲ]',
]

export default function HomePage() {
  const t = useT()
  const recentExercises = useRecentExercises()

  return (
    <div className={styles.page}>
      {/* Greeting */}
      <div className={styles.greeting}>
        <span className={styles.greetingTime}>{getGreeting(t)}</span>
        <h1 className={styles.greetingText}>{t.home.continueQ}</h1>
      </div>

      {/* Houses grid */}
      <section>
        <div className={styles.housesGrid}>
          <Link href="/letters/house-1" className={`${styles.houseCard} ${styles.zone1}`}>
            <span className={styles.houseName}>{t.home.letters.house1}</span>
            <MiniHouseGrid letters={ALPHABET} />
            <div className={styles.houseProgress}>
              <div className={styles.houseBar}>
                <div className={styles.houseBarFill} style={{ width: '0%' }} />
              </div>
              <span className={styles.houseCount}>0/26</span>
            </div>
          </Link>

          <Link href="/letters/house-2" className={`${styles.houseCard} ${styles.zone2}`}>
            <span className={styles.houseName}>{t.home.letters.house2}</span>
            <MiniHouseGrid letters={ALPHABET} variant="gold" isSilhouette />
            <div className={styles.houseProgress}>
              <div className={styles.houseBar}>
                <div className={`${styles.houseBarFill} ${styles.gold}`} style={{ width: '0%' }} />
              </div>
              <span className={styles.houseCount}>0/26</span>
            </div>
          </Link>

          <Link href="/letters/house-3" className={`${styles.houseCard} ${styles.zone3}`}>
            <span className={styles.houseName}>{t.home.letters.house3}</span>
            <MiniHouseGrid letters={IPA_SOUNDS} variant="ipa" />
            <div className={styles.houseProgress}>
              <div className={styles.houseBar}>
                <div className={`${styles.houseBarFill} ${styles.teal}`} style={{ width: '0%' }} />
              </div>
              <span className={styles.houseCount}>0/35</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Exercises */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t.home.exercises.section}</h2>
          <Link href="/exercises" className={styles.sectionLink}>{t.home.exercises.all}</Link>
        </div>
        <div className={styles.chipRow}>
          {recentExercises.length === 0 ? (
            <>
              <Link href="/exercises/g1" className={styles.chip}>
                <span className={styles.chipLabel}>{t.home.exercises.g1label}</span>
                <span className={styles.chipStatus}>{t.home.exercises.start}</span>
              </Link>
              <Link href="/exercises/g2" className={styles.chip}>
                <span className={styles.chipLabel}>{t.home.exercises.g2label}</span>
                <span className={styles.chipStatus}>{t.home.exercises.start}</span>
              </Link>
            </>
          ) : (
            recentExercises.map((ex) => (
              <Link key={ex.key} href={ex.href} className={styles.chip}>
                <span className={styles.chipLabel}>{ex.label}</span>
                <span className={styles.chipStatus}>{t.home.exercises.continue}</span>
              </Link>
            ))
          )}
        </div>
      </section>

    </div>
  )
}

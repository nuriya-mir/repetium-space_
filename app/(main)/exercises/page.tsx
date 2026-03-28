'use client'

import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

export default function ExercisesPage() {
  const router = useRouter()
  const t = useT()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.exercises.title}</h1>
        <p className={styles.desc}>{t.exercises.desc}</p>
      </div>

      <div className={styles.cards}>
        <button className={styles.card} onClick={() => router.push('/exercises/g1')}>
          {t.exercises.g1name}
        </button>

        <button className={styles.card} onClick={() => router.push('/exercises/g2')}>
          {t.exercises.g2name}
        </button>

        <button className={styles.card} onClick={() => router.push('/exercises/g3')}>
          {t.exercises.g3name}
        </button>

        {t.exercises.dimGroups.map((name) =>
          name === t.exercises.g4name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g4')}>
              {name}
            </button>
          ) : name === t.exercises.g9name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g9')}>
              {name}
            </button>
          ) : name === t.exercises.g6name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g6')}>
              {name}
            </button>
          ) : name === t.exercises.g7name || name === t.exercises.dimGroups[3] ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g7')}>
              {name}
            </button>
          ) : name === t.exercises.g8name || name === t.exercises.dimGroups[4] ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g8')}>
              {name}
            </button>
          ) : name === t.exercises.g10name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g10')}>
              {name}
            </button>
          ) : name === t.exercises.g11name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g11')}>
              {name}
            </button>
          ) : name === t.exercises.g13name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g13')}>
              {name}
            </button>
          ) : name === t.exercises.g14name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g14')}>
              {name}
            </button>
          ) : name === t.exercises.g19name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g19')}>
              {name}
            </button>
          ) : name === t.exercises.g16name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g16')}>
              {name}
            </button>
          ) : name === t.exercises.g20name ? (
            <button key={name} className={styles.card} onClick={() => router.push('/exercises/g20')}>
              {name}
            </button>
          ) : (
            <div key={name} className={`${styles.card} ${styles.cardDim}`}>
              {name}
            </div>
          )
        )}
      </div>

    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { HouseTabs } from '@/components/layout/HouseTabs'
import { LetterGrid } from '@/components/letters/LetterGrid'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LetterCell } from '@/types'
import { useT } from '@/lib/i18n'
import { CompareActivity } from '@/components/letters/CompareActivity'
import { NeighborsActivity } from '@/components/letters/NeighborsActivity'
import { BetweenActivity } from '@/components/letters/BetweenActivity'
import { AlphabetActivity } from '@/components/letters/AlphabetActivity'
import { WhereIsActivity } from '@/components/letters/WhereIsActivity'
import { GuessActivity } from '@/components/letters/GuessActivity'
import { BuildActivity } from '@/components/letters/BuildActivity'
import { CloseLettersActivity } from '@/components/letters/CloseLettersActivity'
import styles from './page.module.css'

type ActivityKey = keyof ReturnType<typeof useT>['letters']['house1']['activities']

const Letter3D = dynamic(
  () => import('@/components/letters/Letter3D').then((m) => ({ default: m.Letter3D })),
  { ssr: false }
)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const DIACRITICS: Record<string, string[]> = {
  A: ['à', 'â', 'æ'],
  C: ['ç'],
  E: ['é', 'è', 'ê', 'ë'],
  I: ['î', 'ï'],
  O: ['ô', 'œ'],
  U: ['ù', 'û', 'ü'],
  Y: ['ÿ'],
}

const initialCells: LetterCell[] = ALPHABET.map((letter, i) => ({
  letter,
  position: i + 1,
  diacritics: DIACRITICS[letter] ?? [],
  status: 'empty',
}))

// SVG icons from DS · Repetium_DS_Icons_v1
const ACTIVITY_ICONS: Record<ActivityKey, React.JSX.Element> = {
  compare: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2"  y="8" width="8" height="8" rx="2"/>
      <rect x="14" y="8" width="8" height="8" rx="2"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
      <polyline points="12,10 14,12 12,14"/>
    </svg>
  ),
  howSounds: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
      <path d="M8.5 8.5a5 5 0 0 0 0 7"/>
      <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
      <path d="M5.5 5.5a9.5 9.5 0 0 0 0 13"/>
      <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13"/>
    </svg>
  ),
  alphabet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19L12 5L19 19"/>
      <line x1="7.5" y1="13.5" x2="16.5" y2="13.5"/>
    </svg>
  ),
  closeLetters: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="8"  x2="16" y2="8"/>
      <line x1="8" y1="12" x2="13" y2="12"/>
      <polyline points="11,17 13,19 17,15"/>
    </svg>
  ),
  whereIs: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
      <line x1="12" y1="3"    x2="12" y2="6.5"/>
      <line x1="12" y1="17.5" x2="12" y2="21"/>
      <line x1="3"  y1="12"   x2="6.5" y2="12"/>
      <line x1="17.5" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  neighbors: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  guess: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="12.5"/>
      <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  build: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="9"  cy="7"  r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="7"  r="1" fill="currentColor" stroke="none"/>
      <circle cx="9"  cy="12" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>
      <circle cx="9"  cy="17" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  between: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="7,8 3,12 7,16"/>
      <polyline points="17,8 21,12 17,16"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
    </svg>
  ),
}

const ACTIVITIES: { key: ActivityKey }[] = [
  { key: 'compare'      },
  { key: 'howSounds'    },
  { key: 'alphabet'     },
  { key: 'closeLetters' },
  { key: 'whereIs'      },
  { key: 'neighbors'    },
  { key: 'guess'        },
  { key: 'build'        },
  { key: 'between'      },
]

export default function House1Page() {
  const t = useT()
  const [selected, setSelected] = useState<LetterCell | null>(null)
  const [displayedLetter, setDisplayedLetter] = useState<string>('')
  const [activeActivity, setActiveActivity] = useState<ActivityKey | null>(null)

  // Reset displayed letter to base letter when modal opens/changes
  useEffect(() => {
    if (selected) setDisplayedLetter(selected.letter)
  }, [selected])

  function handlePlayAudio(text: string) {
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then(({ url }) => { if (url) new Audio(url).play() })
      .catch(() => {})
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.letters.house1.title}</h1>
        <p className={styles.desc}>{t.letters.house1.desc}</p>
      </div>

      <HouseTabs />

      <LetterGrid cells={initialCells} onLetterClick={setSelected} />

      {/* Activities section */}
      <div className={styles.activities}>
        <div className={styles.activityGrid}>
          {ACTIVITIES.map(({ key }) => (
            <button
              key={key}
              className={styles.activityChip}
              onClick={() => setActiveActivity(key)}
            >
              <span className={styles.activityIcon}>{ACTIVITY_ICONS[key]}</span>
              <span>{t.letters.house1.activities[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.empty}`} />
          <span>{t.letters.legend.empty}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.seen}`} />
          <span>{t.letters.legend.seen}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.mastered}`} />
          <span>{t.letters.legend.mastered}</span>
        </div>
      </div>

      {/* Compare activity */}
      <Modal
        open={activeActivity === 'compare'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.compare}
        size="lg"
      >
        <CompareActivity onClose={() => setActiveActivity(null)} />
      </Modal>

      {/* Neighbors activity */}
      <Modal
        open={activeActivity === 'neighbors'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.neighbors}
        size="sm"
      >
        {activeActivity === 'neighbors' && (
          <NeighborsActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* Alphabet activity */}
      <Modal
        open={activeActivity === 'alphabet'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.alphabet}
        size="lg"
      >
        {activeActivity === 'alphabet' && (
          <AlphabetActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* WhereIs activity */}
      <Modal
        open={activeActivity === 'whereIs'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.whereIs}
        size="lg"
      >
        {activeActivity === 'whereIs' && (
          <WhereIsActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* Guess activity */}
      <Modal
        open={activeActivity === 'guess'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.guess}
        size="sm"
      >
        {activeActivity === 'guess' && (
          <GuessActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* Between activity */}
      <Modal
        open={activeActivity === 'between'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.between}
        size="sm"
      >
        {activeActivity === 'between' && (
          <BetweenActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* Close letters activity */}
      <Modal
        open={activeActivity === 'closeLetters'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.closeLetters}
        size="lg"
      >
        {activeActivity === 'closeLetters' && (
          <CloseLettersActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* Build activity */}
      <Modal
        open={activeActivity === 'build'}
        onClose={() => setActiveActivity(null)}
        title={t.letters.house1.activities.build}
        size="lg"
      >
        {activeActivity === 'build' && (
          <BuildActivity onClose={() => setActiveActivity(null)} />
        )}
      </Modal>

      {/* Activity stub modal for all other activities */}
      <Modal
        open={!!activeActivity && !['compare', 'neighbors', 'between', 'alphabet', 'whereIs', 'guess', 'build', 'closeLetters'].includes(activeActivity)}
        onClose={() => setActiveActivity(null)}
        title={activeActivity ? t.letters.house1.activities[activeActivity] : undefined}
        size="sm"
      >
        {activeActivity && !['compare', 'neighbors', 'between', 'alphabet', 'whereIs', 'guess', 'build', 'closeLetters'].includes(activeActivity) && (
          <div className={styles.comingSoonWrap}>
            <p className={styles.comingSoonText}>{t.letters.house1.comingSoon}</p>
            <Button variant="ghost" size="sm" onClick={() => setActiveActivity(null)}>
              {t.letters.house1.close}
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${t.letters.house1.modalPrefix} ${selected.letter}` : undefined}
        size="sm"
      >
        {selected && displayedLetter && (
          <div className={styles.letterDetail}>
            <div className={styles.letter3dWrap}>
              <Letter3D letter={displayedLetter} size={180} interactive />
            </div>

            {selected.diacritics.length > 0 && (
              <div className={styles.diacriticsRow}>
                <button
                  className={`${styles.diacriticChip} ${displayedLetter === selected.letter ? styles.diacriticChipActive : ''}`}
                  onClick={() => setDisplayedLetter(selected.letter)}
                >
                  {selected.letter}
                </button>
                {selected.diacritics.map((d) => (
                  <button
                    key={d}
                    className={`${styles.diacriticChip} ${displayedLetter === d ? styles.diacriticChipActive : ''}`}
                    onClick={() => setDisplayedLetter(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <Button variant="primary" size="sm" onClick={() => handlePlayAudio(displayedLetter)}>
                {t.letters.house1.play}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                {t.letters.house1.close}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

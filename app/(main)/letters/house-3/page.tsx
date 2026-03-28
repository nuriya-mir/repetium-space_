'use client'

import { useState, useMemo } from 'react'
import { HouseTabs } from '@/components/layout/HouseTabs'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

interface SoundEntry {
  sound: string
  spellings: string[]
  examples: string[]
  category: 'vowel' | 'nasal' | 'semivowel' | 'consonant'
}

const SOUNDS: SoundEntry[] = [
  // Row 1 — oral vowels
  { sound: '[a]',  spellings: ['a', 'à', 'â'],          examples: ['chat', 'là', 'pâte'],          category: 'vowel' },
  { sound: '[e]',  spellings: ['é', 'er', 'ez', 'et'],  examples: ['été', 'parler', 'nez', 'et'],  category: 'vowel' },
  { sound: '[ɛ]',  spellings: ['è', 'ê', 'ai', 'ei'],   examples: ['mère', 'fête', 'fait', 'neige'],category: 'vowel' },
  { sound: '[i]',  spellings: ['i', 'î', 'y'],           examples: ['ami', 'île', 'style'],          category: 'vowel' },
  { sound: '[o]',  spellings: ['o', 'ô', 'au', 'eau'],  examples: ['mot', 'hôtel', 'auto', 'beau'], category: 'vowel' },
  { sound: '[ɔ]',  spellings: ['o'],                     examples: ['or', 'porte', 'sol'],           category: 'vowel' },
  { sound: '[u]',  spellings: ['ou', 'où'],              examples: ['tout', 'où', 'goût'],           category: 'vowel' },
  // Row 2 — rounded + nasal vowels
  { sound: '[y]',  spellings: ['u', 'û'],                examples: ['lune', 'sûr'],                  category: 'vowel' },
  { sound: '[ø]',  spellings: ['eu', 'œu'],              examples: ['jeu', 'vœux'],                  category: 'vowel' },
  { sound: '[œ]',  spellings: ['eu', 'œu'],              examples: ['peur', 'cœur'],                 category: 'vowel' },
  { sound: '[ə]',  spellings: ['e'],                     examples: ['le', 'ce', 'venir'],            category: 'vowel' },
  { sound: '[ã]',  spellings: ['an', 'am', 'en', 'em'], examples: ['dans', 'chambre', 'enfant'],    category: 'nasal' },
  { sound: '[ɔ̃]',  spellings: ['on', 'om'],              examples: ['bon', 'nombre'],                category: 'nasal' },
  { sound: '[ɛ̃]',  spellings: ['in', 'im', 'ain', 'ein'],examples: ['vin', 'simple', 'main', 'plein'],category: 'nasal' },
  // Row 3 — nasal + semivowels + early consonants
  { sound: '[œ̃]',  spellings: ['un', 'um'],              examples: ['un', 'parfum'],                 category: 'nasal' },
  { sound: '[j]',  spellings: ['i+V', 'ill', 'y'],       examples: ['bien', 'fille', 'yoga'],        category: 'semivowel' },
  { sound: '[w]',  spellings: ['ou+V', 'oi'],            examples: ['oui', 'moi'],                   category: 'semivowel' },
  { sound: '[ɥ]',  spellings: ['u+V'],                   examples: ['nuit', 'lui'],                  category: 'semivowel' },
  { sound: '[b]',  spellings: ['b'],                     examples: ['bon', 'robe'],                  category: 'consonant' },
  { sound: '[d]',  spellings: ['d'],                     examples: ['dire', 'aide'],                 category: 'consonant' },
  { sound: '[f]',  spellings: ['f', 'ph'],               examples: ['feu', 'photo'],                 category: 'consonant' },
  // Row 4 — consonants
  { sound: '[g]',  spellings: ['g', 'gu'],               examples: ['gare', 'guerre'],               category: 'consonant' },
  { sound: '[k]',  spellings: ['c', 'k', 'qu'],          examples: ['café', 'kilo', 'qui'],          category: 'consonant' },
  { sound: '[l]',  spellings: ['l'],                     examples: ['livre', 'elle'],                category: 'consonant' },
  { sound: '[m]',  spellings: ['m'],                     examples: ['mer', 'femme'],                 category: 'consonant' },
  { sound: '[n]',  spellings: ['n'],                     examples: ['nuit', 'canne'],                category: 'consonant' },
  { sound: '[p]',  spellings: ['p'],                     examples: ['pain', 'trop'],                 category: 'consonant' },
  { sound: '[ʁ]',  spellings: ['r'],                     examples: ['rue', 'vert'],                  category: 'consonant' },
  // Row 5 — consonants
  { sound: '[s]',  spellings: ['s', 'ss', 'c', 'ç'],    examples: ['sol', 'masse', 'ça'],           category: 'consonant' },
  { sound: '[t]',  spellings: ['t'],                     examples: ['tout', 'natte'],                category: 'consonant' },
  { sound: '[v]',  spellings: ['v'],                     examples: ['vie', 'rêve'],                  category: 'consonant' },
  { sound: '[z]',  spellings: ['z', 's'],                examples: ['zéro', 'rose'],                 category: 'consonant' },
  { sound: '[ʃ]',  spellings: ['ch'],                    examples: ['chat', 'cher'],                 category: 'consonant' },
  { sound: '[ʒ]',  spellings: ['j', 'g+e/i'],           examples: ['je', 'rouge'],                  category: 'consonant' },
  { sound: '[ɲ]',  spellings: ['gn'],                    examples: ['montagne', 'signe'],            category: 'consonant' },
]

export default function House3Page() {
  const t = useT()
  const [selected, setSelected] = useState<SoundEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSounds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return SOUNDS
    return SOUNDS.filter((s) =>
      s.sound.toLowerCase().includes(q) ||
      s.spellings.some((sp) => sp.toLowerCase().includes(q))
    )
  }, [searchQuery])

  function handlePlaySound(text: string) {
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.json())
      .then(({ url }) => {
        if (url) new Audio(url).play()
      })
      .catch(() => {})
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.letters.house3.title}</h1>
        <p className={styles.desc}>{t.letters.house3.desc}</p>
      </div>

      <HouseTabs />

      {/* House-shaped sound grid */}
      <div className={styles.houseWrap}>
        <svg
          className={styles.roofSvg}
          viewBox="0 0 280 36"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points="0,36 140,0 280,36" style={{ fill: 'var(--teal-dim)' }} />
        </svg>
        <div className={styles.houseBody}>
          <div className={styles.soundGrid} role="list" aria-label={t.letters.house3.title}>
            {filteredSounds.map((entry) => (
              <button
                key={entry.sound}
                className={`${styles.soundCell} ${selected?.sound === entry.sound ? styles.active : ''}`}
                onClick={() => setSelected((s) => s?.sound === entry.sound ? null : entry)}
                role="listitem"
                aria-label={entry.sound}
                aria-pressed={selected?.sound === entry.sound}
              >
                <span className="fr-text">{entry.sound}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t.letters.house3.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t.letters.house3.searchPlaceholder}
        />
      </div>

      {/* Detail panel — shown when a sound is selected */}
      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <button
              className={`${styles.detailSoundBtn} fr-text`}
              onClick={() => handlePlaySound(selected.examples[0])}
              aria-label={t.letters.house3.play}
            >
              {selected.sound}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
              </svg>
            </button>
          </div>

          <p className={styles.spellingLabel}>{t.letters.house3.spellings}</p>
          <div className={styles.spellingChips}>
            {selected.spellings.map((sp, i) => (
              <button
                key={sp}
                className={styles.spellingChip}
                onClick={() => handlePlaySound(selected.examples[i] ?? selected.examples[0])}
              >
                <span className="fr-text">{sp}</span>
              </button>
            ))}
          </div>

          <p className={styles.spellingLabel}>{t.letters.house3.examples}</p>
          <div className={styles.examplesList}>
            {selected.examples.map((ex) => (
              <button
                key={ex}
                className={styles.exampleWord}
                onClick={() => handlePlaySound(ex)}
              >
                <span className="fr-text">{ex}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 4l14 8-14 8V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

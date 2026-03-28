'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'show' | 'assemble' | 'complete_word' | 'complete'

interface SyllableWord {
  fullWord: string
  syllables: string[]
  shuffled: string[]
  placed: (string | null)[]
  result?: 'completed' | 'skipped'
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WORD_COUNTS = [5, 10, 15] as const
const SYLL_LEVELS = [2, 3, 4] as const

const SYLL_COLORS = [
  { bg: '#E8EEF5', border: '#7A9AB8' },
  { bg: '#EDE8F5', border: '#C06A30' },
  { bg: '#E4F0EA', border: '#4EAA78' },
  { bg: '#F5F0E0', border: '#D4AA38' },
]
const PLACED_COLOR = { bg: '#E4F0EA', border: '#4EAA78' }
const HINT_DELAY = 15000

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  // Avoid identical shuffle for single/two-element arrays — acceptable
  return a
}

function getSyllColor(idx: number) {
  return SYLL_COLORS[idx % SYLL_COLORS.length]
}

function parseWordList(content: string): SyllableWord[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const result: SyllableWord[] = []

  for (const line of lines) {
    // Accept "word = syl-la-ble" or "word: syl-la-ble" or just "syl-la-ble"
    const eqIdx = line.indexOf('=')
    const colonIdx = line.indexOf(':')
    const sepIdx = eqIdx !== -1 ? eqIdx : colonIdx !== -1 ? colonIdx : -1

    let fullWord: string
    let syllStr: string

    if (sepIdx !== -1) {
      fullWord = line.slice(0, sepIdx).trim().toLowerCase()
      syllStr = line.slice(sepIdx + 1).trim()
    } else if (line.includes('-')) {
      syllStr = line
      fullWord = line.replace(/-/g, '').toLowerCase()
    } else {
      continue
    }

    const syllables = syllStr.split('-').map(s => s.trim().toLowerCase()).filter(s => /^[a-zA-ZÀ-ÿœæ]+$/.test(s))
    if (syllables.length < 2) continue

    const reconstructed = syllables.join('')
    const fw = fullWord.replace(/[^a-zA-ZÀ-ÿœæ]/g, '').toLowerCase()
    if (fw && fw !== reconstructed) continue // mismatch — skip

    result.push({
      fullWord: syllables.join(''),
      syllables,
      shuffled: shuffle([...syllables]),
      placed: new Array(syllables.length).fill(null),
    })
  }

  return result
}

async function playTTS(text: string): Promise<void> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const { url } = await res.json()
    if (!url) return
    return new Promise(resolve => {
      const audio = new Audio(url)
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
  } catch { /* TTS unavailable */ }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G13Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g13', 'Слогоделение', '/exercises/g13')
  const { format, setFormat } = useTextFormat()

  const [phase, setPhase] = useState<Phase>('select')
  const [wordCount, setWordCount] = useState<5 | 10 | 15>(10)
  const [syllLevel, setSyllLevel] = useState<2 | 3 | 4>(2)
  const [words, setWords] = useState<SyllableWord[]>([])
  const [wordIdx, setWordIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [hintActive, setHintActive] = useState(false)
  const [shakingSlot, setShakingSlot] = useState<number | null>(null)
  const [activeSpeakIdx, setActiveSpeakIdx] = useState<number | null>(null)

  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const cancelAudioRef = useRef(false)

  const currentWord = words[wordIdx]

  // ── Hint timer ─────────────────────────────────────────────────────────────
  const resetHintTimer = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHintActive(false)
    hintTimerRef.current = setTimeout(() => setHintActive(true), HINT_DELAY)
  }, [])

  useEffect(() => {
    if (phase === 'assemble') resetHintTimer()
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current) }
  }, [phase, wordIdx, resetHintTimer])

  // ── Auto-play on show ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'show' || !currentWord) return
    cancelAudioRef.current = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 400))
      if (cancelAudioRef.current) return
      await playTTS(currentWord.fullWord)
      if (cancelAudioRef.current) return
      await new Promise(r => setTimeout(r, 300))
      for (let i = 0; i < currentWord.syllables.length; i++) {
        if (cancelAudioRef.current) break
        setActiveSpeakIdx(i)
        await playTTS(currentWord.syllables[i])
        setActiveSpeakIdx(null)
        await new Promise(r => setTimeout(r, 150))
      }
    })()
    return () => { cancelAudioRef.current = true; setActiveSpeakIdx(null) }
  }, [phase, wordIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-play on complete_word ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'complete_word' || !currentWord) return
    cancelAudioRef.current = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 300))
      if (cancelAudioRef.current) return
      await playTTS(currentWord.fullWord)
    })()
    return () => { cancelAudioRef.current = true }
  }, [phase, wordIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load words ──────────────────────────────────────────────────────────────
  async function loadWords() {
    cancelAudioRef.current = true
    setPhase('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: 'g13',
          letter_targets: [`${wordCount},${syllLevel}`],
        }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      const parsed = parseWordList(text)
      if (parsed.length < 2) throw new Error('too few')

      cancelAudioRef.current = false
      setWords(parsed.slice(0, wordCount))
      setWordIdx(0)
      setPhase('show')
    } catch {
      setErrorMsg(t.exercises.loadError)
      setPhase('select')
    }
  }

  // ── Skip word ───────────────────────────────────────────────────────────────
  function skipWord() {
    cancelAudioRef.current = true
    setWords(prev => {
      const next = [...prev]
      next[wordIdx] = { ...next[wordIdx], result: 'skipped' }
      return next
    })
    advanceToNext()
  }

  function advanceToNext() {
    if (wordIdx + 1 >= words.length) {
      setTimeout(() => setPhase('complete'), 200)
    } else {
      setWordIdx(i => i + 1)
      setHintActive(false)
      setPhase('show')
    }
  }

  // ── Drop handler ────────────────────────────────────────────────────────────
  function handleDrop(syl: string, slotIdx: number) {
    if (!currentWord) return
    const firstFree = currentWord.placed.findIndex(p => p === null)
    if (slotIdx !== firstFree) return // only first free slot accepts drops

    if (syl === currentWord.syllables[slotIdx]) {
      // Correct
      setWords(prev => {
        const next = [...prev]
        const placed = [...next[wordIdx].placed]
        placed[slotIdx] = syl
        const isComplete = placed.every(Boolean)
        next[wordIdx] = { ...next[wordIdx], placed, ...(isComplete ? { result: 'completed' } : {}) }
        return next
      })
      resetHintTimer()

      // Check completion after state update
      const newPlaced = [...currentWord.placed]
      newPlaced[slotIdx] = syl
      if (newPlaced.every(Boolean)) {
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
        setTimeout(() => setPhase('complete_word'), 250)
      }
    } else {
      // Wrong syllable
      setShakingSlot(slotIdx)
      setTimeout(() => setShakingSlot(null), 420)
    }
  }

  // ── Drag start (pointer events) ─────────────────────────────────────────────
  function startDrag(e: React.PointerEvent, syl: string) {
    e.preventDefault()
    const chipEl = e.currentTarget as HTMLElement
    const rect = chipEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    // Create ghost
    const ghost = document.createElement('div')
    ghost.textContent = syl
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      padding: 6px 14px;
      border-radius: 8px;
      font-family: var(--font-read);
      font-size: 1.2rem;
      font-weight: 500;
      background: ${getSyllColor(currentWord?.syllables.indexOf(syl) ?? 0).bg};
      border: 1.5px solid ${getSyllColor(currentWord?.syllables.indexOf(syl) ?? 0).border};
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      opacity: 0.92;
      transform: scale(1.08);
      left: ${e.clientX - offsetX}px;
      top: ${e.clientY - offsetY}px;
    `
    document.body.appendChild(ghost)
    ghostRef.current = ghost

    const moveHandler = (ev: PointerEvent) => {
      ghost.style.left = `${ev.clientX - offsetX}px`
      ghost.style.top = `${ev.clientY - offsetY}px`
    }

    const upHandler = (ev: PointerEvent) => {
      ghost.style.display = 'none'
      const target = document.elementFromPoint(ev.clientX, ev.clientY)
      ghost.remove()
      ghostRef.current = null
      document.removeEventListener('pointermove', moveHandler)
      document.removeEventListener('pointerup', upHandler)

      const slotEl = (target as HTMLElement)?.closest('[data-slot]')
      const slotIdx = slotEl ? parseInt(slotEl.getAttribute('data-slot') ?? '-1') : -1
      handleDrop(syl, slotIdx)
    }

    document.addEventListener('pointermove', moveHandler)
    document.addEventListener('pointerup', upHandler)
  }

  // ── Format toggle ─────────────────────────────────────────────────────────
  const formatToggle = (
    <div className={styles.formatToggle}>
      <button className={`${styles.formatBtn} ${format === 'normal' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('normal')}>Аа</button>
      <button className={`${styles.formatBtn} ${styles.formatBtnLarge} ${format === 'adapted' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('adapted')}>Аа</button>
    </div>
  )

  const closeBtn = (
    <button className={styles.closeBtn} onClick={() => { cancelAudioRef.current = true; router.push('/exercises') }} aria-label="Закрыть">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )

  const progressDots = words.length > 0 && (
    <div className={styles.progressDots}>
      {words.map((w, i) => (
        <span
          key={i}
          className={`${styles.dot} ${i < wordIdx ? styles.dotDone : i === wordIdx ? styles.dotActive : ''}`}
        />
      ))}
    </div>
  )

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {closeBtn}
          <span className={styles.groupLabel}>{t.exercises.g13name}</span>
          {formatToggle}
        </div>
        <div className={styles.selectWrap}>
          <div className={styles.selectGroup}>
            <p className={styles.selectGroupLabel}>{t.exercises.g13selectWordCount}</p>
            <div className={styles.optionCards}>
              {WORD_COUNTS.map(n => (
                <button key={n} className={`${styles.optionCard} ${wordCount === n ? styles.optionCardActive : ''}`} onClick={() => setWordCount(n as 5|10|15)}>
                  <span className={styles.optionNum}>{n}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.selectGroup}>
            <p className={styles.selectGroupLabel}>{t.exercises.g13selectSyllableCount}</p>
            <div className={styles.optionCards}>
              {SYLL_LEVELS.map(n => (
                <button key={n} className={`${styles.optionCard} ${syllLevel === n ? styles.optionCardActive : ''}`} onClick={() => setSyllLevel(n as 2|3|4)}>
                  <span className={styles.optionNum}>{n === 4 ? '4+' : n}</span>
                  <span className={styles.optionLabel}>{n === 2 ? t.exercises.g13syllables2 : n === 3 ? t.exercises.g13syllables3 : t.exercises.g13syllables4}</span>
                </button>
              ))}
            </div>
          </div>

          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <button className={styles.startBtn} onClick={loadWords}>{t.exercises.g13startBtn}</button>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>{closeBtn}<span className={styles.groupLabel}>{t.exercises.g13name}</span>{formatToggle}</div>
        <div className={styles.centerWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t.exercises.loading}</p>
        </div>
      </div>
    )
  }

  // ── COMPLETE (all words done) ──────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}><span className={styles.groupLabel}>{t.exercises.g13name}</span>{formatToggle}</div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={loadWords}>{t.exercises.again}</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => setPhase('select')}>{t.exercises.g14restBtn}</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>{t.exercises.toExercises}</button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentWord) return null

  const topbar = (
    <div className={styles.topbar}>
      {closeBtn}
      <div className={styles.topbarProgress}>
        {progressDots}
        <span className={styles.wordCounter}>{t.exercises.g13wordProgress.replace('{current}', String(wordIdx + 1)).replace('{total}', String(words.length))}</span>
      </div>
      <div className={styles.topbarRight}>
        {formatToggle}
        <button className={styles.skipBtn} onClick={skipWord}>{t.exercises.g13skipBtn}</button>
      </div>
    </div>
  )

  // ── SHOW ──────────────────────────────────────────────────────────────────
  if (phase === 'show') {
    return (
      <div className={styles.page}>
        {topbar}
        <div className={styles.showWrap}>
          <button
            className={`${styles.wordFull} ${format === 'adapted' ? styles.wordFullAdapted : ''}`}
            onClick={() => playTTS(currentWord.fullWord)}
          >
            {currentWord.fullWord}
          </button>
          <p className={styles.tapHint}>{t.exercises.g13tapToListen}</p>

          <div className={styles.divider}>
            <span className={styles.dividerLabel}>{t.exercises.g13syllableDivision}</span>
          </div>

          <div className={styles.syllRow}>
            {currentWord.syllables.map((syl, i) => {
              const col = getSyllColor(i)
              const isActive = activeSpeakIdx === i
              return (
                <button
                  key={i}
                  className={`${styles.syllChip} ${isActive ? styles.syllChipActive : ''}`}
                  style={{ background: col.bg, borderColor: col.border }}
                  onClick={() => playTTS(syl)}
                >
                  {syl}
                </button>
              )
            })}
          </div>
          <p className={styles.tapHint}>{t.exercises.g13tapSyllable}</p>
        </div>
        <div className={styles.bottomBar}>
          <button className={styles.readyBtn} onClick={() => { cancelAudioRef.current = true; setPhase('assemble') }}>
            {t.exercises.g13readyBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── COMPLETE_WORD ─────────────────────────────────────────────────────────
  if (phase === 'complete_word') {
    const isLast = wordIdx + 1 >= words.length
    return (
      <div className={styles.page}>
        {topbar}
        <div className={styles.assembleWrap}>
          <div className={styles.syllRow}>
            {currentWord.syllables.map((syl, i) => (
              <span
                key={i}
                className={styles.syllChipPlaced}
                style={{ background: PLACED_COLOR.bg, borderColor: PLACED_COLOR.border }}
              >
                {syl}
              </span>
            ))}
          </div>
          <p className={`${styles.wordFull} ${styles.wordFullGreen} ${format === 'adapted' ? styles.wordFullAdapted : ''}`}>
            {currentWord.fullWord}
          </p>
          <p className={styles.tapHint}>{t.exercises.g13wordComplete}</p>
        </div>
        <div className={styles.bottomBar}>
          <button
            className={styles.readyBtn}
            onClick={() => {
              if (isLast) {
                setWords(prev => { const n=[...prev]; n[wordIdx]={...n[wordIdx],result:'completed'}; return n })
                setPhase('complete')
              } else {
                setWords(prev => { const n=[...prev]; n[wordIdx]={...n[wordIdx],result:'completed'}; return n })
                setWordIdx(i => i + 1)
                setPhase('show')
              }
            }}
          >
            {isLast ? t.exercises.g13finishBtn : t.exercises.g13nextWord}
          </button>
        </div>
      </div>
    )
  }

  // ── ASSEMBLE ──────────────────────────────────────────────────────────────
  const firstFreeSlot = currentWord.placed.findIndex(p => p === null)

  return (
    <div className={styles.page}>
      {topbar}
      <div className={styles.assembleWrap}>
        <p className={styles.assembleHint}>{t.exercises.g13assembleHint}</p>

        {/* Shuffled chips */}
        <div className={styles.syllRow} style={{ touchAction: 'none' }}>
          {currentWord.shuffled.map((syl, i) => {
            const isPlaced = currentWord.placed.includes(syl) &&
              currentWord.syllables.indexOf(syl) === currentWord.placed.indexOf(syl)
            const originalIdx = currentWord.syllables.indexOf(syl)
            const col = getSyllColor(originalIdx)
            const isFirstUnplaced = !isPlaced && currentWord.shuffled
              .filter((s, si) => si <= i && !currentWord.placed.includes(s))
              .length === 1
            const shouldHint = hintActive && isFirstUnplaced && !isPlaced

            if (isPlaced) {
              return <span key={i} className={styles.syllChipGhost}>{syl}</span>
            }

            return (
              <span
                key={i}
                className={`${styles.syllChip} ${styles.syllChipDraggable} ${shouldHint ? styles.syllChipHint : ''}`}
                style={{ background: col.bg, borderColor: col.border }}
                onPointerDown={e => startDrag(e, syl)}
              >
                {syl}
              </span>
            )
          })}
        </div>

        {/* Slots */}
        <div className={styles.slotRow}>
          {currentWord.placed.map((val, i) => {
            const isFirst = i === firstFreeSlot
            const isShaking = shakingSlot === i
            const col = val ? PLACED_COLOR : undefined

            return (
              <span
                key={i}
                data-slot={i}
                className={`${styles.slot} ${val ? styles.slotFilled : ''} ${isFirst && !val ? styles.slotActive : ''} ${isShaking ? styles.slotShake : ''}`}
                style={val ? { background: col!.bg, borderColor: col!.border } : undefined}
              >
                {val ?? ''}
              </span>
            )
          })}
        </div>
      </div>
      <div className={styles.bottomBar} />
    </div>
  )
}

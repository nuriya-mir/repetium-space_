'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'show' | 'fade' | 'recall' | 'complete'
type FadeStep = 0 | 1 | 2

type Segment =
  | { type: 'text'; content: string }
  | { type: 'target'; word: string; prepType: string; color: string; nextWord: string; idx: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const PREP_COLORS = ['#D4AA38', '#7A9AB8', '#C06A30', '#4EAA78']

const PREP_DEFS = [
  { key: 'à',       example: 'aller à la gare' },
  { key: 'de',      example: 'près de la mer' },
  { key: 'en',      example: 'en France' },
  { key: 'dans',    example: 'dans la rue' },
  { key: 'sur',     example: 'sur le chemin' },
  { key: 'sous',    example: 'sous la table' },
  { key: 'avec',    example: 'avec plaisir' },
  { key: 'pour',    example: 'pour toi' },
  { key: 'chez',    example: 'chez moi' },
  { key: 'entre',   example: 'entre les arbres' },
  { key: 'par',     example: 'par exemple' },
  { key: 'vers',    example: 'vers la mer' },
  { key: 'sans',    example: 'sans effort' },
  { key: 'avant',   example: 'avant le départ' },
  { key: 'après',   example: 'après la pluie' },
  { key: 'devant',  example: 'devant la maison' },
  { key: 'derrière',example: 'derrière le jardin' },
  { key: 'contre',  example: 'contre le vent' },
  { key: 'depuis',  example: 'depuis ce matin' },
  { key: 'pendant', example: 'pendant la journée' },
  { key: 'parmi',   example: 'parmi les fleurs' },
  { key: 'selon',   example: 'selon son cœur' },
  { key: 'malgré',  example: 'malgré la pluie' },
] as const

const HINT_AFTER_ERRORS = 3

// ── Segment parser ────────────────────────────────────────────────────────────
function stripPunctuation(token: string): string {
  return token.replace(/[^a-zA-ZÀ-ÿœæ'-]/g, '')
}

function parseG16Segments(text: string, selectedKeys: string[]): Segment[] {
  const activeKeys = new Set(selectedKeys.map(k => k.toLowerCase()))

  // Build color map: key → color
  const colorMap = new Map<string, string>()
  selectedKeys.forEach((key, i) => {
    colorMap.set(key, PREP_COLORS[i % PREP_COLORS.length])
  })

  // Tokenize: words and non-word runs
  const tokens = text.match(/[a-zA-ZÀ-ÿœæ'-]+|[^a-zA-ZÀ-ÿœæ'-]+/g) ?? []

  const segments: Segment[] = []
  let targetIdx = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (!/[a-zA-ZÀ-ÿœæ]/.test(token)) {
      segments.push({ type: 'text', content: token })
      continue
    }

    const stripped = stripPunctuation(token).toLowerCase()

    // Exact match only (no partial like "du" matching "de")
    if (activeKeys.has(stripped) && selectedKeys.some(k => k === stripped)) {
      const matchedKey = selectedKeys.find(k => k === stripped)!
      const color = colorMap.get(matchedKey) ?? PREP_COLORS[0]

      // Find the next word token for TTS context
      let nextWord = ''
      for (let j = i + 1; j < tokens.length; j++) {
        if (/[a-zA-ZÀ-ÿœæ]/.test(tokens[j])) {
          nextWord = stripPunctuation(tokens[j])
          break
        }
      }

      segments.push({
        type: 'target',
        word: token,
        prepType: matchedKey,
        color,
        nextWord,
        idx: targetIdx++,
      })
      continue
    }

    segments.push({ type: 'text', content: token })
  }

  return segments
}

// ── TTS helper ────────────────────────────────────────────────────────────────
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
export default function G16Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g16', 'Предлоги', '/exercises/g16')
  const { format, setFormat } = useTextFormat()

  const [phase, setPhase] = useState<Phase>('select')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [fadeStep, setFadeStep] = useState<FadeStep>(0)
  const [values, setValues] = useState<string[]>([])
  const [errors, setErrors] = useState<number[]>([])
  const [shaking, setShaking] = useState<Set<number>>(new Set())
  const [hints, setHints] = useState<Set<number>>(new Set())
  const [errorMsg, setErrorMsg] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const fadeTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const composingRef = useRef<boolean[]>([])
  const cancelPlayRef = useRef(false)

  const targets = useMemo(
    () => segments.filter((s): s is Extract<Segment, { type: 'target' }> => s.type === 'target'),
    [segments]
  )

  const allFilled = useMemo(
    () => targets.length > 0 && targets.every((tgt, i) => values[i] === tgt.word.toLowerCase()),
    [targets, values]
  )

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout) }, [])

  // ── Focus first input on recall ───────────────────────────────────────────
  useEffect(() => {
    if (phase === 'recall') setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }, [phase])

  // ── Auto-complete ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (allFilled && phase === 'recall') setTimeout(() => setPhase('complete'), 600)
  }, [allFilled, phase])

  // ── Auto-play unique preposition sounds on show ───────────────────────────
  useEffect(() => {
    if (phase !== 'show' || selectedKeys.length === 0) return
    cancelPlayRef.current = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 600))
      for (const key of selectedKeys) {
        if (cancelPlayRef.current) break
        await playTTS(key)
        if (!cancelPlayRef.current) await new Promise(r => setTimeout(r, 350))
      }
    })()
    return () => { cancelPlayRef.current = true }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle preposition selection ──────────────────────────────────────────
  function togglePrep(key: string) {
    setSelectedKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 4) return prev
      return [...prev, key]
    })
  }

  // ── Load text ─────────────────────────────────────────────────────────────
  async function loadText() {
    if (selectedKeys.length === 0) return
    cancelPlayRef.current = true
    setPhase('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g16', letter_targets: selectedKeys }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      const segs = parseG16Segments(text, selectedKeys)
      const tgts = segs.filter(s => s.type === 'target')
      if (tgts.length < 4) throw new Error('too few targets')

      inputRefs.current = new Array(tgts.length).fill(null)
      composingRef.current = new Array(tgts.length).fill(false)
      cancelPlayRef.current = false
      setSegments(segs)
      setValues(new Array(tgts.length).fill(''))
      setErrors(new Array(tgts.length).fill(0))
      setHints(new Set())
      setShaking(new Set())
      setFadeStep(0)
      setPhase('show')
    } catch {
      setErrorMsg(t.exercises.loadError)
      setPhase('select')
    }
  }

  // ── Fade sequence ─────────────────────────────────────────────────────────
  function startFade() {
    cancelPlayRef.current = true
    fadeTimers.current.forEach(clearTimeout)
    setPhase('fade')
    setFadeStep(0)
    fadeTimers.current = [
      setTimeout(() => setFadeStep(1), 1000),
      setTimeout(() => setFadeStep(2), 2200),
      setTimeout(() => { setPhase('recall'); cancelPlayRef.current = false }, 3000),
    ]
  }

  // ── Input handling ────────────────────────────────────────────────────────
  const handleKeyInput = useCallback((idx: number, char: string) => {
    if (!char) return
    setValues(prev => {
      const currentTyped = prev[idx] ?? ''
      const target = targets[idx]
      if (!target) return prev

      const wordLower = target.word.toLowerCase()
      if (currentTyped === wordLower) return prev

      const expectedChar = wordLower[currentTyped.length]
      const correct = char.toLowerCase() === expectedChar

      if (correct) {
        const newTyped = currentTyped + expectedChar
        const next = [...prev]
        next[idx] = newTyped

        if (newTyped === wordLower) {
          // Fully filled — play preposition + next word
          const ttsText = target.nextWord ? target.word + ' ' + target.nextWord : target.word
          playTTS(ttsText).catch(() => {})
          setTimeout(() => {
            const nextIdx = next.findIndex((v, i) => i > idx && targets[i] && v !== targets[i].word.toLowerCase())
            if (nextIdx !== -1) inputRefs.current[nextIdx]?.focus()
          }, 100)
        }
        return next
      }

      // Wrong
      setShaking(s => new Set([...s, idx]))
      setTimeout(() => setShaking(s => { const n = new Set(s); n.delete(idx); return n }), 420)
      setErrors(e => {
        const ne = [...e]
        ne[idx]++
        if (ne[idx] >= HINT_AFTER_ERRORS) setHints(h => new Set([...h, idx]))
        return ne
      })
      return prev
    })
  }, [targets])

  // ── Restart ───────────────────────────────────────────────────────────────
  function restart() {
    cancelPlayRef.current = true
    fadeTimers.current.forEach(clearTimeout)
    setPhase('select')
    setSegments([])
    setValues([])
    setErrors([])
    setHints(new Set())
    setShaking(new Set())
    setErrorMsg('')
  }

  // ── Format toggle ─────────────────────────────────────────────────────────
  const formatToggle = (
    <div className={styles.formatToggle}>
      <button className={`${styles.formatBtn} ${format === 'normal' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('normal')}>Аа</button>
      <button className={`${styles.formatBtn} ${styles.formatBtnLarge} ${format === 'adapted' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('adapted')}>Аа</button>
    </div>
  )

  const closeBtn = (
    <button className={styles.closeBtn} onClick={() => { cancelPlayRef.current = true; router.push('/exercises') }} aria-label="Закрыть">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )

  // Legend for 2+ preposition types
  const legend = selectedKeys.length > 1 && (
    <div className={styles.legend}>
      {selectedKeys.map((key, i) => (
        <span key={key} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: PREP_COLORS[i % PREP_COLORS.length] }} />
          <span className={styles.legendText}>{key}</span>
        </span>
      ))}
    </div>
  )

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {closeBtn}
          <span className={styles.groupLabel}>{t.exercises.g16name}</span>
          {formatToggle}
        </div>
        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g16selectHint}</p>
          <p className={styles.selectedCount}>
            {t.exercises.g16selectedCount.replace('{count}', String(selectedKeys.length))}
          </p>

          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.prepGrid}>
            {PREP_DEFS.map(def => {
              const sel = selectedKeys.includes(def.key)
              const selIdx = selectedKeys.indexOf(def.key)
              const color = sel ? PREP_COLORS[selIdx % PREP_COLORS.length] : undefined
              return (
                <button
                  key={def.key}
                  className={`${styles.prepCard} ${sel ? styles.prepCardSelected : ''}`}
                  style={sel ? { borderColor: color, background: color + '33' } : undefined}
                  onClick={() => togglePrep(def.key)}
                  disabled={!sel && selectedKeys.length >= 4}
                >
                  <span className={styles.prepLabel}>{def.key}</span>
                  <span className={styles.prepExample}>{def.example}</span>
                </button>
              )
            })}
          </div>

          {selectedKeys.length > 0 && (
            <p className={styles.recommendHint}>{t.exercises.g16recommendHint}</p>
          )}

          <button
            className={styles.startBtn}
            onClick={loadText}
            disabled={selectedKeys.length === 0}
          >
            {t.exercises.g16startBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>{closeBtn}<span className={styles.groupLabel}>{t.exercises.g16name}</span>{formatToggle}</div>
        <div className={styles.centerWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t.exercises.loading}</p>
        </div>
      </div>
    )
  }

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}><span className={styles.groupLabel}>{t.exercises.g16name}</span>{formatToggle}</div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
            {segments.map((seg, i) => {
              if (seg.type === 'text') return <span key={i}>{seg.content}</span>
              return (
                <span key={i} style={{ color: seg.color, fontWeight: 600 }}>{seg.word}</span>
              )
            })}
          </p>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={loadText}>{t.exercises.again}</button>
            <button className={styles.actionBtn} onClick={restart}>{t.exercises.g16anotherEl}</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>{t.exercises.toExercises}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── SHOW / FADE / RECALL ──────────────────────────────────────────────────
  const filledCount = values.filter((v, i) => v === targets[i]?.word.toLowerCase()).length

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        {closeBtn}
        <span className={styles.groupLabel}>{t.exercises.g16name}</span>
        <div className={styles.topbarRight}>
          {formatToggle}
          <button className={styles.skipBtn} onClick={() => setPhase('complete')}>{t.exercises.skip}</button>
        </div>
      </div>

      <div className={styles.exerciseWrap}>
        {(phase === 'show' || phase === 'fade') && legend}

        <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
          {segments.map((seg, i) => {
            if (seg.type === 'text') return <span key={i}>{seg.content}</span>

            const idx = seg.idx
            const typed = values[idx] ?? ''
            const isShaking = shaking.has(idx)
            const showHint = hints.has(idx) && typed !== seg.word.toLowerCase()
            const wordLower = seg.word.toLowerCase()
            const fullyFilled = typed === wordLower
            const bgColor = seg.color + '55'

            // SHOW phase
            if (phase === 'show') {
              return (
                <span
                  key={i}
                  className={styles.highlight}
                  style={{ background: bgColor }}
                  onClick={() => {
                    const ttsText = seg.nextWord ? seg.word + ' ' + seg.nextWord : seg.word
                    playTTS(ttsText)
                  }}
                >
                  {seg.word}
                </span>
              )
            }

            // FADE phase
            if (phase === 'fade') {
              return (
                <span key={i}>
                  {fadeStep === 0 && <span className={styles.highlight} style={{ background: bgColor }}>{seg.word}</span>}
                  {fadeStep === 1 && <span className={styles.fadeDots}>{'•'.repeat(seg.word.length)}</span>}
                  {fadeStep === 2 && <span className={styles.fadeEmpty}>{'\u00A0'.repeat(seg.word.length)}</span>}
                </span>
              )
            }

            // RECALL phase
            if (fullyFilled) {
              return (
                <span key={i} className={styles.filledWord} style={{ color: seg.color }}>{typed}</span>
              )
            }

            const remaining = wordLower.slice(typed.length)
            return (
              <span key={i} className={styles.recallWord}>
                {typed && <span style={{ color: seg.color, fontWeight: 600 }}>{typed}</span>}
                <span
                  className={`${styles.gapWrap} ${isShaking ? styles.gapShake : ''}`}
                  onClick={() => inputRefs.current[idx]?.focus()}
                >
                  {showHint && <span className={styles.hintChar}>{remaining[0]}</span>}
                  <input
                    key={`input-${idx}`}
                    ref={el => { inputRefs.current[idx] = el }}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={styles.gapInput}
                    defaultValue=""
                    onCompositionStart={() => { composingRef.current[idx] = true }}
                    onCompositionEnd={e => {
                      composingRef.current[idx] = false
                      const char = e.data
                      e.currentTarget.value = ''
                      if (char) handleKeyInput(idx, char)
                    }}
                    onKeyDown={e => {
                      if (composingRef.current[idx]) return
                      if (e.key.length === 1) { e.preventDefault(); handleKeyInput(idx, e.key) }
                    }}
                    onChange={e => {
                      if (composingRef.current[idx]) return
                      const char = e.target.value.slice(-1)
                      if (char) { handleKeyInput(idx, char); e.target.value = '' }
                    }}
                    aria-label={`Пропуск ${idx + 1}`}
                  />
                  <span className={styles.gap}>{'\u00A0'.repeat(remaining.length)}</span>
                </span>
              </span>
            )
          })}
        </p>

        {phase === 'show' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g16showHint}</p>
            <button className={styles.readyBtn} onClick={startFade}>{t.exercises.g16readyBtn}</button>
          </div>
        )}

        {phase === 'recall' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>
              {t.exercises.g16filledCount
                .replace('{current}', String(filledCount))
                .replace('{total}', String(targets.length))}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

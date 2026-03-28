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
  | { type: 'target'; prefix: string; silent: string; suffix: string; silentType: string; color: string; word: string; idx: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ['#D4AA38', '#7A9AB8', '#C06A30', '#4EAA78']

const SILENT_DEFS = [
  { key: 'h',  label: 'h',  example: 'homme' },
  { key: 'qu', label: 'qu', example: 'que' },
  { key: 'gu', label: 'gu', example: 'guerre' },
  { key: 'gn', label: 'gn', example: 'ligne' },
] as const

const HINT_AFTER_ERRORS = 3

// ── Pattern finder ─────────────────────────────────────────────────────────────
// Returns position of the silent letter within a lowercased word, or null.
function findSilentPattern(lower: string, key: string): { prefixLen: number; silentLen: number } | null {
  switch (key) {
    case 'h': {
      const idx = lower.indexOf('h')
      if (idx === -1) return null
      return { prefixLen: idx, silentLen: 1 }
    }
    case 'qu': {
      const idx = lower.indexOf('qu')
      if (idx === -1) return null
      // prefix ends at q (inclusive), silent = u
      return { prefixLen: idx + 1, silentLen: 1 }
    }
    case 'gu': {
      // gu before e/é/è/ê/ë/i/î only
      const match = lower.match(/gu(?=[eéèêëiî])/)
      if (!match || match.index === undefined) return null
      return { prefixLen: match.index + 1, silentLen: 1 }
    }
    case 'gn': {
      const idx = lower.indexOf('gn')
      if (idx === -1) return null
      // g is silent, n stays
      return { prefixLen: idx, silentLen: 1 }
    }
    default:
      return null
  }
}

// ── Segment parser ─────────────────────────────────────────────────────────────
function parseG8Segments(text: string, selectedKeys: string[]): Segment[] {
  const colorMap: Record<string, string> = {}
  selectedKeys.forEach((key, i) => { colorMap[key] = COLORS[i % COLORS.length] })

  const segments: Segment[] = []
  let targetIdx = 0
  const tokens = text.match(/[a-zA-ZÀ-ÿœæ'-]+|[^a-zA-ZÀ-ÿœæ'-]+/g) ?? []

  for (const token of tokens) {
    if (!/[a-zA-ZÀ-ÿœæ]/.test(token)) {
      segments.push({ type: 'text', content: token })
      continue
    }

    const lower = token.toLowerCase()
    let matched = false

    for (const key of selectedKeys) {
      const found = findSilentPattern(lower, key)
      if (found) {
        const { prefixLen, silentLen } = found
        const prefix = token.slice(0, prefixLen)
        const silent = token.slice(prefixLen, prefixLen + silentLen)
        const suffix = token.slice(prefixLen + silentLen)
        segments.push({
          type: 'target',
          prefix,
          silent,
          suffix,
          silentType: key,
          color: colorMap[key],
          word: token,
          idx: targetIdx++,
        })
        matched = true
        break
      }
    }

    if (!matched) segments.push({ type: 'text', content: token })
  }

  return segments
}

// ── TTS helper ─────────────────────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function G8Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g8', 'Немые буквы внутри', '/exercises/g8')
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
    () => targets.length > 0 && targets.every((tgt, i) => values[i]?.toLowerCase() === tgt.silent.toLowerCase()),
    [targets, values]
  )

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout) }, [])

  // ── Focus first input on recall ───────────────────────────────────────────
  useEffect(() => {
    if (phase === 'recall') setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }, [phase])

  // ── Auto-complete ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (allFilled && phase === 'recall') setTimeout(() => setPhase('complete'), 600)
  }, [allFilled, phase])

  // ── Auto-play target words on show ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'show' || targets.length === 0) return
    cancelPlayRef.current = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 600))
      for (const tgt of targets) {
        if (cancelPlayRef.current) break
        await new Promise(r => setTimeout(r, 300))
        if (cancelPlayRef.current) break
        await playTTS(tgt.word)
        if (!cancelPlayRef.current) await new Promise(r => setTimeout(r, 300))
      }
    })()
    return () => { cancelPlayRef.current = true }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle selection ──────────────────────────────────────────────────────
  function toggleKey(key: string) {
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
        body: JSON.stringify({ group_id: 'g8', letter_targets: selectedKeys }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      const segs = parseG8Segments(text, selectedKeys)
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
      const target = targets[idx]
      if (!target) return prev
      if (prev[idx]?.toLowerCase() === target.silent.toLowerCase()) return prev

      const correct = char.toLowerCase() === target.silent.toLowerCase()

      if (correct) {
        const next = [...prev]
        next[idx] = target.silent
        playTTS(target.word).catch(() => {})
        setTimeout(() => {
          const nextIdx = next.findIndex((v, i) => i > idx && targets[i] && v?.toLowerCase() !== targets[i].silent.toLowerCase())
          if (nextIdx !== -1) inputRefs.current[nextIdx]?.focus()
        }, 100)
        return next
      }

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

  // ── Shared UI ─────────────────────────────────────────────────────────────
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

  const legend = selectedKeys.length > 1 && (
    <div className={styles.legend}>
      {selectedKeys.map((key, i) => (
        <span key={key} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }} />
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
          <span className={styles.groupLabel}>{t.exercises.g8name}</span>
          {formatToggle}
        </div>
        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g8selectHint}</p>
          <p className={styles.selectedCount}>
            {t.exercises.g8selectedCount.replace('{count}', String(selectedKeys.length))}
          </p>

          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.silentGrid}>
            {SILENT_DEFS.map(def => {
              const sel = selectedKeys.includes(def.key)
              const selIdx = selectedKeys.indexOf(def.key)
              const color = sel ? COLORS[selIdx % COLORS.length] : undefined
              return (
                <button
                  key={def.key}
                  className={`${styles.silentCard} ${sel ? styles.silentCardSelected : ''}`}
                  style={sel ? { borderColor: color, background: color + '33' } : undefined}
                  onClick={() => toggleKey(def.key)}
                  disabled={!sel && selectedKeys.length >= 4}
                >
                  <span className={styles.silentLabel}>{def.label}</span>
                  <span className={styles.silentExample}>{def.example}</span>
                </button>
              )
            })}
          </div>

          <button
            className={styles.startBtn}
            onClick={loadText}
            disabled={selectedKeys.length === 0}
          >
            {t.exercises.g8startBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>{closeBtn}<span className={styles.groupLabel}>{t.exercises.g8name}</span>{formatToggle}</div>
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
        <div className={styles.topbar}><span className={styles.groupLabel}>{t.exercises.g8name}</span>{formatToggle}</div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
            {segments.map((seg, i) => {
              if (seg.type === 'text') return <span key={i}>{seg.content}</span>
              return (
                <span key={i}>
                  <span>{seg.prefix}</span>
                  <span style={{ color: seg.color, fontWeight: 600 }}>{seg.silent}</span>
                  <span>{seg.suffix}</span>
                </span>
              )
            })}
          </p>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={loadText}>{t.exercises.again}</button>
            <button className={styles.actionBtn} onClick={restart}>{t.exercises.g8anotherEl}</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>{t.exercises.toExercises}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── SHOW / FADE / RECALL ──────────────────────────────────────────────────
  const filledCount = values.filter((v, i) => v?.toLowerCase() === targets[i]?.silent.toLowerCase()).length

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        {closeBtn}
        <span className={styles.groupLabel}>{t.exercises.g8name}</span>
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
            const filled = values[idx]?.toLowerCase() === seg.silent.toLowerCase()
            const isShaking = shaking.has(idx)
            const showHint = hints.has(idx) && !filled
            const bgColor = seg.color + '55'

            // SHOW phase
            if (phase === 'show') {
              return (
                <span key={i}>
                  <span className={styles.wordStem} onClick={() => playTTS(seg.word)}>{seg.prefix}</span>
                  <span className={styles.highlight} style={{ background: bgColor }} onClick={() => playTTS(seg.word)}>{seg.silent}</span>
                  <span className={styles.wordStem} onClick={() => playTTS(seg.word)}>{seg.suffix}</span>
                </span>
              )
            }

            // FADE phase
            if (phase === 'fade') {
              return (
                <span key={i}>
                  <span>{seg.prefix}</span>
                  {fadeStep === 0 && <span className={styles.highlight} style={{ background: bgColor }}>{seg.silent}</span>}
                  {fadeStep === 1 && <span className={styles.fadeDots}>{'•'}</span>}
                  {fadeStep === 2 && <span className={styles.fadeEmpty}>{'\u00A0'}</span>}
                  <span>{seg.suffix}</span>
                </span>
              )
            }

            // RECALL — filled
            if (filled) {
              return (
                <span key={i}>
                  <span>{seg.prefix}</span>
                  <span className={styles.filledSilent} style={{ color: seg.color }}>{values[idx]}</span>
                  <span>{seg.suffix}</span>
                </span>
              )
            }

            // RECALL — unfilled
            return (
              <span key={i} className={styles.recallWord}>
                <span>{seg.prefix}</span>
                <span
                  className={`${styles.gapWrap} ${isShaking ? styles.gapShake : ''}`}
                  onClick={() => inputRefs.current[idx]?.focus()}
                >
                  {showHint && <span className={styles.hintChar}>{seg.silent}</span>}
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
                  <span className={styles.gap}>{'\u00A0'}</span>
                </span>
                <span>{seg.suffix}</span>
              </span>
            )
          })}
        </p>

        {phase === 'show' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g8showHint}</p>
            <button className={styles.readyBtn} onClick={startFade}>{t.exercises.g8readyBtn}</button>
          </div>
        )}

        {phase === 'recall' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g8recallHint}</p>
            <p className={styles.filledCount}>
              {t.exercises.g8filledCount
                .replace('{current}', String(filledCount))
                .replace('{total}', String(targets.length))}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

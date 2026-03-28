'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import { usePreferences } from '@/lib/hooks/usePreferences'
import styles from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'show' | 'fade' | 'recall' | 'complete'
type FadeStep = 0 | 1 | 2

type Segment =
  | { type: 'text'; content: string }
  | { type: 'target'; prefix: string; rest: string; prefixKey: string; color: string; idx: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const PREFIX_COLORS = ['#D4AA38', '#7A9AB8', '#C06A30', '#4EAA78']

const PREFIX_DEFS = [
  { key: 're',    display: 're-/ré-', ipa: '[rə/re]',   example: 'refaire',      variants: ['ré', 're'] },
  { key: 'dé',    display: 'dé-',     ipa: '[de]',       example: 'défaire',      variants: ['dés', 'dé'] },
  { key: 'in',    display: 'in-/im-', ipa: '[ɛ̃/ɪm]',   example: 'impossible',   variants: ['im', 'il', 'ir', 'in'] },
  { key: 'pré',   display: 'pré-',    ipa: '[pre]',      example: 'prévoir',      variants: ['pré', 'pre'] },
  { key: 'sur',   display: 'sur-',    ipa: '[syr]',      example: 'surtout',      variants: ['sur'] },
  { key: 'sous',  display: 'sous-',   ipa: '[su]',       example: 'soulever',     variants: ['sous'] },
  { key: 'trans', display: 'trans-',  ipa: '[tʁɑ̃s]',   example: 'transformer',  variants: ['trans'] },
  { key: 'anti',  display: 'anti-',   ipa: '[ɑ̃ti]',    example: 'antique',      variants: ['anti'] },
] as const

// ── Segment parser ────────────────────────────────────────────────────────────
function parseG11Segments(text: string, selectedKeys: string[]): Segment[] {
  const active: Array<{ variants: string[]; key: string; color: string }> = []
  selectedKeys.forEach((key, colorIdx) => {
    const def = PREFIX_DEFS.find(d => d.key === key)
    if (!def) return
    // Sort variants longest-first so 'pré' matches before 'pre', 'dés' before 'dé', etc.
    const sorted = [...def.variants].sort((a, b) => b.length - a.length)
    active.push({ variants: sorted, key, color: PREFIX_COLORS[colorIdx % PREFIX_COLORS.length] })
  })

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

    for (const { variants, key, color } of active) {
      for (const variant of variants) {
        // Must start with variant AND have at least 3 more chars (real root present)
        if (lower.startsWith(variant) && lower.length >= variant.length + 3) {
          segments.push({
            type: 'target',
            prefix: token.slice(0, variant.length),
            rest: token.slice(variant.length),
            prefixKey: key,
            color,
            idx: targetIdx++,
          })
          matched = true
          break
        }
      }
      if (matched) break
    }

    if (!matched) segments.push({ type: 'text', content: token })
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
export default function G11Page() {
  const router = useRouter()
  const t = useT()
  const { prefs } = usePreferences()
  useTrackExercise('g11', 'Начала и приставки', '/exercises/g11')
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
    () => targets.length > 0 && targets.every((tgt, i) => values[i]?.toLowerCase() === tgt.prefix.toLowerCase()),
    [targets, values]
  )

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout) }, [])

  // ── Focus first input + apply immediate hints on recall ───────────────────
  useEffect(() => {
    if (phase === 'recall') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      if (prefs.hintThreshold === 0) {
        setHints(new Set(targets.map((_, i) => i)))
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-complete ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (allFilled && phase === 'recall') setTimeout(() => setPhase('complete'), 600)
  }, [allFilled, phase])

  // ── Auto-play prefix sounds on show ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'show' || selectedKeys.length === 0) return
    cancelPlayRef.current = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 600))
      for (const key of selectedKeys) {
        if (cancelPlayRef.current) break
        const def = PREFIX_DEFS.find(d => d.key === key)
        if (def) await playTTS(def.variants[0])
        if (!cancelPlayRef.current) await new Promise(r => setTimeout(r, 350))
      }
    })()
    return () => { cancelPlayRef.current = true }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle prefix selection ────────────────────────────────────────────────
  function togglePrefix(key: string) {
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
        body: JSON.stringify({ group_id: 'g11', letter_targets: selectedKeys }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      const segs = parseG11Segments(text, selectedKeys)
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
      if (!target || currentTyped.toLowerCase() === target.prefix.toLowerCase()) return prev

      const expectedChar = target.prefix[currentTyped.length]
      const correct = char.toLowerCase() === expectedChar.toLowerCase()

      if (correct) {
        const newTyped = currentTyped + expectedChar
        const next = [...prev]
        next[idx] = newTyped

        if (newTyped.toLowerCase() === target.prefix.toLowerCase()) {
          playTTS(target.prefix + target.rest).catch(() => {})
          setTimeout(() => {
            const nextIdx = next.findIndex((v, i) => i > idx && targets[i] && v.toLowerCase() !== targets[i].prefix.toLowerCase())
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
        const threshold = prefs.hintThreshold === 0 ? 1 : prefs.hintThreshold
        if (ne[idx] >= threshold) setHints(h => new Set([...h, idx]))
        return ne
      })
      return prev
    })
  }, [targets, prefs.hintThreshold])

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

  // ── Shared UI bits ────────────────────────────────────────────────────────
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

  // Legend for 2+ selected prefixes
  const legend = selectedKeys.length > 1 && (
    <div className={styles.legend}>
      {selectedKeys.map((key, i) => {
        const def = PREFIX_DEFS.find(d => d.key === key)
        return (
          <span key={key} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: PREFIX_COLORS[i % PREFIX_COLORS.length] }} />
            <span className={styles.legendText}>{def?.display}</span>
            <span className={styles.legendIpa}>{def?.ipa}</span>
          </span>
        )
      })}
    </div>
  )

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {closeBtn}
          <span className={styles.groupLabel}>{t.exercises.g11name}</span>
          {formatToggle}
        </div>
        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g11selectHint}</p>
          <p className={styles.selectedCount}>
            {t.exercises.g11selectedCount.replace('{count}', String(selectedKeys.length))}
          </p>

          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.prefixGrid}>
            {PREFIX_DEFS.map(def => {
              const sel = selectedKeys.includes(def.key)
              const selIdx = selectedKeys.indexOf(def.key)
              const color = sel ? PREFIX_COLORS[selIdx % PREFIX_COLORS.length] : undefined
              return (
                <button
                  key={def.key}
                  className={`${styles.prefixCard} ${sel ? styles.prefixCardSelected : ''}`}
                  style={sel ? { borderColor: color, background: color + '33' } : undefined}
                  onClick={() => togglePrefix(def.key)}
                  disabled={!sel && selectedKeys.length >= 4}
                >
                  <span className={styles.prefixDisplay}>{def.display}</span>
                  <span className={styles.prefixExample}>{def.example}</span>
                  <span className={styles.prefixIpa}>{def.ipa}</span>
                </button>
              )
            })}
          </div>

          <button
            className={styles.startBtn}
            onClick={loadText}
            disabled={selectedKeys.length === 0}
          >
            {t.exercises.g11startBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>{closeBtn}<span className={styles.groupLabel}>{t.exercises.g11name}</span>{formatToggle}</div>
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
        <div className={styles.topbar}><span className={styles.groupLabel}>{t.exercises.g11name}</span>{formatToggle}</div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
            {segments.map((seg, i) => {
              if (seg.type === 'text') return <span key={i}>{seg.content}</span>
              return (
                <span key={i}>
                  <span style={{ color: seg.color, fontWeight: 600 }}>{seg.prefix}</span>
                  <span>{seg.rest}</span>
                </span>
              )
            })}
          </p>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={loadText}>{t.exercises.again}</button>
            <button className={styles.actionBtn} onClick={restart}>{t.exercises.g11anotherEl}</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>{t.exercises.toExercises}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── SHOW / FADE / RECALL ──────────────────────────────────────────────────
  const filledCount = values.filter((v, i) => v?.toLowerCase() === targets[i]?.prefix.toLowerCase()).length

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        {closeBtn}
        <span className={styles.groupLabel}>{t.exercises.g11name}</span>
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
            const showHint = hints.has(idx) && typed.toLowerCase() !== seg.prefix.toLowerCase()
            const fullyFilled = typed.toLowerCase() === seg.prefix.toLowerCase()
            const bgColor = seg.color + '55'

            // SHOW phase
            if (phase === 'show') {
              return (
                <span key={i}>
                  <span
                    className={styles.highlight}
                    style={{ background: bgColor }}
                    onClick={() => playTTS(seg.prefix + seg.rest)}
                  >
                    {seg.prefix}
                  </span>
                  <span
                    className={styles.wordRest}
                    onClick={() => playTTS(seg.prefix + seg.rest)}
                  >
                    {seg.rest}
                  </span>
                </span>
              )
            }

            // FADE phase
            if (phase === 'fade') {
              return (
                <span key={i}>
                  {fadeStep === 0 && <span className={styles.highlight} style={{ background: bgColor }}>{seg.prefix}</span>}
                  {fadeStep === 1 && <span className={styles.fadeDots}>{'•'.repeat(seg.prefix.length)}</span>}
                  {fadeStep === 2 && <span className={styles.fadeEmpty}>{'\u00A0'.repeat(seg.prefix.length)}</span>}
                  <span>{seg.rest}</span>
                </span>
              )
            }

            // RECALL phase — fully filled
            if (fullyFilled) {
              return (
                <span key={i}>
                  <span className={styles.filledPrefix} style={{ color: seg.color }}>{typed}</span>
                  <span>{seg.rest}</span>
                </span>
              )
            }

            // RECALL phase — not yet filled
            const remaining = seg.prefix.slice(typed.length)
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
                <span>{seg.rest}</span>
              </span>
            )
          })}
        </p>

        {phase === 'show' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g11showHint}</p>
            <button className={styles.readyBtn} onClick={startFade}>{t.exercises.g11readyBtn}</button>
          </div>
        )}

        {phase === 'recall' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>
              {t.exercises.g11filledCount
                .replace('{current}', String(filledCount))
                .replace('{total}', String(targets.length))}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

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
  | { type: 'target'; content: string; idx: number }

// ── Constants ──────────────────────────────────────────────────────────────────
const TRIPLES = [
  // Сложные гласные
  'eau', 'ieu', 'oeu', 'oui', 'aie', 'oie', 'uai', 'uei',
  // Назальные + гласные с окончанием
  'ain', 'ein', 'ien', 'ion', 'oin', 'uin', 'oir', 'eur',
  // Полугласные окончания
  'ier', 'ail', 'eil', 'uil', 'aux', 'eux', 'oux',
  // Согласные кластеры
  'gue', 'gui', 'que', 'qui', 'sch', 'tch', 'chr', 'phr',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseSegments(text: string, triple: string): Segment[] {
  const pattern = new RegExp(escapeRegExp(triple), 'gi')
  const segments: Segment[] = []
  let lastIdx = 0
  let targetIdx = 0

  for (const match of text.matchAll(pattern)) {
    if (match.index! > lastIdx) {
      segments.push({ type: 'text', content: text.slice(lastIdx, match.index!) })
    }
    segments.push({ type: 'target', content: match[0], idx: targetIdx++ })
    lastIdx = match.index! + match[0].length
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIdx) })
  }
  return segments
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G3Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g3', 'Тройки букв', '/exercises/g3')
  const { format, setFormat } = useTextFormat()
  const { prefs } = usePreferences()

  const [phase, setPhase] = useState<Phase>('select')
  const [triple, setTriple] = useState('')
  const [segments, setSegments] = useState<Segment[]>([])
  const [fadeStep, setFadeStep] = useState<FadeStep>(0)
  const [values, setValues] = useState<string[]>([])
  const [partials, setPartials] = useState<string[]>([])
  const [errors, setErrors] = useState<number[]>([])
  const [shaking, setShaking] = useState<Set<number>>(new Set())
  const [hints, setHints] = useState<Set<number>>(new Set())
  const [errorMsg, setErrorMsg] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const fadeTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const composingRef = useRef<boolean[]>([])

  const targets = useMemo(
    () => segments.filter((s): s is Extract<Segment, { type: 'target' }> => s.type === 'target'),
    [segments]
  )
  const allFilled = values.length > 0 && values.every(Boolean)

  useEffect(() => {
    return () => { fadeTimers.current.forEach(clearTimeout) }
  }, [])

  useEffect(() => {
    if (phase === 'recall') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      if (prefs.hintThreshold === 0) {
        setHints(new Set(targets.map((_, i) => i)))
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (allFilled && phase === 'recall') {
      setTimeout(() => setPhase('complete'), 600)
    }
  }, [allFilled, phase])

  // ── Triple selection ────────────────────────────────────────────────────────
  async function handleSelectTriple(tr: string) {
    setTriple(tr)
    setPhase('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g3', letter_targets: [tr] }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''

      if (!text) throw new Error('empty')

      const segs = parseSegments(text, tr)
      const tgts = segs.filter(s => s.type === 'target')
      if (tgts.length === 0) throw new Error('no targets')

      inputRefs.current = new Array(tgts.length).fill(null)
      composingRef.current = new Array(tgts.length).fill(false)
      setSegments(segs)
      setValues(new Array(tgts.length).fill(''))
      setPartials(new Array(tgts.length).fill(''))
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

  // ── Fade sequence ──────────────────────────────────────────────────────────
  function startFade() {
    fadeTimers.current.forEach(clearTimeout)
    setPhase('fade')
    setFadeStep(0)
    fadeTimers.current = [
      setTimeout(() => setFadeStep(1), 1000),
      setTimeout(() => setFadeStep(2), 2200),
      setTimeout(() => setPhase('recall'), 3000),
    ]
  }

  // ── Input handling (3-char triples) ────────────────────────────────────────
  const handleTripleInput = useCallback((idx: number, typed: string) => {
    const expected = targets[idx]?.content ?? ''
    if (!typed) return

    const expectedLower = expected.toLowerCase()
    const typedLower = typed.toLowerCase()

    if (!expectedLower.startsWith(typedLower)) {
      setShaking(prev => new Set([...prev, idx]))
      setTimeout(() => setShaking(prev => { const n = new Set(prev); n.delete(idx); return n }), 400)
      setPartials(prev => { const n = [...prev]; n[idx] = ''; return n })
      setErrors(prev => {
        const next = [...prev]
        next[idx]++
        const threshold = prefs.hintThreshold === 0 ? 1 : prefs.hintThreshold
        if (next[idx] >= threshold) setHints(h => new Set([...h, idx]))
        return next
      })
      return
    }

    if (typed.length < expected.length) {
      setPartials(prev => { const n = [...prev]; n[idx] = typed; return n })
      return
    }

    setValues(prev => {
      const next = [...prev]
      next[idx] = expected
      return next
    })
    setPartials(prev => { const n = [...prev]; n[idx] = ''; return n })

    setTimeout(() => {
      const nextIdx = values.findIndex((v, i) => i > idx && !v)
      if (nextIdx !== -1) inputRefs.current[nextIdx]?.focus()
    }, 0)
  }, [targets, values])

  // ── Restart ─────────────────────────────────────────────────────────────────
  function restart() {
    setPhase('select')
    setTriple('')
    setSegments([])
    setValues([])
    setPartials([])
    setErrors([])
    setHints(new Set())
    setShaking(new Set())
    setErrorMsg('')
  }

  // ── Format toggle ──────────────────────────────────────────────────────────
  const formatToggle = (
    <div className={styles.formatToggle}>
      <button
        className={`${styles.formatBtn} ${format === 'normal' ? styles.formatBtnActive : ''}`}
        onClick={() => setFormat('normal')}
      >
        Аа
      </button>
      <button
        className={`${styles.formatBtn} ${styles.formatBtnLarge} ${format === 'adapted' ? styles.formatBtnActive : ''}`}
        onClick={() => setFormat('adapted')}
      >
        Аа
      </button>
    </div>
  )

  // ── Render: select ─────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => router.push('/exercises')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.groupLabel}>{t.exercises.g3name}</span>
          {formatToggle}
        </div>

        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g3selectPrompt}</p>
          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.tripleGrid}>
            {TRIPLES.map(tr => (
              <button key={tr} className={styles.tripleBtn} onClick={() => handleSelectTriple(tr)}>
                {tr}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: loading ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={restart}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.groupLabel}>{t.exercises.g3name} · {triple}</span>
          {formatToggle}
        </div>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t.exercises.loading}</p>
        </div>
      </div>
    )
  }

  // ── Render: complete ───────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <span className={styles.groupLabel}>{t.exercises.g3name} · {triple}</span>
          {formatToggle}
        </div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <div className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
            {segments.map((seg, i) =>
              seg.type === 'text'
                ? <span key={i}>{seg.content}</span>
                : <span key={i} className={styles.targetDone}>{seg.content}</span>
            )}
          </div>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={() => handleSelectTriple(triple)}>
              {t.exercises.again}
            </button>
            <button className={styles.actionBtn} onClick={restart}>
              {t.exercises.g3anotherEl}
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>
              {t.exercises.toExercises}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: show / fade / recall ───────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={restart}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className={styles.groupLabel}>{t.exercises.g3name} · {triple}</span>
        <div className={styles.topbarRight}>
          {formatToggle}
          <button className={styles.skipBtn} onClick={() => setPhase('complete')}>
            {t.exercises.skip}
          </button>
        </div>
      </div>

      <div className={styles.exerciseWrap}>
        <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
          {segments.map((seg, i) => {
            if (seg.type === 'text') return <span key={i}>{seg.content}</span>

            const idx = seg.idx
            const filled = values[idx]
            const partial = partials[idx] ?? ''
            const isShaking = shaking.has(idx)
            const showHint = hints.has(idx) && !filled

            if (phase === 'show') {
              return <span key={i} className={styles.highlight}>{seg.content}</span>
            }

            if (phase === 'fade') {
              if (fadeStep === 0) return <span key={i} className={styles.highlight}>{seg.content}</span>
              if (fadeStep === 1) return <span key={i} className={styles.fadeDots}>{'•'.repeat(seg.content.length)}</span>
              return <span key={i} className={styles.fadeEmpty}>{'\u00A0'.repeat(seg.content.length)}</span>
            }

            if (filled) {
              return <span key={i} className={styles.filledTriple}>{filled}</span>
            }

            return (
              <span
                key={i}
                className={`${styles.gapWrap} ${isShaking ? styles.gapShake : ''}`}
                onClick={() => inputRefs.current[idx]?.focus()}
              >
                {showHint && <span className={styles.hintChar}>{seg.content[0]}</span>}
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
                    const typed = partial + e.data
                    e.currentTarget.value = ''
                    handleTripleInput(idx, typed)
                  }}
                  onKeyDown={e => {
                    if (composingRef.current[idx]) return
                    if (e.key.length === 1) {
                      e.preventDefault()
                      handleTripleInput(idx, partial + e.key)
                    }
                  }}
                  onChange={e => {
                    if (composingRef.current[idx]) return
                    const char = e.target.value.slice(-1)
                    if (char) { handleTripleInput(idx, partial + char); e.target.value = '' }
                  }}
                  aria-label={`Пропуск ${idx + 1}`}
                />
                <span className={styles.gap}>{partial || '\u00A0\u00A0\u00A0'}</span>
              </span>
            )
          })}
        </p>

        {phase === 'show' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g3showHint}</p>
            <button className={styles.readyBtn} onClick={startFade}>
              {t.exercises.readyBtn}
            </button>
          </div>
        )}

        {phase === 'recall' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g3recallHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

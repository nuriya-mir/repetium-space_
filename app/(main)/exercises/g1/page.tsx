'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import { usePreferences } from '@/lib/hooks/usePreferences'
import styles from './page.module.css'

// ── Types ────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'show' | 'fade' | 'recall' | 'complete'
type FadeStep = 0 | 1 | 2  // 0=highlighted, 1=dots, 2=empty

type Segment =
  | { type: 'text'; content: string }
  | { type: 'target'; content: string; idx: number }

// ── Constants ─────────────────────────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const DIACRITICS = ['à', 'â', 'æ', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ü', 'ÿ']

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseSegments(text: string, letter: string): Segment[] {
  const isDiacritic = DIACRITICS.includes(letter.toLowerCase())
  const pattern = isDiacritic
    ? new RegExp(escapeRegExp(letter), 'g')
    : new RegExp(escapeRegExp(letter), 'gi')

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

function isCorrectInput(typed: string, expected: string, isDiacritic: boolean): boolean {
  if (isDiacritic) return typed === expected
  return typed.toLowerCase() === expected.toLowerCase()
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G1Page() {
  const router = useRouter()
  const t = useT()
  const { format, setFormat } = useTextFormat()
  const { prefs } = usePreferences()
  useTrackExercise('g1', 'Одна буква', '/exercises/g1')

  const [phase, setPhase] = useState<Phase>('select')
  const [letter, setLetter] = useState('')
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

  const targets = useMemo(
    () => segments.filter((s): s is Extract<Segment, { type: 'target' }> => s.type === 'target'),
    [segments]
  )
  const allFilled = values.length > 0 && values.every(Boolean)
  const isDiacritic = DIACRITICS.includes(letter.toLowerCase())

  // ── Cleanup timers ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { fadeTimers.current.forEach(clearTimeout) }
  }, [])

  // ── Focus first input when entering recall ──────────────────────────────────
  useEffect(() => {
    if (phase === 'recall') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      // hintThreshold=0: show all hints immediately
      if (prefs.hintThreshold === 0) {
        setHints(new Set(targets.map((_, i) => i)))
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Complete when all filled ─────────────────────────────────────────────────
  useEffect(() => {
    if (allFilled && phase === 'recall') {
      setTimeout(() => setPhase('complete'), 600)
    }
  }, [allFilled, phase])

  // ── Letter selection ─────────────────────────────────────────────────────────
  async function handleSelectLetter(l: string) {
    setLetter(l)
    setPhase('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g1', letter_targets: [l] }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''

      if (!text) throw new Error('empty')

      const segs = parseSegments(text, l)
      const tgts = segs.filter(s => s.type === 'target')
      if (tgts.length === 0) throw new Error('no targets')

      inputRefs.current = new Array(tgts.length).fill(null)
      composingRef.current = new Array(tgts.length).fill(false)
      setSegments(segs)
      setValues(new Array(tgts.length).fill(''))
      setErrors(new Array(tgts.length).fill(0))
      setHints(new Set())
      setShaking(new Set())
      setFadeStep(0)
      setPhase('show')
    } catch {
      setErrorMsg('Не удалось загрузить текст. Проверьте подключение.')
      setPhase('select')
    }
  }

  // ── Fade sequence ────────────────────────────────────────────────────────────
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

  // ── Input handling ───────────────────────────────────────────────────────────
  const handleKeyInput = useCallback((idx: number, char: string) => {
    if (!char || values[idx]) return
    const expected = targets[idx]?.content ?? ''
    const correct = isCorrectInput(char, expected, isDiacritic)

    if (correct) {
      setValues(prev => {
        const next = [...prev]
        next[idx] = expected
        return next
      })
      // Focus next empty
      setTimeout(() => {
        const nextIdx = values.findIndex((v, i) => i > idx && !v)
        if (nextIdx !== -1) inputRefs.current[nextIdx]?.focus()
        // If all filled, completion handled by useEffect
      }, 0)
    } else {
      setShaking(prev => new Set([...prev, idx]))
      setTimeout(() => setShaking(prev => { const n = new Set(prev); n.delete(idx); return n }), 400)
      setErrors(prev => {
        const next = [...prev]
        next[idx]++
        const threshold = prefs.hintThreshold === 0 ? 1 : prefs.hintThreshold
        if (next[idx] >= threshold) {
          setHints(h => new Set([...h, idx]))
        }
        return next
      })
    }
  }, [values, targets, isDiacritic])

  // ── Restart ──────────────────────────────────────────────────────────────────
  function restart() {
    setPhase('select')
    setLetter('')
    setSegments([])
    setValues([])
    setErrors([])
    setHints(new Set())
    setShaking(new Set())
    setErrorMsg('')
  }

  // ── Format toggle ─────────────────────────────────────────────────────────────
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

  // ── Render: select ───────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => router.push('/exercises')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.groupLabel}>Одна буква</span>
          {formatToggle}
        </div>

        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>Выбери букву</p>

          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.letterGrid}>
            {ALPHABET.map(l => (
              <button key={l} className={styles.letterBtn} onClick={() => handleSelectLetter(l)}>
                {l}
              </button>
            ))}
          </div>

          <p className={styles.diacriticLabel}>С диакритикой</p>
          <div className={styles.diacriticGrid}>
            {DIACRITICS.map(l => (
              <button key={l} className={styles.letterBtn} onClick={() => handleSelectLetter(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: loading ───────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={restart}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.groupLabel}>Одна буква · {letter}</span>
          {formatToggle}
        </div>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Генерируем текст…</p>
        </div>
      </div>
    )
  }

  // ── Render: complete ──────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <span className={styles.groupLabel}>Одна буква · {letter}</span>
          {formatToggle}
        </div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>Готово</p>
          <div className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
            {segments.map((seg, i) =>
              seg.type === 'text'
                ? <span key={i}>{seg.content}</span>
                : <span key={i} className={styles.targetDone}>{seg.content}</span>
            )}
          </div>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={() => handleSelectLetter(letter)}>
              Ещё раз
            </button>
            <button className={styles.actionBtn} onClick={restart}>
              Другая буква
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>
              К упражнениям
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: show / fade / recall ──────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={restart}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className={styles.groupLabel}>Одна буква · {letter}</span>
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
            const isShaking = shaking.has(idx)
            const showHint = hints.has(idx) && !filled

            // Show phase
            if (phase === 'show') {
              return <span key={i} className={styles.highlight}>{seg.content}</span>
            }

            // Fade phase
            if (phase === 'fade') {
              if (fadeStep === 0) return <span key={i} className={styles.highlight}>{seg.content}</span>
              if (fadeStep === 1) return <span key={i} className={styles.fadeDots}>{'•'.repeat(seg.content.length)}</span>
              return <span key={i} className={styles.fadeEmpty}>{'\u00A0'.repeat(seg.content.length)}</span>
            }

            // Recall phase
            if (filled) {
              return <span key={i} className={styles.filledLetter}>{filled}</span>
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
                    const char = e.data
                    e.currentTarget.value = ''
                    if (char) handleKeyInput(idx, char)
                  }}
                  onKeyDown={e => {
                    if (composingRef.current[idx]) return
                    if (e.key.length === 1) {
                      e.preventDefault()
                      handleKeyInput(idx, e.key)
                    }
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
            )
          })}
        </p>

        {phase === 'show' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>Запомни выделенные буквы</p>
            <button className={styles.readyBtn} onClick={startFade}>
              Готов
            </button>
          </div>
        )}

        {phase === 'recall' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>Введи пропущенные буквы</p>
          </div>
        )}
      </div>
    </div>
  )
}

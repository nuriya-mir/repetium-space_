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
type TargetLetter = 'c' | 'g' | 's' | 'h' | 'x'
type ContextKey = 'c_k' | 'c_s' | 'g_g' | 'g_ʒ' | 's_s' | 's_z' | 'h_muet' | 'h_aspiré' | 'x_ks' | 'x_gz'

interface ContextMeta {
  context: ContextKey
  color: string
  ttsText: string
  label: string
}

type Segment =
  | { type: 'text'; content: string }
  | { type: 'target'; content: string; idx: number; meta: ContextMeta }

// ── Constants ─────────────────────────────────────────────────────────────────
const TARGET_LETTERS: TargetLetter[] = ['c', 'g', 's', 'h', 'x']

const CONTEXT_META: Record<ContextKey, Omit<ContextMeta, 'context'>> = {
  'c_k':      { color: '#7FB3D8', ttsText: 'ca',       label: '[k]' },
  'c_s':      { color: '#E8A598', ttsText: 'ci',       label: '[s]' },
  'g_g':      { color: '#8BC8A0', ttsText: 'ga',       label: '[g]' },
  'g_ʒ':      { color: '#B8A9D4', ttsText: 'gi',       label: '[ʒ]' },
  's_s':      { color: '#E8D48B', ttsText: 'sa',       label: '[s]' },
  's_z':      { color: '#7EC8B8', ttsText: 'aise',     label: '[z]' },
  'h_muet':   { color: '#A0B8C8', ttsText: 'heure',    label: 'muet' },
  'h_aspiré': { color: '#E8C8A0', ttsText: 'haricot',  label: 'aspiré' },
  'x_ks':     { color: '#88B8D8', ttsText: 'axe',      label: '[ks]' },
  'x_gz':     { color: '#D8A8B8', ttsText: 'exemple',  label: '[gz]' },
}

const LETTER_INFO: Record<TargetLetter, { ctx1: ContextKey; ctx2: ContextKey; ex1: string; ex2: string }> = {
  c: { ctx1: 'c_k', ctx2: 'c_s', ex1: 'calme', ex2: 'ciel' },
  g: { ctx1: 'g_g', ctx2: 'g_ʒ', ex1: 'grand', ex2: 'gentil' },
  s: { ctx1: 's_s', ctx2: 's_z', ex1: 'soleil', ex2: 'rose' },
  h: { ctx1: 'h_muet', ctx2: 'h_aspiré', ex1: 'heure', ex2: 'héros' },
  x: { ctx1: 'x_ks', ctx2: 'x_gz', ex1: 'taxi', ex2: 'examen' },
}

// Common h aspiré words (block liaison / elision)
const H_ASPIRE = new Set([
  'haricot', 'haricots', 'hasard', 'hasards', 'haut', 'haute', 'hauts', 'hautes',
  'hauteur', 'hauteurs', 'heros', 'hibou', 'hiboux', 'honte', 'hontes', 'hoquet',
  'hanche', 'hanches', 'hamster', 'hamsters', 'harpe', 'harpes', 'hair',
  'hardi', 'hardie', 'hockey', 'homard', 'homards', 'hurler', 'hutte', 'huttes',
  'hache', 'haches', 'haine', 'haines', 'halt', 'hameau', 'hameaux',
  'hangar', 'hangars', 'hanneton', 'hannetons', 'haro', 'harfang',
])

const HINT_AFTER_ERRORS = 3

// ── Context helpers ───────────────────────────────────────────────────────────
function isVowel(ch: string): boolean {
  return 'aeiouyàâæéèêëîïôœùûüÿ'.includes(ch)
}

function getCContext(word: string, position: number): 'k' | 's' {
  const next = word[position + 1]?.toLowerCase()
  return next && ['e', 'i', 'y'].includes(next) ? 's' : 'k'
}

function getGContext(word: string, position: number): 'g' | 'ʒ' {
  const next = word[position + 1]?.toLowerCase()
  return next && ['e', 'i', 'y'].includes(next) ? 'ʒ' : 'g'
}

function getSContext(word: string, position: number): 's' | 'z' {
  const prev = word[position - 1]?.toLowerCase()
  const next = word[position + 1]?.toLowerCase()
  if (prev === 's' || next === 's') return 's'
  if (prev && next && isVowel(prev) && isVowel(next)) return 'z'
  return 's'
}

function getHContext(word: string): 'muet' | 'aspiré' {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '')
  return H_ASPIRE.has(lower) ? 'aspiré' : 'muet'
}

function getXContext(word: string, position: number): 'ks' | 'gz' {
  if (position === 1 && word[0]?.toLowerCase() === 'e') {
    const next = word[position + 1]?.toLowerCase()
    if (next && isVowel(next)) return 'gz'
  }
  return 'ks'
}

function getContext(letter: TargetLetter, word: string, position: number): string {
  switch (letter) {
    case 'c': return getCContext(word, position)
    case 'g': return getGContext(word, position)
    case 's': return getSContext(word, position)
    case 'h': return getHContext(word)
    case 'x': return getXContext(word, position)
  }
}

// ── Segment parser ────────────────────────────────────────────────────────────
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseG6Segments(text: string, letter: TargetLetter): Segment[] {
  const segments: Segment[] = []
  let targetIdx = 0
  const tokens = text.match(/[a-zA-ZÀ-ÿœæ]+|[^a-zA-ZÀ-ÿœæ]+/g) ?? []

  for (const token of tokens) {
    if (!/[a-zA-ZÀ-ÿœæ]/.test(token)) {
      segments.push({ type: 'text', content: token })
      continue
    }

    const pattern = new RegExp(escapeRegExp(letter), 'gi')
    const matches = [...token.matchAll(pattern)]

    if (matches.length === 0) {
      segments.push({ type: 'text', content: token })
      continue
    }

    let lastPos = 0
    for (const match of matches) {
      const pos = match.index!
      if (pos > lastPos) segments.push({ type: 'text', content: token.slice(lastPos, pos) })
      const ctx = getContext(letter, token, pos)
      const contextKey = `${letter}_${ctx}` as ContextKey
      segments.push({
        type: 'target',
        content: match[0],
        idx: targetIdx++,
        meta: { context: contextKey, ...CONTEXT_META[contextKey] },
      })
      lastPos = pos + match[0].length
    }
    if (lastPos < token.length) segments.push({ type: 'text', content: token.slice(lastPos) })
  }
  return segments
}

// ── Context balance validation ────────────────────────────────────────────────
function hasContextBalance(segments: Segment[], letter: TargetLetter): boolean {
  const info = LETTER_INFO[letter]
  const tgts = segments.filter((s): s is Extract<Segment, { type: 'target' }> => s.type === 'target')
  const n1 = tgts.filter(t => t.meta.context === info.ctx1).length
  const n2 = tgts.filter(t => t.meta.context === info.ctx2).length
  const total = n1 + n2
  if (total < 6) return false
  return Math.min(n1, n2) / total >= 0.3
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
  } catch {
    // TTS unavailable — silent skip
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G6Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g6', 'Контекстные чтения', '/exercises/g6')
  const { format, setFormat } = useTextFormat()

  const [phase, setPhase] = useState<Phase>('select')
  const [letter, setLetter] = useState<TargetLetter>('c')
  const [segments, setSegments] = useState<Segment[]>([])
  const [fadeStep, setFadeStep] = useState<FadeStep>(0)
  const [values, setValues] = useState<string[]>([])
  const [errors, setErrors] = useState<number[]>([])
  const [shaking, setShaking] = useState<Set<number>>(new Set())
  const [hints, setHints] = useState<Set<number>>(new Set())
  const [filledColors, setFilledColors] = useState<(string | null)[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const fadeTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const composingRef = useRef<boolean[]>([])
  const showCancelRef = useRef(false)

  const targets = useMemo(
    () => segments.filter((s): s is Extract<Segment, { type: 'target' }> => s.type === 'target'),
    [segments]
  )
  const allFilled = values.length > 0 && values.every(Boolean)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout) }, [])

  // ── Focus first input on recall ───────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'recall') setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }, [phase])

  // ── Auto-complete when all filled ─────────────────────────────────────────────
  useEffect(() => {
    if (allFilled && phase === 'recall') setTimeout(() => setPhase('complete'), 600)
  }, [allFilled, phase])

  // ── Auto-play both sounds when entering show phase ────────────────────────────
  useEffect(() => {
    if (phase !== 'show') return
    showCancelRef.current = false
    const info = LETTER_INFO[letter]
    const m1 = CONTEXT_META[info.ctx1]
    const m2 = CONTEXT_META[info.ctx2]
    ;(async () => {
      await new Promise(r => setTimeout(r, 700))
      if (showCancelRef.current) return
      await playTTS(m1.ttsText)
      if (showCancelRef.current) return
      await new Promise(r => setTimeout(r, 500))
      if (showCancelRef.current) return
      await playTTS(m2.ttsText)
    })()
    return () => { showCancelRef.current = true }
  }, [phase, letter])

  // ── Load text ─────────────────────────────────────────────────────────────────
  async function loadText(l: TargetLetter, step = 1) {
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g6', letter_targets: [l], difficulty_step: step }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      let segs = parseG6Segments(text, l)

      // Retry once with different cache key if context balance is off
      if (!hasContextBalance(segs, l) && step === 1) {
        const res2 = await fetch('/api/generate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: 'g6', letter_targets: [l], difficulty_step: 2 }),
        })
        const data2 = await res2.json()
        const text2: string = data2.content ?? ''
        if (text2) segs = parseG6Segments(text2, l)
      }

      const tgts = segs.filter(s => s.type === 'target')
      if (tgts.length === 0) throw new Error('no targets')

      inputRefs.current = new Array(tgts.length).fill(null)
      composingRef.current = new Array(tgts.length).fill(false)
      setSegments(segs)
      setValues(new Array(tgts.length).fill(''))
      setErrors(new Array(tgts.length).fill(0))
      setFilledColors(new Array(tgts.length).fill(null))
      setHints(new Set())
      setShaking(new Set())
      setFadeStep(0)
      setPhase('show')
    } catch {
      setErrorMsg(t.exercises.loadError)
      setPhase('select')
    }
  }

  // ── Select letter ─────────────────────────────────────────────────────────────
  async function handleSelectLetter(l: TargetLetter) {
    setLetter(l)
    setPhase('loading')
    setErrorMsg('')
    await loadText(l)
  }

  // ── Replay ────────────────────────────────────────────────────────────────────
  async function replay() {
    setPhase('loading')
    setErrorMsg('')
    await loadText(letter)
  }

  // ── Fade sequence ─────────────────────────────────────────────────────────────
  function startFade() {
    showCancelRef.current = true
    fadeTimers.current.forEach(clearTimeout)
    setPhase('fade')
    setFadeStep(0)
    fadeTimers.current = [
      setTimeout(() => setFadeStep(1), 1000),
      setTimeout(() => setFadeStep(2), 2200),
      setTimeout(() => setPhase('recall'), 3000),
    ]
  }

  // ── Input handling ────────────────────────────────────────────────────────────
  const handleKeyInput = useCallback((idx: number, char: string) => {
    if (!char) return
    setValues(prev => {
      if (prev[idx]) return prev
      const target = targets[idx]
      if (!target) return prev
      const correct = char.toLowerCase() === target.content.toLowerCase()

      if (correct) {
        const next = [...prev]
        next[idx] = target.content
        setFilledColors(fc => {
          const nfc = [...fc]
          nfc[idx] = target.meta.color
          return nfc
        })
        playTTS(target.meta.ttsText).catch(() => {})
        setTimeout(() => {
          const nextIdx = next.findIndex((v, i) => i > idx && !v)
          if (nextIdx !== -1) inputRefs.current[nextIdx]?.focus()
        }, 0)
        return next
      }

      setShaking(s => new Set([...s, idx]))
      setTimeout(() => setShaking(s => { const n = new Set(s); n.delete(idx); return n }), 400)
      setErrors(e => {
        const ne = [...e]
        ne[idx]++
        if (ne[idx] >= HINT_AFTER_ERRORS) setHints(h => new Set([...h, idx]))
        return ne
      })
      return prev
    })
  }, [targets])

  // ── Restart ───────────────────────────────────────────────────────────────────
  function restart() {
    showCancelRef.current = true
    fadeTimers.current.forEach(clearTimeout)
    setPhase('select')
    setSegments([])
    setValues([])
    setErrors([])
    setHints(new Set())
    setShaking(new Set())
    setFilledColors([])
    setErrorMsg('')
  }

  // ── Format toggle ─────────────────────────────────────────────────────────────
  const formatToggle = (
    <div className={styles.formatToggle}>
      <button
        className={`${styles.formatBtn} ${format === 'normal' ? styles.formatBtnActive : ''}`}
        onClick={() => setFormat('normal')}
      >Аа</button>
      <button
        className={`${styles.formatBtn} ${styles.formatBtnLarge} ${format === 'adapted' ? styles.formatBtnActive : ''}`}
        onClick={() => setFormat('adapted')}
      >Аа</button>
    </div>
  )

  const info = LETTER_INFO[letter]
  const m1 = CONTEXT_META[info?.ctx1 ?? 'c_k']
  const m2 = CONTEXT_META[info?.ctx2 ?? 'c_s']

  // ── Legend ────────────────────────────────────────────────────────────────────
  const legend = (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: m1.color }} />
        <span className={styles.legendText}>{letter} = {m1.label}</span>
        <span className={styles.legendEx}>{info?.ex1}</span>
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: m2.color }} />
        <span className={styles.legendText}>{letter} = {m2.label}</span>
        <span className={styles.legendEx}>{info?.ex2}</span>
      </span>
    </div>
  )

  const backSvg = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )

  // ── SELECT ────────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => router.push('/exercises')}>
            {backSvg}
          </button>
          <span className={styles.groupLabel}>{t.exercises.g6name}</span>
          {formatToggle}
        </div>

        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g6selectHint}</p>
          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.letterCards}>
            {TARGET_LETTERS.map(l => {
              const li = LETTER_INFO[l]
              const lm1 = CONTEXT_META[li.ctx1]
              const lm2 = CONTEXT_META[li.ctx2]
              return (
                <button key={l} className={styles.letterCard} onClick={() => handleSelectLetter(l)}>
                  <span className={styles.letterCardLetter}>{l}</span>
                  <span className={styles.letterCardContexts}>
                    <span style={{ color: lm1.color }}>{lm1.label}</span>
                    <span className={styles.letterCardSlash}> / </span>
                    <span style={{ color: lm2.color }}>{lm2.label}</span>
                  </span>
                  <span className={styles.letterCardExamples}>
                    {li.ex1} · {li.ex2}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={restart}>{backSvg}</button>
          <span className={styles.groupLabel}>{t.exercises.g6name} · {letter}</span>
          {formatToggle}
        </div>
        <div className={styles.centerWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t.exercises.loading}</p>
        </div>
      </div>
    )
  }

  // ── COMPLETE ──────────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <span className={styles.groupLabel}>{t.exercises.g6name} · {letter}</span>
          {formatToggle}
        </div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
            {segments.map((seg, i) => {
              if (seg.type === 'text') return <span key={i}>{seg.content}</span>
              const color = filledColors[seg.idx] ?? seg.meta.color
              return (
                <span key={i} className={styles.filledLetter} style={{ color }}>
                  {seg.content}
                </span>
              )
            })}
          </p>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={replay}>
              {t.exercises.again}
            </button>
            <button className={styles.actionBtn} onClick={restart}>
              {t.exercises.g6anotherEl}
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>
              {t.exercises.toExercises}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── SHOW / FADE / RECALL ──────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={restart}>{backSvg}</button>
        <span className={styles.groupLabel}>{t.exercises.g6name} · {letter}</span>
        <div className={styles.topbarRight}>
          {formatToggle}
          <button className={styles.skipBtn} onClick={() => setPhase('complete')}>
            {t.exercises.skip}
          </button>
        </div>
      </div>

      <div className={styles.exerciseWrap}>
        {(phase === 'show' || phase === 'fade') && legend}

        <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
          {segments.map((seg, i) => {
            if (seg.type === 'text') return <span key={i}>{seg.content}</span>

            const idx = seg.idx
            const filled = values[idx]
            const isShaking = shaking.has(idx)
            const showHint = hints.has(idx) && !filled
            const bgColor = seg.meta.color + '55'

            if (phase === 'show') {
              return (
                <span
                  key={i}
                  className={styles.highlight}
                  style={{ background: bgColor }}
                  onClick={() => playTTS(seg.meta.ttsText)}
                >
                  {seg.content}
                </span>
              )
            }

            if (phase === 'fade') {
              if (fadeStep === 0)
                return <span key={i} className={styles.highlight} style={{ background: bgColor }}>{seg.content}</span>
              if (fadeStep === 1)
                return <span key={i} className={styles.fadeDots}>{'•'.repeat(seg.content.length)}</span>
              return <span key={i} className={styles.fadeEmpty}>{'\u00A0'.repeat(seg.content.length)}</span>
            }

            // recall
            if (filled) {
              return (
                <span
                  key={i}
                  className={styles.filledLetter}
                  style={{ color: filledColors[idx] ?? seg.meta.color }}
                >
                  {filled}
                </span>
              )
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
            <p className={styles.showHint}>{t.exercises.g6showHint}</p>
            <button className={styles.readyBtn} onClick={startFade}>
              {t.exercises.g6readyBtn}
            </button>
          </div>
        )}

        {phase === 'recall' && (
          <div className={styles.bottomBar}>
            <p className={styles.showHint}>{t.exercises.g6recallHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

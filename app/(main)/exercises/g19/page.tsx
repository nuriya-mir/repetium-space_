'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'show' | 'collect' | 'complete'

type WordToken = { type: 'word'; content: string; len: number; id: number }
type OtherToken = { type: 'other'; content: string }
type Token = WordToken | OtherToken

const LENGTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const
type Len = typeof LENGTHS[number]

// ── Helpers ───────────────────────────────────────────────────────────────────
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let id = 0
  for (const m of text.matchAll(/([a-zA-ZÀ-ÿœæ]+)|([^a-zA-ZÀ-ÿœæ]+)/g)) {
    if (m[1]) tokens.push({ type: 'word', content: m[1], len: m[1].length, id: id++ })
    else if (m[2]) tokens.push({ type: 'other', content: m[2] })
  }
  return tokens
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G19Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g19', 'Насмотренность', '/exercises/g19')

  const { format, setFormat } = useTextFormat()

  const [phase, setPhase] = useState<Phase>('select')
  const [len, setLen] = useState<Len>(3)
  const [tokens, setTokens] = useState<Token[]>([])
  const [collected, setCollected] = useState<Set<number>>(new Set())
  const [hinted, setHinted] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const dropZoneRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLElement | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const targets = useMemo(
    () => tokens.filter((tok): tok is WordToken => tok.type === 'word' && tok.len === len),
    [tokens, len]
  )

  const uncollected = useMemo(
    () => targets.filter(tok => !collected.has(tok.id)),
    [targets, collected]
  )

  const collectedTokens = useMemo(
    () => targets.filter(tok => collected.has(tok.id)),
    [targets, collected]
  )

  // Auto-complete when all words collected
  useEffect(() => {
    if (targets.length > 0 && uncollected.length === 0 && phase === 'collect') {
      setTimeout(() => setPhase('complete'), 500)
    }
  }, [uncollected.length, targets.length, phase])

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current) }, [])

  // ── Load text ──────────────────────────────────────────────────────────────
  async function load(l: Len) {
    setLen(l)
    setPhase('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g19', letter_targets: [String(l)] }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')
      const toks = tokenize(text)
      const tgts = toks.filter(tok => tok.type === 'word' && (tok as WordToken).len === l)
      if (tgts.length === 0) throw new Error('no targets')
      setTokens(toks)
      setCollected(new Set())
      setHinted(false)
      setPhase('show')
    } catch {
      setErrorMsg(t.exercises.loadError)
      setPhase('select')
    }
  }

  // ── Audio ──────────────────────────────────────────────────────────────────
  async function playWord(word: string) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word, lang: 'fr-FR' }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      new Audio(url).play().catch(() => {})
    } catch {}
  }

  // ── Collect word ───────────────────────────────────────────────────────────
  function collectWord(id: number, word: string) {
    setCollected(prev => new Set([...prev, id]))
    playWord(word)
  }

  // ── Hint ───────────────────────────────────────────────────────────────────
  function showHint() {
    if (uncollected.length === 0) return
    setHinted(true)
    hintTimer.current = setTimeout(() => setHinted(false), 2200)
  }

  // ── Drag: Pointer Events (works mouse + touch) ─────────────────────────────
  function onPointerDown(e: React.PointerEvent, tok: WordToken) {
    if (phase !== 'collect' || collected.has(tok.id)) return
    e.preventDefault()

    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    const ghost = el.cloneNode(true) as HTMLElement
    Object.assign(ghost.style, {
      position: 'fixed',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      margin: '0',
      pointerEvents: 'none',
      zIndex: '9999',
      transform: 'scale(1.1)',
      boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
      transition: 'none',
    })
    document.body.appendChild(ghost)
    ghostRef.current = ghost

    setDraggingId(tok.id)
    el.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent, id: number) {
    if (draggingId !== id || !ghostRef.current) return
    ghostRef.current.style.left = (e.clientX - dragOffset.current.x) + 'px'
    ghostRef.current.style.top = (e.clientY - dragOffset.current.y) + 'px'
  }

  function onPointerUp(e: React.PointerEvent, id: number, word: string) {
    if (draggingId !== id) return
    cleanupDrag()

    const zone = dropZoneRef.current
    if (!zone) return
    const r = zone.getBoundingClientRect()
    const inZone = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (inZone) collectWord(id, word)
  }

  function onPointerCancel(id: number) {
    if (draggingId === id) cleanupDrag()
  }

  function cleanupDrag() {
    if (ghostRef.current) { document.body.removeChild(ghostRef.current); ghostRef.current = null }
    setDraggingId(null)
  }

  // ── Restart ────────────────────────────────────────────────────────────────
  function restart() {
    setPhase('select')
    setTokens([])
    setCollected(new Set())
    setHinted(false)
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

  // ── Shared back button ─────────────────────────────────────────────────────
  const backBtn = (
    <button
      className={styles.backBtn}
      onClick={phase === 'select' ? () => router.push('/exercises') : restart}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  // ── Render: select ─────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g19name}</span>
          {formatToggle}
        </div>
        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g19selectPrompt}</p>
          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}
          <div className={styles.lengthRow}>
            <select
              className={styles.lengthSelect}
              value={len}
              onChange={e => setLen(Number(e.target.value) as Len)}
            >
              {LENGTHS.map(l => (
                <option key={l} value={l}>{l} — {t.exercises.g19lengthLabel}</option>
              ))}
            </select>
            <button className={styles.startBtn} onClick={() => load(len)}>
              {t.exercises.g19startBtn}
            </button>
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
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g19name} · {len}</span>
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
          <span className={styles.groupLabel}>{t.exercises.g19name} · {len}</span>
          {formatToggle}
        </div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <div className={styles.completedBox}>
            {targets.map(tok => (
              <span key={tok.id} className={styles.doneChip}>{tok.content}</span>
            ))}
          </div>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={() => load(len)}>
              {t.exercises.again}
            </button>
            <button className={styles.actionBtn} onClick={restart}>
              {t.exercises.g19anotherLen}
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>
              {t.exercises.toExercises}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: show / collect ─────────────────────────────────────────────────
  return (
    <div className={styles.pageFixed}>
      <div className={styles.topbar}>
        {backBtn}
        <span className={styles.groupLabel}>{t.exercises.g19name} · {len}</span>
        <div className={styles.topbarRight}>
          {formatToggle}
          {phase === 'collect' && uncollected.length > 0 && (
            <button className={styles.hintBtn} onClick={showHint}>
              {t.exercises.g19checkBtn}
            </button>
          )}
        </div>
      </div>

      <div className={styles.exerciseArea}>
        <p className={`${styles.exerciseText} ${format === 'adapted' ? styles.exerciseTextAdapted : ''}`}>
          {tokens.map((tok, i) => {
            if (tok.type === 'other') return <span key={i}>{tok.content}</span>

            const isTarget = tok.len === len
            const isCollected = collected.has(tok.id)
            const isDragging = draggingId === tok.id
            const isHinted = hinted && isTarget && !isCollected

            // Show phase
            if (phase === 'show') {
              return isTarget
                ? <span key={i} className={styles.highlightWord}>{tok.content}</span>
                : <span key={i}>{tok.content}</span>
            }

            // Collect phase
            if (isCollected) {
              return <span key={i} className={styles.collectedInText}>{tok.content}</span>
            }
            if (isTarget) {
              return (
                <span
                  key={i}
                  className={`${styles.draggableWord} ${isDragging ? styles.wordDragging : ''} ${isHinted ? styles.wordHinted : ''}`}
                  onPointerDown={e => onPointerDown(e, tok)}
                  onPointerMove={e => onPointerMove(e, tok.id)}
                  onPointerUp={e => onPointerUp(e, tok.id, tok.content)}
                  onPointerCancel={() => onPointerCancel(tok.id)}
                  style={{ touchAction: 'none', userSelect: 'none' }}
                >
                  {tok.content}
                </span>
              )
            }
            return <span key={i}>{tok.content}</span>
          })}
        </p>
      </div>

      {phase === 'show' && (
        <div className={styles.bottomBar}>
          <p className={styles.showHint}>
            {t.exercises.g19showHint} · <strong>{targets.length}</strong>
          </p>
          <button className={styles.readyBtn} onClick={() => setPhase('collect')}>
            {t.exercises.readyBtn}
          </button>
        </div>
      )}

      {phase === 'collect' && (
        <div
          ref={dropZoneRef}
          className={`${styles.dropZone} ${collectedTokens.length > 0 ? styles.dropZoneHasItems : ''}`}
        >
          {collectedTokens.length === 0 ? (
            <p className={styles.dropZonePlaceholder}>{t.exercises.g19collectHint}</p>
          ) : (
            <div className={styles.droppedChips}>
              {collectedTokens.map(tok => (
                <span key={tok.id} className={styles.droppedChip}>{tok.content}</span>
              ))}
            </div>
          )}
          <span className={styles.dropCounter}>{collectedTokens.length}/{targets.length}</span>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'show' | 'match' | 'complete'

interface SleepingPair {
  id: number
  silentWord: string
  awakenWord: string
  sleepingLetter: string
  matched: boolean
}

interface WordCard {
  id: string
  word: string
  pairId: number
  isSilent: boolean
  matched: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LETTER_DEFS = [
  { key: 'd', example: 'grand → grande' },
  { key: 't', example: 'petit → petite' },
  { key: 's', example: 'gris → grise' },
  { key: 'x', example: 'heureux → heureuse' },
  { key: 'p', example: 'loup → louve' },
  { key: 'n', example: 'bon → bonne' },
] as const

const HINT_DELAY = 15000

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function parsePairs(content: string, targetLetter: string): { silentWord: string; awakenWord: string }[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const result: { silentWord: string; awakenWord: string }[] = []

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue
    const parts = line.split(/\s+\/\s+|\//).map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) continue
    const silentWord = parts[0].toLowerCase()
    const awakenWord = parts[1].toLowerCase()
    if (!silentWord || !awakenWord) continue
    if (!silentWord.endsWith(targetLetter.toLowerCase())) continue
    result.push({ silentWord, awakenWord })
  }

  return result.slice(0, 8)
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

// ── Highlight helper ──────────────────────────────────────────────────────────
function renderWordWithHighlight(
  word: string,
  sleepingLetter: string,
  isSilent: boolean,
  highlightClass: string
): React.ReactNode {
  if (isSilent) {
    const stem = word.slice(0, -1)
    const last = word.slice(-1)
    return (
      <>
        <span>{stem}</span>
        <span className={highlightClass}>{last}</span>
      </>
    )
  }
  const parts: React.ReactNode[] = []
  for (let i = 0; i < word.length; i++) {
    if (word[i].toLowerCase() === sleepingLetter.toLowerCase()) {
      parts.push(<span key={i} className={highlightClass}>{word[i]}</span>)
    } else {
      parts.push(word[i])
    }
  }
  return <>{parts}</>
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G9Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g9', 'Спящие буквы', '/exercises/g9')
  const { format, setFormat } = useTextFormat()

  const [phase, setPhase] = useState<Phase>('select')
  const [selectedLetter, setSelectedLetter] = useState<string>('')
  const [pairs, setPairs] = useState<SleepingPair[]>([])
  const [cards, setCards] = useState<WordCard[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [shakingCardId, setShakingCardId] = useState<string | null>(null)
  const [hintPairId, setHintPairId] = useState<number | null>(null)
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const cancelAudioRef = useRef(false)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Hint timer ───────────────────────────────────────────────────────────
  const resetHintTimer = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHintPairId(null)
    hintTimerRef.current = setTimeout(() => {
      setPairs(prev => {
        const unmatched = prev.filter(p => !p.matched)
        if (unmatched.length > 0) {
          const pick = unmatched[Math.floor(Math.random() * unmatched.length)]
          setHintPairId(pick.id)
        }
        return prev
      })
    }, HINT_DELAY)
  }, [])

  useEffect(() => {
    if (phase === 'match') resetHintTimer()
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current) }
  }, [phase, resetHintTimer])

  // ── Auto-complete ────────────────────────────────────────────────────────
  useEffect(() => {
    if (matchedCount > 0 && matchedCount === pairs.length && phase === 'match') {
      setTimeout(() => setPhase('complete'), 600)
    }
  }, [matchedCount, pairs.length, phase])

  // ── Load pairs ───────────────────────────────────────────────────────────
  async function loadPairs() {
    if (!selectedLetter) return
    cancelAudioRef.current = true
    setPhase('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g9', letter_targets: [selectedLetter] }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      const rawPairs = parsePairs(text, selectedLetter)
      if (rawPairs.length < 6) throw new Error('too few pairs')

      const thePairs: SleepingPair[] = rawPairs.slice(0, 8).map((p, i) => ({
        id: i,
        silentWord: p.silentWord,
        awakenWord: p.awakenWord,
        sleepingLetter: selectedLetter,
        matched: false,
      }))

      const allCards: WordCard[] = []
      thePairs.forEach(p => {
        allCards.push({ id: `${p.id}-silent`, word: p.silentWord, pairId: p.id, isSilent: true, matched: false })
        allCards.push({ id: `${p.id}-awaken`, word: p.awakenWord, pairId: p.id, isSilent: false, matched: false })
      })
      const shuffled = shuffle(allCards)

      setPairs(thePairs)
      setCards(shuffled)
      setMatchedCount(0)
      setHintPairId(null)
      cancelAudioRef.current = false
      setPhase('show')
    } catch {
      setErrorMsg(t.exercises.loadError)
      setPhase('select')
    }
  }

  // ── Match handler ────────────────────────────────────────────────────────
  function handleMatch(draggedId: string, targetId: string) {
    if (draggedId === targetId) return

    const draggedCard = cards.find(c => c.id === draggedId)
    const targetCard = cards.find(c => c.id === targetId)

    if (!draggedCard || !targetCard) return
    if (draggedCard.matched || targetCard.matched) return

    if (draggedCard.pairId === targetCard.pairId) {
      // Correct match
      setCards(prev => prev.map(c =>
        c.id === draggedId || c.id === targetId ? { ...c, matched: true } : c
      ))
      setPairs(prev => prev.map(p =>
        p.id === draggedCard.pairId ? { ...p, matched: true } : p
      ))
      setMatchedCount(prev => prev + 1)
      resetHintTimer()

      // Play TTS: silent → pause → awaken
      const pair = pairs.find(p => p.id === draggedCard.pairId)
      if (pair) {
        cancelAudioRef.current = false
        ;(async () => {
          await playTTS(pair.silentWord)
          await new Promise(r => setTimeout(r, 400))
          if (!cancelAudioRef.current) await playTTS(pair.awakenWord)
        })()
      }
    } else {
      // Wrong match — shake the dragged card
      setShakingCardId(draggedId)
      setTimeout(() => setShakingCardId(null), 420)
    }
  }

  // ── Drag (pointer events) ────────────────────────────────────────────────
  function startDrag(e: React.PointerEvent, cardId: string) {
    e.preventDefault()
    const chipEl = e.currentTarget as HTMLElement
    const rect = chipEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    const card = cards.find(c => c.id === cardId)
    if (!card) return

    const ghost = document.createElement('div')
    ghost.textContent = card.word
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      padding: 8px 16px;
      border-radius: 10px;
      font-family: var(--font-read);
      font-size: 1.3rem;
      background: #FEFEFE;
      border: 1.5px solid #CCC;
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      opacity: 0.95;
      transform: scale(1.05);
      left: ${e.clientX - offsetX}px;
      top: ${e.clientY - offsetY}px;
    `
    document.body.appendChild(ghost)
    ghostRef.current = ghost

    const moveHandler = (ev: PointerEvent) => {
      ghost.style.left = `${ev.clientX - offsetX}px`
      ghost.style.top = `${ev.clientY - offsetY}px`

      // Update hover target
      ghost.style.display = 'none'
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      ghost.style.display = ''
      const closest = (el as HTMLElement)?.closest('[data-card-id]')
      const hoverId = closest?.getAttribute('data-card-id') ?? null
      setHoverTargetId(hoverId !== cardId ? hoverId : null)
    }

    const upHandler = (ev: PointerEvent) => {
      ghost.style.display = 'none'
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      ghost.remove()
      ghostRef.current = null
      setHoverTargetId(null)
      document.removeEventListener('pointermove', moveHandler)
      document.removeEventListener('pointerup', upHandler)

      const closest = (el as HTMLElement)?.closest('[data-card-id]')
      const targetId = closest?.getAttribute('data-card-id')
      if (targetId && targetId !== cardId) {
        handleMatch(cardId, targetId)
      }
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

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {closeBtn}
          <span className={styles.groupLabel}>{t.exercises.g9name}</span>
          {formatToggle}
        </div>
        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g9selectHint}</p>

          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.letterGrid}>
            {LETTER_DEFS.map(def => {
              const sel = selectedLetter === def.key
              return (
                <button
                  key={def.key}
                  className={`${styles.letterCard} ${sel ? styles.letterCardSelected : ''}`}
                  onClick={() => setSelectedLetter(def.key)}
                >
                  <span className={styles.letterKey}>{def.key}</span>
                  <span className={styles.letterExample}>{def.example}</span>
                </button>
              )
            })}
          </div>

          <button
            className={styles.startBtn}
            onClick={loadPairs}
            disabled={!selectedLetter}
          >
            {t.exercises.g9startBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>{closeBtn}<span className={styles.groupLabel}>{t.exercises.g9name}</span>{formatToggle}</div>
        <div className={styles.centerWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t.exercises.loading}</p>
        </div>
      </div>
    )
  }

  // ── SHOW ──────────────────────────────────────────────────────────────────
  if (phase === 'show') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {closeBtn}
          <span className={styles.groupLabel}>{t.exercises.g9name}</span>
          {formatToggle}
        </div>
        <div className={styles.pairsWrap}>
          <p className={styles.showHint}>{t.exercises.g9showHint}</p>
          {pairs.map((pair, index) => (
            <div
              key={pair.id}
              className={styles.pairRow}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <button
                className={`${styles.pairWord} ${format === 'adapted' ? styles.pairWordAdapted : ''}`}
                onClick={() => playTTS(pair.silentWord)}
              >
                {renderWordWithHighlight(pair.silentWord, pair.sleepingLetter, true, styles.sleepingChar)}
              </button>
              <span className={styles.pairArrow}>→</span>
              <button
                className={`${styles.pairWord} ${format === 'adapted' ? styles.pairWordAdapted : ''}`}
                onClick={() => playTTS(pair.awakenWord)}
              >
                {renderWordWithHighlight(pair.awakenWord, pair.sleepingLetter, false, styles.sleepingChar)}
              </button>
            </div>
          ))}
        </div>
        <div className={styles.bottomBar}>
          <button className={styles.readyBtn} onClick={() => { cancelAudioRef.current = true; setPhase('match') }}>
            {t.exercises.g9readyBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}><span className={styles.groupLabel}>{t.exercises.g9name}</span>{formatToggle}</div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <div className={styles.completePairsGrid}>
            {pairs.map(pair => (
              <div key={pair.id} className={styles.matchedPairRow}>
                <span className={`${styles.matchedWord} ${format === 'adapted' ? styles.matchedWordAdapted : ''}`}>
                  {renderWordWithHighlight(pair.silentWord, pair.sleepingLetter, true, styles.sleepingChar)}
                </span>
                <span className={styles.matchedArrow}>→</span>
                <span className={`${styles.matchedWord} ${format === 'adapted' ? styles.matchedWordAdapted : ''}`}>
                  {renderWordWithHighlight(pair.awakenWord, pair.sleepingLetter, false, styles.sleepingChar)}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={loadPairs}>{t.exercises.again}</button>
            <button className={styles.actionBtn} onClick={() => setPhase('select')}>{t.exercises.g9anotherLetter}</button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>{t.exercises.toExercises}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── MATCH ─────────────────────────────────────────────────────────────────
  const unmatchedCards = cards.filter(c => !c.matched)
  const matchedPairs = pairs.filter(p => p.matched)

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        {closeBtn}
        <span className={styles.groupLabel}>{t.exercises.g9name}</span>
        {formatToggle}
      </div>
      <div className={styles.matchWrap}>
        <p className={styles.matchHint}>{t.exercises.g9matchHint}</p>
        <p className={styles.matchProgress}>
          {t.exercises.g9matchedCount
            .replace('{current}', String(matchedCount))
            .replace('{total}', String(pairs.length))}
        </p>

        {/* Unmatched cards pool */}
        <div className={styles.cardsPool}>
          {unmatchedCards.map(card => {
            const isShaking = shakingCardId === card.id
            const isHint = hintPairId === card.pairId
            const isTarget = hoverTargetId === card.id
            return (
              <span
                key={card.id}
                data-card-id={card.id}
                className={`${styles.wordChip}
                  ${format === 'adapted' ? styles.wordChipAdapted : ''}
                  ${isShaking ? styles.wordChipShake : ''}
                  ${isHint ? styles.wordChipHint : ''}
                  ${isTarget ? styles.wordChipTarget : ''}
                `}
                onPointerDown={e => startDrag(e, card.id)}
              >
                {renderWordWithHighlight(card.word, selectedLetter, card.isSilent, styles.sleepingChar)}
              </span>
            )
          })}
        </div>

        {/* Matched pairs area */}
        {matchedPairs.length > 0 && (
          <div className={styles.matchedArea}>
            {matchedPairs.map(pair => (
              <div key={pair.id} className={styles.matchedPairRow}>
                <span className={`${styles.matchedWord} ${format === 'adapted' ? styles.matchedWordAdapted : ''}`}>
                  {renderWordWithHighlight(pair.silentWord, pair.sleepingLetter, true, styles.sleepingChar)}
                </span>
                <span className={styles.matchedArrow}>→</span>
                <span className={`${styles.matchedWord} ${format === 'adapted' ? styles.matchedWordAdapted : ''}`}>
                  {renderWordWithHighlight(pair.awakenWord, pair.sleepingLetter, false, styles.sleepingChar)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

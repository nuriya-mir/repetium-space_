'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './GuessActivity.module.css'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type Mode = 'choice' | 'drag' | 'keyboard'
type AnswerState = 'idle' | 'correct' | 'wrong'

function randomLetter(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
}

function buildChoices(letter: string): string[] {
  const pool = ALPHABET.filter((l) => l !== letter)
  const picks: string[] = []
  const used = new Set<string>()
  while (picks.length < 5) {
    const p = pool[Math.floor(Math.random() * pool.length)]
    if (!used.has(p)) { used.add(p); picks.push(p) }
  }
  return shuffle([letter, ...picks])
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function playAudio(letter: string, onDone?: () => void) {
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: letter }),
  })
    .then((r) => r.json())
    .then(({ url }) => { if (url) { new Audio(url).play(); onDone?.() } })
    .catch(() => { onDone?.() })
}

interface Props {
  onClose: () => void
}

export function GuessActivity({ onClose }: Props) {
  const t = useT()

  const [mode, setMode] = useState<Mode>('choice')
  const [letter, setLetter] = useState(() => randomLetter())
  const [choices, setChoices] = useState<string[]>(() => buildChoices(letter))
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  // Drag (mode 2)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [dropState, setDropState] = useState<AnswerState>('idle')
  const dragRef = useRef<{ letter: string; startX: number; startY: number; moving: boolean } | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // ── Auto-play on new letter ──────────────────────────────────────────────
  useEffect(() => {
    setIsPlaying(true)
    playAudio(letter, () => setIsPlaying(false))
  }, [letter])

  // ── Auto-advance after correct answer ────────────────────────────────────
  useEffect(() => {
    if (answerState === 'correct' || dropState === 'correct') {
      const t = setTimeout(() => nextRound(), 1400)
      return () => clearTimeout(t)
    }
  }, [answerState, dropState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Next round ────────────────────────────────────────────────────────────
  const nextRound = useCallback(() => {
    const l = randomLetter()
    setLetter(l)
    setChoices(buildChoices(l))
    setAnswerState('idle')
    setDropState('idle')
    setWrongKey(null)
    setErrorCount(0)
    setShowHint(false)
    setInputValue('')
    setDragging(null)
  }, [])

  // ── Mode switch ───────────────────────────────────────────────────────────
  function switchMode(m: Mode) {
    setMode(m)
    setAnswerState('idle')
    setDropState('idle')
    setWrongKey(null)
    setInputValue('')
  }

  // ── Handle answer (choice + keyboard) ────────────────────────────────────
  function handleAnswer(answer: string) {
    if (answerState !== 'idle') return
    const upper = answer.toUpperCase()
    if (upper === letter) {
      setAnswerState('correct')
    } else {
      setWrongKey(upper)
      setAnswerState('wrong')
      const next = errorCount + 1
      setErrorCount(next)
      if (next >= 2) setShowHint(true)
      setTimeout(() => {
        setWrongKey(null)
        setAnswerState('idle')
      }, 500)
    }
  }

  // ── Keyboard mode: single char input ─────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.slice(-1)
    setInputValue(val)
    if (val) handleAnswer(val)
  }

  // ── Drag (mode 2) ─────────────────────────────────────────────────────────
  function handleDragPointerDown(e: React.PointerEvent, token: string) {
    if (dropState !== 'idle') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { letter: token, startX: e.clientX, startY: e.clientY, moving: false }
  }

  function handleDragPointerMove(e: React.PointerEvent, token: string) {
    const d = dragRef.current
    if (!d || d.letter !== token) return
    const dist = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY)
    if (dist > 6) d.moving = true
    if (d.moving) {
      setDragging(token)
      setDragPos({ x: e.clientX, y: e.clientY })
    }
  }

  function handleDragPointerUp(e: React.PointerEvent, token: string) {
    const d = dragRef.current
    if (!d || d.letter !== token) return
    if (d.moving && dragging) {
      const zone = dropZoneRef.current
      if (zone) {
        const r = zone.getBoundingClientRect()
        const hit = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        if (hit) {
          if (token === letter) {
            setDropState('correct')
          } else {
            setDropState('wrong')
            setTimeout(() => setDropState('idle'), 500)
          }
        }
      }
      setDragging(null)
    }
    dragRef.current = null
  }

  // ── Replay TTS ────────────────────────────────────────────────────────────
  function handleReplay() {
    if (isPlaying) return
    setIsPlaying(true)
    playAudio(letter, () => setIsPlaying(false))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const done = answerState === 'correct' || dropState === 'correct'

  return (
    <div className={styles.wrap}>
      {/* Mode toggle */}
      <div className={styles.modeToggle}>
        {(['choice', 'drag', 'keyboard'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ''}`}
            onClick={() => switchMode(m)}
          >
            {t.letters.house1[`guessMode${m.charAt(0).toUpperCase()}${m.slice(1)}` as 'guessModeChoice']}
          </button>
        ))}
      </div>

      {/* Play button */}
      <button
        className={`${styles.playBtn} ${isPlaying ? styles.playBtnPlaying : ''} ${done ? styles.playBtnDone : ''}`}
        onClick={handleReplay}
        aria-label={t.letters.house1.guessReplay}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <p className={styles.prompt}>{t.letters.house1.guessPrompt}</p>

      {/* ── Mode 1: Choice buttons ── */}
      {mode === 'choice' && (
        <div className={styles.choices}>
          {choices.map((ch) => (
            <button
              key={ch}
              className={[
                styles.choiceBtn,
                answerState === 'correct' && ch === letter ? styles.choiceBtnCorrect : '',
                wrongKey === ch ? styles.choiceBtnWrong : '',
              ].join(' ')}
              onClick={() => handleAnswer(ch)}
              disabled={answerState !== 'idle'}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {/* ── Mode 2: Drag to zone ── */}
      {mode === 'drag' && (
        <div className={styles.dragMode}>
          <div
            ref={dropZoneRef}
            className={[
              styles.dropZone,
              dropState === 'correct' ? styles.dropZoneCorrect : '',
              dropState === 'wrong' ? styles.dropZoneWrong : '',
            ].join(' ')}
          >
            {dropState === 'correct'
              ? <span className={styles.dropZoneLetter}>{letter}</span>
              : <span className={styles.dropZoneHint}>{t.letters.house1.guessDragHere}</span>
            }
          </div>
          <div className={styles.dragTokens}>
            {choices.map((ch) => (
              <div
                key={ch}
                className={[
                  styles.dragToken,
                  dragging === ch ? styles.dragTokenDragging : '',
                ].join(' ')}
                onPointerDown={(e) => handleDragPointerDown(e, ch)}
                onPointerMove={(e) => handleDragPointerMove(e, ch)}
                onPointerUp={(e) => handleDragPointerUp(e, ch)}
              >
                {ch}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Mode 3: Keyboard ── */}
      {mode === 'keyboard' && (
        <div className={styles.keyboardMode}>
          <div className={[
            styles.inputWrap,
            answerState === 'correct' ? styles.inputWrapCorrect : '',
            answerState === 'wrong' ? styles.inputWrapWrong : '',
          ].join(' ')}>
            <input
              className={styles.letterInput}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              maxLength={1}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="_"
              disabled={answerState === 'correct'}
            />
          </div>
          {showHint && (
            <p className={styles.hint}>{t.letters.house1.guessHint}: {letter}</p>
          )}
        </div>
      )}

      {/* Replay button */}
      <button className={styles.replayBtn} onClick={handleReplay} disabled={isPlaying}>
        {t.letters.house1.guessReplay}
      </button>

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.guessClose}
        </Button>
      </div>

      {/* Drag ghost */}
      {dragging && (
        <div
          className={styles.ghost}
          style={{ left: dragPos.x, top: dragPos.y }}
          aria-hidden="true"
        >
          {dragging}
        </div>
      )}
    </div>
  )
}

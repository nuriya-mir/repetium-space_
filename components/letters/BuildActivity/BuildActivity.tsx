'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './BuildActivity.module.css'

function playAudio(letter: string) {
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: letter }),
  })
    .then((r) => r.json())
    .then(({ url }) => { if (url) new Audio(url).play() })
    .catch(() => {})
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const WIDE = new Set(['M', 'W'])

function shuffle(arr: string[]): string[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Props {
  onClose: () => void
}

export function BuildActivity({ onClose }: Props) {
  const t = useT()

  const [tray, setTray] = useState<string[]>(() => shuffle(ALPHABET))
  const [placed, setPlaced] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [wrongCell, setWrongCell] = useState<string | null>(null)
  const [hintLetter, setHintLetter] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)

  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const dragRef = useRef<{ letter: string; startX: number; startY: number; moving: boolean } | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placedRef = useRef(placed)
  placedRef.current = placed

  const allPlaced = placed.size === 26

  // ── Hint timer ──────────────────────────────────────────────────────────────
  const startHintTimer = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current)
    setHintLetter(null)
    hintTimer.current = setTimeout(() => {
      const unplaced = ALPHABET.filter((l) => !placedRef.current.has(l))
      if (unplaced.length > 0) {
        setHintLetter(unplaced[Math.floor(Math.random() * unplaced.length)])
      }
    }, 12000)
  }, [])

  useEffect(() => {
    startHintTimer()
    return () => { if (hintTimer.current) clearTimeout(hintTimer.current) }
  }, [startHintTimer])

  // ── Core placement logic ────────────────────────────────────────────────────
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  function tryPlace(targetLetter: string, sourceLetter: string) {
    if (placedRef.current.has(targetLetter)) return
    if (targetLetter === sourceLetter) {
      setPlaced((prev) => new Set([...prev, targetLetter]))
      setTray((prev) => prev.filter((l) => l !== sourceLetter))
      setSelected(null)
      setHintLetter(null)
      startHintTimer()
      if (!mutedRef.current) playAudio(targetLetter)
    } else {
      setWrongCell(targetLetter)
      setTimeout(() => setWrongCell(null), 500)
    }
  }

  // ── Cell click (tap-to-place) ───────────────────────────────────────────────
  function handleCellClick(letter: string) {
    if (placed.has(letter)) return
    if (selected) tryPlace(letter, selected)
  }

  // ── Token tap (select) ──────────────────────────────────────────────────────
  function handleTokenTap(letter: string) {
    setSelected((prev) => (prev === letter ? null : letter))
  }

  // ── Token pointer events (drag) ─────────────────────────────────────────────
  function handleTokenPointerDown(e: React.PointerEvent, letter: string) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { letter, startX: e.clientX, startY: e.clientY, moving: false }
  }

  function handleTokenPointerMove(e: React.PointerEvent, letter: string) {
    const d = dragRef.current
    if (!d || d.letter !== letter) return
    const dist = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY)
    if (dist > 6) {
      d.moving = true
      setDragging(letter)
      setSelected(null)
    }
    if (d.moving) setDragPos({ x: e.clientX, y: e.clientY })
  }

  function handleTokenPointerUp(e: React.PointerEvent, letter: string) {
    const d = dragRef.current
    if (!d || d.letter !== letter) return
    if (d.moving) {
      let found: string | null = null
      for (const [l, el] of Object.entries(cellRefs.current)) {
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          found = l
          break
        }
      }
      if (found) tryPlace(found, letter)
      setDragging(null)
    } else {
      handleTokenTap(letter)
    }
    dragRef.current = null
  }

  // ── Restart ──────────────────────────────────────────────────────────────────
  function handleRestart() {
    setTray(shuffle(ALPHABET))
    setPlaced(new Set())
    setSelected(null)
    setDragging(null)
    setWrongCell(null)
    setHintLetter(null)
    startHintTimer()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className={styles.prompt}>{t.letters.house1.buildPrompt}</p>
        <div className={styles.headerRight}>
          <button
            className={`${styles.muteBtn} ${muted ? styles.muteBtnOff : ''}`}
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? t.letters.house1.buildUnmute : t.letters.house1.buildMute}
            title={muted ? t.letters.house1.buildUnmute : t.letters.house1.buildMute}
          >
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            )}
          </button>
          <span className={styles.counter}>{placed.size} / 26</span>
        </div>
      </div>

      {/* House grid */}
      <div className={styles.houseWrap}>
        <svg className={styles.roofSvg} viewBox="0 0 280 36" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="0,36 140,0 280,36" fill="var(--paper-e)" />
        </svg>
        <div className={styles.houseBody}>
          <div className={styles.grid}>
            {ALPHABET.map((letter) => {
              const isPlaced = placed.has(letter)
              const isWrong = wrongCell === letter
              const isHint = hintLetter === letter && !isPlaced
              const isHighlighted = selected !== null && !isPlaced
              const wide = WIDE.has(letter)

              return (
                <div
                  key={letter}
                  ref={(el) => { cellRefs.current[letter] = el }}
                  className={[
                    styles.cell,
                    wide ? styles.wide : '',
                    isPlaced ? styles.cellPlaced : styles.cellTarget,
                    isWrong ? styles.cellWrong : '',
                    isHint ? styles.cellHint : '',
                    isHighlighted && !isPlaced ? styles.cellHighlighted : '',
                  ].join(' ')}
                  onClick={() => handleCellClick(letter)}
                >
                  {isPlaced
                    ? <span className={styles.cellLetter}>{letter}</span>
                    : <span className={styles.cellEmpty}>{letter}</span>
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Letter tray */}
      {!allPlaced && (
        <div className={styles.tray}>
          {tray.map((letter) => (
            <div
              key={letter}
              className={[
                styles.token,
                selected === letter ? styles.tokenSelected : '',
                dragging === letter ? styles.tokenDragging : '',
              ].join(' ')}
              onClick={() => handleTokenTap(letter)}
              onPointerDown={(e) => handleTokenPointerDown(e, letter)}
              onPointerMove={(e) => handleTokenPointerMove(e, letter)}
              onPointerUp={(e) => handleTokenPointerUp(e, letter)}
            >
              {letter}
            </div>
          ))}
        </div>
      )}

      {/* Completion */}
      {allPlaced && (
        <div className={styles.completion}>
          <p className={styles.completionText}>{t.letters.house1.buildDone}</p>
          <Button variant="primary" size="sm" onClick={handleRestart}>
            {t.letters.house1.buildAgain}
          </Button>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.buildClose}
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

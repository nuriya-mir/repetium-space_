'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './WhereIsActivity.module.css'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const WIDE = new Set(['M', 'W'])
const COUNT = 5

function pickLetters(): string[] {
  const shuffled = [...ALPHABET].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, COUNT)
}

interface Props {
  onClose: () => void
}

export function WhereIsActivity({ onClose }: Props) {
  const t = useT()

  const [letters, setLetters] = useState<string[]>(() => pickLetters())
  const [placed, setPlaced] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [wrongCell, setWrongCell] = useState<string | null>(null)
  const [hintLetter, setHintLetter] = useState<string | null>(null)

  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const dragRef = useRef<{ letter: string; startX: number; startY: number; moving: boolean } | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placedRef = useRef(placed)
  placedRef.current = placed

  const allPlaced = placed.size === letters.length

  // ── Hint timer ──────────────────────────────────────────────────────────────
  const startHintTimer = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current)
    setHintLetter(null)
    hintTimer.current = setTimeout(() => {
      const unplaced = letters.filter((l) => !placedRef.current.has(l))
      if (unplaced.length > 0) {
        setHintLetter(unplaced[Math.floor(Math.random() * unplaced.length)])
      }
    }, 10000)
  }, [letters])

  useEffect(() => {
    startHintTimer()
    return () => { if (hintTimer.current) clearTimeout(hintTimer.current) }
  }, [startHintTimer])

  // ── Core placement logic ────────────────────────────────────────────────────
  function tryPlace(targetLetter: string, sourceLetter: string) {
    if (!letters.includes(targetLetter) || placedRef.current.has(targetLetter)) return
    if (targetLetter === sourceLetter) {
      setPlaced((prev) => new Set([...prev, targetLetter]))
      setSelected(null)
      setHintLetter(null)
      startHintTimer()
    } else {
      setWrongCell(targetLetter)
      setTimeout(() => setWrongCell(null), 500)
    }
  }

  // ── Cell click (tap-to-place) ───────────────────────────────────────────────
  function handleCellClick(letter: string) {
    if (placed.has(letter) || !letters.includes(letter)) return
    if (selected) {
      tryPlace(letter, selected)
    } else {
      // hint: select the cell to highlight which token belongs here
    }
  }

  // ── Token tap (select) ──────────────────────────────────────────────────────
  function handleTokenTap(letter: string) {
    if (placed.has(letter)) return
    setSelected((prev) => (prev === letter ? null : letter))
  }

  // ── Token pointer events (drag) ─────────────────────────────────────────────
  function handleTokenPointerDown(e: React.PointerEvent, letter: string) {
    if (placed.has(letter)) return
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
      // Drop: find cell under pointer
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
    setLetters(pickLetters())
    setPlaced(new Set())
    setSelected(null)
    setDragging(null)
    setWrongCell(null)
    setHintLetter(null)
    startHintTimer()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const remaining = letters.filter((l) => !placed.has(l))

  return (
    <div className={styles.wrap}>
      <p className={styles.prompt}>{t.letters.house1.whereIsPrompt}</p>

      {/* House grid */}
      <div className={styles.houseWrap}>
        <svg className={styles.roofSvg} viewBox="0 0 280 36" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="0,36 140,0 280,36" fill="var(--paper-e)" />
        </svg>
        <div className={styles.houseBody}>
          <div className={styles.grid}>
            {ALPHABET.map((letter) => {
              const isTarget = letters.includes(letter)
              const isPlaced = placed.has(letter)
              const isWrong = wrongCell === letter
              const isHint = hintLetter === letter && !isPlaced
              const isHighlighted = selected !== null && isTarget && !isPlaced
              const wide = WIDE.has(letter)

              if (!isTarget) {
                return (
                  <div
                    key={letter}
                    className={`${styles.placeholder} ${wide ? styles.wide : ''}`}
                  />
                )
              }

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
                    isHighlighted ? styles.cellHighlighted : '',
                  ].join(' ')}
                  onClick={() => handleCellClick(letter)}
                >
                  {isPlaced && <span className={styles.cellLetter}>{letter}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Letter tray */}
      {!allPlaced && (
        <div className={styles.tray}>
          {remaining.map((letter) => (
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
          <p className={styles.completionText}>{t.letters.house1.whereIsDone}</p>
          <Button variant="primary" size="sm" onClick={handleRestart}>
            {t.letters.house1.whereIsAgain}
          </Button>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t.letters.house1.whereIsClose}
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

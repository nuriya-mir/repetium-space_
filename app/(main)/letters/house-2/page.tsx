'use client'

import { useState, useRef, useEffect } from 'react'
import { HouseTabs } from '@/components/layout/HouseTabs'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const WIDE_LETTERS = new Set(['M', 'W'])

type DrawType = 'trace' | 'free'

function drawTemplate(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  letter: string,
) {
  const upper = letter
  const lower = letter.toLowerCase()
  const leftX   = Math.round(canvas.width * 0.28)
  const rightX  = Math.round(canvas.width * 0.72)
  const centerY = Math.round(canvas.height * 0.52)

  const ink4 = getComputedStyle(document.documentElement)
    .getPropertyValue('--ink-4').trim() || '#B8B5AE'

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle  = ink4
  ctx.lineWidth    = 1
  ctx.setLineDash([4, 4])
  ctx.font = '148px Atkinson Hyperlegible, sans-serif'
  ctx.strokeText(upper, leftX, centerY)
  ctx.font = '108px Atkinson Hyperlegible, sans-serif'
  ctx.strokeText(lower, rightX, centerY)
  ctx.setLineDash([])
}

export default function House2Page() {
  const t = useT()
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [drawType, setDrawType] = useState<DrawType>('trace')
  const [hasDrawn, setHasDrawn] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedLetter) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (drawType === 'trace') drawTemplate(ctx, canvas, selectedLetter)
  }, [selectedLetter, drawType])

  function handlePointerDown(e: React.PointerEvent) {
    isDrawing.current = true
    setHasDrawn(true)
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--blue').trim() || '#5A7A9E'
    ctx.lineWidth = 3
    ctx.lineCap   = 'round'
    ctx.lineJoin  = 'round'
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  function handlePointerUp() { isDrawing.current = false }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    setHasDrawn(false)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (selectedLetter && drawType === 'trace') drawTemplate(ctx, canvas, selectedLetter)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.letters.house2.title}</h1>
        <p className={styles.desc}>{t.letters.house2.desc}</p>
      </div>

      <HouseTabs />

      {!selectedLetter ? (
        <div className={styles.houseWrap}>
          <svg
            className={styles.roofSvg}
            viewBox="0 0 280 36"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points="0,36 140,0 280,36" style={{ fill: 'rgba(200,148,42,0.12)' }} />
          </svg>
          <div className={styles.houseBody}>
            <div className={styles.grid}>
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  className={`${styles.cell} ${WIDE_LETTERS.has(letter) ? styles.cellWide : ''}`}
                  onClick={() => { setSelectedLetter(letter); setHasDrawn(false) }}
                  aria-label={letter}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.drawArea}>

          {/* Trace / Free toggle */}
          <div className={styles.drawTypeToggle}>
            <button
              className={`${styles.drawTypeBtn} ${drawType === 'trace' ? styles.drawTypeBtnActive : ''}`}
              onClick={() => setDrawType('trace')}
            >
              {t.letters.house2.trace}
            </button>
            <button
              className={`${styles.drawTypeBtn} ${drawType === 'free' ? styles.drawTypeBtnActive : ''}`}
              onClick={() => setDrawType('free')}
            >
              {t.letters.house2.free}
            </button>
          </div>

          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className={`${styles.canvas} ${drawType === 'free' ? styles.canvasFree : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          <div className={styles.drawActions}>
            <Button variant="ghost" size="sm" onClick={clearCanvas}>
              {t.letters.house2.clear}
            </Button>
            <Button variant="primary" size="sm" onClick={() => {}} disabled={!hasDrawn}>
              {t.letters.house2.save}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setSelectedLetter(null); setHasDrawn(false) }}>
              {t.letters.house2.back}
            </Button>
          </div>

        </div>
      )}
    </div>
  )
}

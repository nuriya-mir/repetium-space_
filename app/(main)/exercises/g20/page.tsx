'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'loading' | 'read' | 'syntagms' | 'mic' | 'review' | 'complete'
type MicState = 'playing' | 'listening' | 'success' | 'fail'

// ── Constants ──────────────────────────────────────────────────────────────────
const SIMILARITY_THRESHOLD = 0.6
const MAX_ATTEMPTS = 3
const PHASE_STEPS: Array<'read' | 'syntagms' | 'mic' | 'review'> = ['read', 'syntagms', 'mic', 'review']

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseSyntagms(text: string): string[] {
  // Split at punctuation + space, keep punctuation with the left fragment
  const marked = text.replace(/([,;.!?:])\s+/g, '$1\n')
  const fragments = marked.split('\n').map(s => s.trim()).filter(Boolean)

  const result: string[] = []
  for (const frag of fragments) {
    const words = frag.split(/\s+/)
    if (words.length <= 5) {
      result.push(frag)
    } else {
      // 3-word chunks for natural syntagm size
      for (let i = 0; i < words.length; i += 3) {
        result.push(words.slice(i, i + 3).join(' '))
      }
    }
  }

  // Merge orphan single-word tails into the previous block
  const merged: string[] = []
  for (const s of result) {
    if (merged.length > 0 && s.split(/\s+/).length === 1) {
      merged[merged.length - 1] += ' ' + s
    } else {
      merged.push(s)
    }
  }
  return merged
}

// Accent-insensitive word overlap score
function wordSimilarity(expected: string, heard: string): number {
  const norm = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean)
  const a = norm(expected)
  const b = norm(heard)
  if (a.length === 0) return 1
  return a.filter(w => b.includes(w)).length / a.length
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function G20Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g20', 'Смысловые блоки', '/exercises/g20')
  const { format, setFormat } = useTextFormat()

  // Core state
  const [phase, setPhase] = useState<Phase>('loading')
  const [text, setText] = useState('')
  const [syntagms, setSyntagms] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // Syntagms phase
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [isPlayingAll, setIsPlayingAll] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playAllRef = useRef(false)

  // Mic phase
  const [micBlockIdx, setMicBlockIdx] = useState(0)
  const [micAttempts, setMicAttempts] = useState(0)
  const [micState, setMicState] = useState<MicState>('playing')
  const micAbortRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // SpeechRecognition availability (client-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const micSupported = typeof window !== 'undefined' && !!(((window as any).SpeechRecognition) || ((window as any).webkitSpeechRecognition))

  useEffect(() => { loadText() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micAbortRef.current = true
      if (recognitionRef.current) { try { recognitionRef.current.abort() } catch { /* ok */ } }
      stopAllAudio()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Text loading ───────────────────────────────────────────────────────────
  async function loadText() {
    setPhase('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g20', letter_targets: [] }),
      })
      const data = await res.json()
      const content: string = data.content ?? ''
      if (!content) throw new Error('empty')
      setText(content)
      setSyntagms(parseSyntagms(content))
      setPhase('read')
    } catch {
      setErrorMsg(t.exercises.loadError)
    }
  }

  // ── Audio utilities ────────────────────────────────────────────────────────
  function stopAllAudio() {
    playAllRef.current = false
    setIsPlayingAll(false)
    setPlayingIdx(null)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }

  async function fetchAndPlayTTS(blockText: string): Promise<void> {
    return new Promise((resolve) => {
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: blockText, lang: 'fr-FR' }),
      })
        .then(r => r.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          let settled = false
          const done = () => {
            if (settled) return
            settled = true
            if (audioRef.current === audio) audioRef.current = null
            URL.revokeObjectURL(url)
            resolve()
          }
          // onpause fires on both explicit pause() and natural end — use it to unblock awaiting code
          audio.onended = done
          audio.onpause = done
          audio.onerror = done
          audio.play().catch(done)
        })
        .catch(() => resolve())
    })
  }

  // ── Syntagms: click-to-toggle ──────────────────────────────────────────────
  async function playBlock(idx: number, blockText: string) {
    if (isPlayingAll) stopAllAudio()
    if (playingIdx === idx) { stopAllAudio(); return }
    stopAllAudio()
    setPlayingIdx(idx)
    await fetchAndPlayTTS(blockText)
    setPlayingIdx(null)
  }

  // ── Syntagms: sequential playback ─────────────────────────────────────────
  async function togglePlayAll() {
    if (isPlayingAll) { stopAllAudio(); return }
    stopAllAudio()
    setIsPlayingAll(true)
    playAllRef.current = true
    for (let i = 0; i < syntagms.length; i++) {
      if (!playAllRef.current) break
      setPlayingIdx(i)
      await fetchAndPlayTTS(syntagms[i])
      setPlayingIdx(null)
      if (!playAllRef.current) break
      await sleep(350)
    }
    playAllRef.current = false
    setIsPlayingAll(false)
    setPlayingIdx(null)
  }

  // ── Mic phase entry ────────────────────────────────────────────────────────
  function enterMicPhase() {
    stopAllAudio()
    micAbortRef.current = false
    setMicBlockIdx(0)
    setMicAttempts(0)
    setMicState('playing')
    setPhase('mic')
    runMicFlow(0, 0)
  }

  // ── Mic flow (recursive async state machine) ───────────────────────────────
  async function runMicFlow(blockIdx: number, attemptNum: number) {
    if (micAbortRef.current || blockIdx >= syntagms.length) {
      if (!micAbortRef.current) setPhase('review')
      return
    }
    setMicBlockIdx(blockIdx)
    setMicAttempts(attemptNum)
    setMicState('playing')

    await fetchAndPlayTTS(syntagms[blockIdx])
    if (micAbortRef.current) return
    await sleep(500)
    if (micAbortRef.current) return

    setMicState('listening')
    const score = await recognizeSpeech(syntagms[blockIdx])
    if (micAbortRef.current) return

    const passed = score >= SIMILARITY_THRESHOLD || attemptNum >= MAX_ATTEMPTS - 1
    setMicState(passed ? 'success' : 'fail')
    await sleep(passed ? 900 : 700)
    if (micAbortRef.current) return

    runMicFlow(passed ? blockIdx + 1 : blockIdx, passed ? 0 : attemptNum + 1)
  }

  // ── Speech recognition ─────────────────────────────────────────────────────
  async function recognizeSpeech(expected: string): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return 0

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition: any = new SR()
      recognition.lang = 'fr-FR'
      recognition.interimResults = false
      recognition.maxAlternatives = 3
      recognitionRef.current = recognition

      const timeout = setTimeout(() => {
        try { recognition.abort() } catch { /* ok */ }
        resolve(0)
      }, 8000)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        clearTimeout(timeout)
        recognitionRef.current = null
        let best = 0
        for (let i = 0; i < event.results[0].length; i++) {
          const s = wordSimilarity(expected, event.results[0][i].transcript)
          if (s > best) best = s
        }
        resolve(best)
      }
      recognition.onerror = () => { clearTimeout(timeout); recognitionRef.current = null; resolve(0) }
      recognition.onnomatch = () => { clearTimeout(timeout); recognitionRef.current = null; resolve(0) }
      try { recognition.start() } catch { resolve(0) }
    })
  }

  // ── Mic skip helpers ───────────────────────────────────────────────────────
  function skipMicBlock() {
    micAbortRef.current = true
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch { /* ok */ }; recognitionRef.current = null }
    stopAllAudio()
    const next = micBlockIdx + 1
    if (next >= syntagms.length) { setPhase('review'); return }
    setTimeout(() => {
      micAbortRef.current = false
      setMicBlockIdx(next)
      setMicAttempts(0)
      setMicState('playing')
      runMicFlow(next, 0)
    }, 60)
  }

  function skipAllMic() {
    micAbortRef.current = true
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch { /* ok */ }; recognitionRef.current = null }
    stopAllAudio()
    setPhase('review')
  }

  // ── Back navigation ────────────────────────────────────────────────────────
  function goBack() {
    micAbortRef.current = true
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch { /* ok */ } }
    stopAllAudio()
    router.push('/exercises')
  }

  // ── Shared UI pieces ───────────────────────────────────────────────────────
  const formatToggle = (
    <div className={styles.formatToggle}>
      <button className={`${styles.formatBtn} ${format === 'normal' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('normal')}>Аа</button>
      <button className={`${styles.formatBtn} ${styles.formatBtnLarge} ${format === 'adapted' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('adapted')}>Аа</button>
    </div>
  )

  const backBtn = (
    <button className={styles.backBtn} onClick={goBack}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  const currentStepIdx = PHASE_STEPS.indexOf(phase as typeof PHASE_STEPS[number])
  const showProgress = currentStepIdx >= 0

  const progressBar = showProgress ? (
    <div className={styles.progressBar} aria-hidden>
      {PHASE_STEPS.map((_, i) => (
        <div
          key={i}
          className={`${styles.progressSeg} ${
            i < currentStepIdx ? styles.progressSegDone :
            i === currentStepIdx ? styles.progressSegActive : ''
          }`}
        />
      ))}
    </div>
  ) : null

  // ── Render: loading ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g20name}</span>
          {formatToggle}
        </div>
        {errorMsg ? (
          <div className={styles.centerWrap}>
            <p className={styles.errorMsg}>{errorMsg}</p>
            <button className={styles.primaryBtn} onClick={loadText}>{t.exercises.again}</button>
          </div>
        ) : (
          <div className={styles.centerWrap}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>{t.exercises.loading}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Render: complete ───────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g20name}</span>
          {formatToggle}
        </div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          <div className={styles.completeActions}>
            <button className={styles.primaryBtn} onClick={loadText}>{t.exercises.again}</button>
            <button className={`${styles.primaryBtn} ${styles.primaryBtnGhost}`} onClick={() => router.push('/exercises')}>{t.exercises.toExercises}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: read / review ──────────────────────────────────────────────────
  if (phase === 'read' || phase === 'review') {
    const hint = phase === 'read' ? t.exercises.g20readHint : t.exercises.g20reviewHint
    const btnLabel = phase === 'read' ? t.exercises.g20nextBtn : t.exercises.g20finishBtn
    const onNext = () => {
      if (phase === 'read') setPhase('syntagms')
      else setPhase('complete')
    }
    return (
      <div className={styles.pageFixed}>
        <div className={styles.topbar}>
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g20name}</span>
          {formatToggle}
        </div>
        {progressBar}
        <div className={styles.textArea}>
          <p className={styles.phaseHint}>{hint}</p>
          <p className={`${styles.fullText} ${format === 'adapted' ? styles.fullTextAdapted : ''}`}>{text}</p>
        </div>
        <div className={styles.bottomBar}>
          <button className={styles.primaryBtn} onClick={onNext}>{btnLabel}</button>
        </div>
      </div>
    )
  }

  // ── Render: syntagms ───────────────────────────────────────────────────────
  if (phase === 'syntagms') {
    return (
      <div className={styles.pageFixed}>
        <div className={styles.topbar}>
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g20name}</span>
          {formatToggle}
        </div>
        {progressBar}
        <div className={styles.syntagmsArea}>
          <p className={styles.phaseHint}>{t.exercises.g20syntagmsHint}</p>
          <div className={styles.syntagmList}>
            {syntagms.map((block, i) => (
              <button
                key={i}
                className={`${styles.syntagmRow} ${playingIdx === i ? styles.syntagmRowActive : ''}`}
                onClick={() => playBlock(i, block)}
              >
                <span className={`${styles.playIcon} ${playingIdx === i ? styles.playIconActive : ''}`} aria-hidden>
                  {playingIdx === i ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </span>
                <span className={`${styles.syntagmText} ${format === 'adapted' ? styles.syntagmTextAdapted : ''}`}>
                  {block}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.bottomBar}>
          <button
            className={`${styles.listenAllBtn} ${isPlayingAll ? styles.listenAllBtnActive : ''}`}
            onClick={togglePlayAll}
          >
            {isPlayingAll ? t.exercises.g20stopAll : t.exercises.g20listenAll}
          </button>
          <button className={styles.primaryBtn} onClick={enterMicPhase}>
            {t.exercises.g20doneBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: mic ────────────────────────────────────────────────────────────
  if (phase === 'mic') {
    const currentBlock = syntagms[micBlockIdx] ?? ''

    if (!micSupported) {
      return (
        <div className={styles.page}>
          <div className={styles.topbar}>
            {backBtn}
            <span className={styles.groupLabel}>{t.exercises.g20name}</span>
            {formatToggle}
          </div>
          {progressBar}
          <div className={styles.centerWrap}>
            <p className={styles.micUnsupported}>{t.exercises.g20micNotSupported}</p>
            <button className={styles.primaryBtn} onClick={() => setPhase('review')}>
              {t.exercises.g20micSkipAll}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.pageFixed}>
        <div className={styles.topbar}>
          {backBtn}
          <span className={styles.groupLabel}>{t.exercises.g20name}</span>
          {formatToggle}
        </div>
        {progressBar}
        <div className={styles.micArea}>
          <p className={styles.micCounter}>{micBlockIdx + 1} / {syntagms.length}</p>

          <div className={`${styles.micBlock} ${
            micState === 'success' ? styles.micBlockSuccess :
            micState === 'fail' ? styles.micBlockFail : ''
          }`}>
            <p className={`${styles.micBlockText} ${format === 'adapted' ? styles.micBlockTextAdapted : ''}`}>
              {currentBlock}
            </p>
          </div>

          <div className={styles.attemptDots}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <div key={i} className={`${styles.attemptDot} ${i < micAttempts ? styles.attemptDotUsed : ''}`} />
            ))}
          </div>

          <p className={styles.micStateLabel}>
            {micState === 'playing' ? t.exercises.g20micPlaying :
             micState === 'listening' ? t.exercises.g20micListening :
             micState === 'success' ? t.exercises.g20micSuccess :
             micState === 'fail' ? t.exercises.g20micFail : ''}
          </p>

          {micState === 'listening' && (
            <div className={styles.listenWave} aria-hidden>
              <span /><span /><span /><span /><span />
            </div>
          )}
        </div>

        <div className={styles.bottomBar}>
          <button className={`${styles.primaryBtn} ${styles.primaryBtnGhost}`} onClick={skipMicBlock}>
            {t.exercises.g20micSkip}
          </button>
          <button className={styles.skipAllBtn} onClick={skipAllMic}>
            {t.exercises.g20micSkipAll}
          </button>
        </div>
      </div>
    )
  }

  return null
}

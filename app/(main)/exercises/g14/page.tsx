'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { useTextFormat } from '@/lib/hooks/useTextFormat'
import { useTrackExercise } from '@/lib/hooks/useRecentExercises'
import styles from './page.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'select' | 'loading' | 'word' | 'complete'
type MicState = 'idle' | 'recording' | 'processing' | 'success' | 'fail'
type SelfResult = 'easy' | 'ok' | 'hard' | 'fail'

interface PseudoWord {
  text: string
  result?: 'mic_success' | 'mic_fail' | SelfResult | 'skipped'
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTS = [5, 10, 15, 20]
const MAX_ATTEMPTS = 3
const MIC_THRESHOLD = 0.55

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function pronounceSimilarity(expected: string, heardStr: string): number {
  const e = normalizeStr(expected)
  let best = 0
  for (const w of heardStr.split(/\s+/)) {
    const h = normalizeStr(w)
    const maxLen = Math.max(e.length, h.length)
    if (maxLen === 0) continue
    const sim = 1 - editDistance(e, h) / maxLen
    if (sim > best) best = sim
  }
  return best
}

function parseWordList(content: string, count: number): string[] {
  return content
    .split(/[\n,;]+/)
    .map(w => w.trim().replace(/^\d+[.)]\s*/, '').trim())
    .filter(w => /^[a-zA-ZÀ-ÿœæ]{3,12}$/.test(w))
    .slice(0, count)
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
  } catch {
    // TTS unavailable
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function G14Page() {
  const router = useRouter()
  const t = useT()
  useTrackExercise('g14', 'Псевдослова', '/exercises/g14')
  const { format, setFormat } = useTextFormat()

  const [phase, setPhase] = useState<Phase>('select')
  const [selectedCount, setSelectedCount] = useState(10)
  const [words, setWords] = useState<PseudoWord[]>([])
  const [wordIdx, setWordIdx] = useState(0)
  const [micState, setMicState] = useState<MicState>('idle')
  const [attempts, setAttempts] = useState(0)
  const [hasMic, setHasMic] = useState(false)
  const [wordVisible, setWordVisible] = useState(true)
  const [listenedCurrent, setListenedCurrent] = useState(false)
  const [showSelf, setShowSelf] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const abortRef = useRef(false)

  // ── Detect SpeechRecognition ───────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    setHasMic(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  const currentWord = words[wordIdx]?.text ?? ''

  // ── Load words ────────────────────────────────────────────────────────────
  async function loadWords(count: number) {
    setPhase('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: 'g14', letter_targets: [String(count)] }),
      })
      const data = await res.json()
      const text: string = data.content ?? ''
      if (!text) throw new Error('empty')

      const parsed = parseWordList(text, count)
      if (parsed.length < 3) throw new Error('too few words')

      setWords(parsed.map(w => ({ text: w })))
      setWordIdx(0)
      setAttempts(0)
      setMicState('idle')
      setListenedCurrent(false)
      setShowSelf(false)
      setWordVisible(true)
      abortRef.current = false
      setPhase('word')
    } catch {
      setErrorMsg(t.exercises.loadError)
      setPhase('select')
    }
  }

  // ── Advance to next word ──────────────────────────────────────────────────
  function advanceWord(result: PseudoWord['result']) {
    abortRef.current = true
    stopRecognition()

    setWords(prev => {
      const next = [...prev]
      next[wordIdx] = { ...next[wordIdx], result }
      return next
    })

    const nextIdx = wordIdx + 1
    if (nextIdx >= words.length) {
      setTimeout(() => setPhase('complete'), 300)
      return
    }

    setWordVisible(false)
    setTimeout(() => {
      setWordIdx(nextIdx)
      setAttempts(0)
      setMicState('idle')
      setListenedCurrent(false)
      setShowSelf(false)
      abortRef.current = false
      setWordVisible(true)
    }, 260)
  }

  // ── Mic helpers ───────────────────────────────────────────────────────────
  function stopRecognition() {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
  }

  async function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return

    abortRef.current = false
    setMicState('recording')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.lang = 'fr-FR'
    recognition.maxAlternatives = 3
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    const heard = await new Promise<string>(resolve => {
      let settled = false
      const done = (s: string) => { if (!settled) { settled = true; resolve(s) } }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        const alts: string[] = []
        for (let i = 0; i < e.results[0].length; i++) alts.push(e.results[0][i].transcript)
        done(alts.join(' '))
      }
      recognition.onerror = () => done('')
      recognition.onend = () => done('')
      setTimeout(() => done(''), 8000)
      try { recognition.start() } catch { done('') }
    })

    if (abortRef.current) return

    setMicState('processing')
    const sim = pronounceSimilarity(currentWord, heard)
    const newAttempts = attempts + 1

    if (sim >= MIC_THRESHOLD) {
      setMicState('success')
      setTimeout(() => advanceWord('mic_success'), 1300)
    } else if (newAttempts >= MAX_ATTEMPTS) {
      setAttempts(newAttempts)
      setMicState('fail')
      // Play TTS reference then advance
      setTimeout(async () => {
        if (abortRef.current) return
        await playTTS(currentWord)
        if (abortRef.current) return
        advanceWord('mic_fail')
      }, 700)
    } else {
      setAttempts(newAttempts)
      setMicState('fail')
      setTimeout(() => { if (!abortRef.current) setMicState('idle') }, 900)
    }
  }

  // ── Listen TTS ────────────────────────────────────────────────────────────
  async function listenWord() {
    setListenedCurrent(true)
    await playTTS(currentWord)
    setShowSelf(true)
  }

  // ── Restart ───────────────────────────────────────────────────────────────
  function restart() {
    abortRef.current = true
    stopRecognition()
    setPhase('select')
    setWords([])
    setWordIdx(0)
    setErrorMsg('')
  }

  // ── Format toggle ─────────────────────────────────────────────────────────
  const formatToggle = (
    <div className={styles.formatToggle}>
      <button className={`${styles.formatBtn} ${format === 'normal' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('normal')}>Аа</button>
      <button className={`${styles.formatBtn} ${styles.formatBtnLarge} ${format === 'adapted' ? styles.formatBtnActive : ''}`} onClick={() => setFormat('adapted')}>Аа</button>
    </div>
  )

  const backSvg = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => router.push('/exercises')}>{backSvg}</button>
          <span className={styles.groupLabel}>{t.exercises.g14name}</span>
          {formatToggle}
        </div>

        <div className={styles.selectWrap}>
          <p className={styles.selectPrompt}>{t.exercises.g14selectHint}</p>
          {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

          <div className={styles.countCards}>
            {COUNTS.map(n => (
              <button
                key={n}
                className={`${styles.countCard} ${selectedCount === n ? styles.countCardActive : ''}`}
                onClick={() => setSelectedCount(n)}
              >
                <span className={styles.countNum}>{n}</span>
                <span className={styles.countLabel}>{t.exercises.g14wordsLabel}</span>
              </button>
            ))}
          </div>

          <button className={styles.startBtn} onClick={() => loadWords(selectedCount)}>
            {t.exercises.g14startBtn}
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={restart}>{backSvg}</button>
          <span className={styles.groupLabel}>{t.exercises.g14name}</span>
          {formatToggle}
        </div>
        <div className={styles.centerWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>{t.exercises.loading}</p>
        </div>
      </div>
    )
  }

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    const allFailed = words.length > 0 &&
      words.every(w => w.result === 'mic_fail' || w.result === 'fail')
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <span className={styles.groupLabel}>{t.exercises.g14name}</span>
          {formatToggle}
        </div>
        <div className={styles.completeWrap}>
          <p className={styles.completeTitle}>{t.exercises.done}</p>
          {allFailed && <p className={styles.allFailHint}>{t.exercises.g14allFailHint}</p>}
          <div className={styles.completeActions}>
            <button className={styles.actionBtn} onClick={() => loadWords(selectedCount)}>
              {t.exercises.again}
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={restart}>
              {t.exercises.g14restBtn}
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnGhost}`} onClick={() => router.push('/exercises')}>
              {t.exercises.toExercises}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── WORD ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={restart}>{backSvg}</button>
        <span className={styles.groupLabel}>{t.exercises.g14name}</span>
        {formatToggle}
      </div>

      <div className={styles.wordPhase}>
        <p className={styles.progress}>
          {wordIdx + 1} / {words.length}
        </p>

        <div className={styles.wordArea}>
          <span className={[
            styles.wordDisplay,
            format === 'adapted' ? styles.wordDisplayAdapted : '',
            !wordVisible ? styles.wordHidden : '',
            micState === 'success' ? styles.wordSuccess : '',
            micState === 'fail' ? styles.wordFail : '',
          ].filter(Boolean).join(' ')}>
            {currentWord}
          </span>
        </div>

        {hasMic ? (
          // ── Mic mode ─────────────────────────────────────────────────────
          <div className={styles.micArea}>
            {micState === 'fail' && attempts < MAX_ATTEMPTS && (
              <p className={styles.micHint}>{t.exercises.g14tryAgain}</p>
            )}
            {micState === 'success' && (
              <p className={styles.micHintSuccess}>{t.exercises.g20micSuccess}</p>
            )}
            {micState === 'idle' && attempts === 0 && (
              <p className={styles.micHint}>{t.exercises.g14micHint}</p>
            )}

            <button
              className={[
                styles.micBtn,
                micState === 'recording' ? styles.micBtnRecording : '',
                micState === 'processing' ? styles.micBtnProcessing : '',
                micState === 'success' ? styles.micBtnSuccess : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (micState === 'idle' || micState === 'fail') startRecording()
              }}
              disabled={micState === 'processing' || micState === 'success'}
              aria-label={t.exercises.g14micHint}
            >
              {micState === 'processing' ? (
                <span className={styles.micSpinner} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0014 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>

            <button className={styles.skipBtn} onClick={() => advanceWord('skipped')}>
              {t.exercises.g14skipBtn}
            </button>
          </div>
        ) : (
          // ── Self-assessment mode ──────────────────────────────────────────
          <div className={styles.selfArea}>
            <button
              className={`${styles.listenBtn} ${listenedCurrent ? styles.listenBtnDone : ''}`}
              onClick={listenWord}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
              {t.exercises.g14listenBtn}
            </button>

            {showSelf && (
              <div className={styles.selfBtns}>
                <button className={styles.selfBtn} onClick={() => advanceWord('easy')}>{t.exercises.g14selfEasy}</button>
                <button className={styles.selfBtn} onClick={() => advanceWord('ok')}>{t.exercises.g14selfOk}</button>
                <button className={styles.selfBtn} onClick={() => advanceWord('hard')}>{t.exercises.g14selfHard}</button>
                <button className={`${styles.selfBtn} ${styles.selfBtnFail}`} onClick={() => advanceWord('fail')}>{t.exercises.g14selfFail}</button>
              </div>
            )}

            <button className={styles.skipBtn} onClick={() => advanceWord('skipped')}>
              {t.exercises.g14skipBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

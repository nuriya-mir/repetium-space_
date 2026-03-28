'use client'

import { useState, useRef, useCallback } from 'react'
import { Icon } from '@/components/ui/Icon'
import styles from './Microphone.module.css'

interface MicrophoneProps {
  onResult?: (transcript: string) => void
  disabled?: boolean
  maxAttempts?: number
}

export function Microphone({ onResult, disabled, maxAttempts = 3 }: MicrophoneProps) {
  const [recording, setRecording] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const startRecording = useCallback(async () => {
    if (disabled || attempts >= maxAttempts) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setAttempts((a) => a + 1)
        // In production, send audio to speech recognition API
        onResult?.('')
      }

      recorder.start()
      setRecording(true)

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
          setRecording(false)
        }
      }, 5000)
    } catch {
      // Microphone access denied
    }
  }, [disabled, attempts, maxAttempts, onResult])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }, [])

  const exhausted = attempts >= maxAttempts

  return (
    <div className={styles.wrapper}>
      <button
        className={`${styles.micBtn} ${recording ? styles.recording : ''} ${exhausted ? styles.exhausted : ''}`}
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled || exhausted}
        aria-label={recording ? 'Остановить запись' : 'Начать запись'}
        type="button"
      >
        <Icon name="mic" size={24} />
        {recording && <span className={styles.pulse} />}
      </button>
      {exhausted && (
        <span className={styles.fallbackText}>Послушайте эталон</span>
      )}
    </div>
  )
}

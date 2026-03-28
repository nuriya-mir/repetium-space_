'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

type Tab = 'progress' | 'test'

const TEST_QUESTIONS = [
  { id: 1, type: 'letter-recognition', prompt: 'Какая это буква?', display: 'É', options: ['E', 'É', 'È', 'Ê'], correct: 'É' },
  { id: 2, type: 'sound-to-letter', prompt: 'Какая буква издаёт этот звук?', display: '[ʃ]', options: ['S', 'C', 'CH', 'J'], correct: 'CH' },
  { id: 3, type: 'diacritic', prompt: 'Какой акцент у буквы?', display: 'â', options: ['accent aigu', 'accent grave', 'accent circonflexe', 'tréma'], correct: 'accent circonflexe' },
  { id: 4, type: 'letter-recognition', prompt: 'Какая это буква?', display: 'Ç', options: ['C', 'Ç', 'G', 'S'], correct: 'Ç' },
  { id: 5, type: 'nasal', prompt: 'Это носовой звук?', display: 'an', options: ['Да', 'Нет'], correct: 'Да' },
]

export default function ProgressPage() {
  const t = useT()

  const [tab, setTab] = useState<Tab>('progress')
  const [testStarted, setTestStarted] = useState(false)
  const [testIdx, setTestIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [testDone, setTestDone] = useState(false)

  function handleTestAnswer(answer: string) {
    setAnswers((prev) => ({ ...prev, [TEST_QUESTIONS[testIdx].id]: answer }))
    if (testIdx < TEST_QUESTIONS.length - 1) {
      setTestIdx((i) => i + 1)
    } else {
      setTestDone(true)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {tab === 'progress' ? t.progress.tabs.progress : t.progress.tabs.test}
        </h1>
      </div>

      <div className={styles.tabs}>
        {([
          { key: 'progress', label: t.progress.tabs.progress },
          { key: 'test',     label: t.progress.tabs.test },
        ] as const).map((tab_) => (
          <button
            key={tab_.key}
            className={`${styles.tab} ${tab === tab_.key ? styles.activeTab : ''}`}
            onClick={() => setTab(tab_.key)}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ── Progress tab ── */}
      {tab === 'progress' && (
        <div className={styles.content}>
          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.letters}</h3>
            <ProgressBar value={5} max={26} label={t.progress.seen} showValue variant="default" />
            <div className={styles.spacer} />
            <ProgressBar value={2} max={26} label={t.progress.mastered} showValue variant="teal" />
          </Card>

          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.regularity}</h3>
            <div className={styles.streakRow}>
              <span className={styles.streakLabel}>{t.progress.weekSessions}</span>
              <span className={styles.streakValue}>0</span>
            </div>
            <p className={styles.hint}>{t.progress.regularityHint}</p>
          </Card>

          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.perception}</h3>
            <p className={styles.hint}>{t.progress.perceptionHint}</p>
            <Button variant="outline" size="sm" onClick={() => setTab('test')}>
              {t.progress.goTest}
            </Button>
          </Card>
        </div>
      )}

      {/* ── Test tab ── */}
      {tab === 'test' && (
        <div className={styles.content}>
          {!testStarted && !testDone && (
            <div className={styles.testIntro}>
              <p className={styles.testDesc}>{t.progress.testIntro}</p>
              <p className={styles.testMeta}>{t.progress.testMeta}</p>
              <Button variant="primary" onClick={() => setTestStarted(true)}>
                {t.progress.testStart}
              </Button>
            </div>
          )}

          {testStarted && !testDone && (
            <div className={styles.testQuestion}>
              <ProgressBar value={testIdx + 1} max={TEST_QUESTIONS.length} size="sm" variant="default" />
              <div className={styles.questionCard}>
                <p className={styles.questionPrompt}>{TEST_QUESTIONS[testIdx].prompt}</p>
                <span className={styles.questionDisplay}>{TEST_QUESTIONS[testIdx].display}</span>
                <div className={styles.optionsGrid}>
                  {TEST_QUESTIONS[testIdx].options.map((opt) => (
                    <button key={opt} className={styles.optionBtn} onClick={() => handleTestAnswer(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleTestAnswer('skip')}>
                  {t.exercises.dontKnow}
                </Button>
              </div>
            </div>
          )}

          {testDone && (
            <div className={styles.testResult}>
              <div className={styles.resultIcon}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="22" stroke="var(--teal)" strokeWidth="2" fill="var(--teal-dim)" />
                  <path d="M15 24l6 6 12-12" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.resultTitle}>{t.progress.testDoneTitle}</h3>
              <p className={styles.resultDesc}>{t.progress.testDoneDesc}</p>
              <Button variant="outline" onClick={() => { setTestStarted(false); setTestDone(false); setTestIdx(0); setAnswers({}) }}>
                {t.progress.testRetake}
              </Button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

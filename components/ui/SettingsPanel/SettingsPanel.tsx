'use client'

import { useT } from '@/lib/i18n'
import { usePreferences } from '@/lib/hooks/usePreferences'
import { Toggle } from '@/components/ui/Toggle'
import { Card } from '@/components/ui/Card'
import styles from './SettingsPanel.module.css'

const OVERLAY_SWATCHES: Array<{ key: 'none' | 'yellow' | 'blue' | 'pink' | 'green' | 'peach'; color?: string }> = [
  { key: 'none' },
  { key: 'yellow', color: '#FFF9DB' },
  { key: 'blue',   color: '#DBEAFE' },
  { key: 'pink',   color: '#FCE7F3' },
  { key: 'green',  color: '#D1FAE5' },
  { key: 'peach',  color: '#FED7AA' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const t = useT()
  const { prefs, set, reset } = usePreferences()

  return (
    <>
      <div
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.nav.settings}
      >
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{t.nav.settings}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {/* Appearance */}
          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.settingsAppearance}</h3>
            <div className={styles.settingsList}>
              <Toggle label={t.progress.darkMode} checked={prefs.darkMode} onChange={(v) => set('darkMode', v)} />

              <div className={styles.settingRow}>
                <Toggle label={t.progress.settingsAnimations} checked={prefs.animations} onChange={(v) => set('animations', v)} />
                <span className={styles.settingHint}>{t.progress.settingsAnimationsHint}</span>
              </div>

              <div>
                <span className={styles.settingLabel}>{t.progress.settingsOverlay}</span>
                <div className={styles.overlayPalette} role="group" aria-label={t.progress.settingsOverlay}>
                  {OVERLAY_SWATCHES.map(({ key, color }) => (
                    <button
                      key={key}
                      className={`${styles.overlaySwatch} ${prefs.readingOverlay === key ? styles.overlaySwatchActive : ''} ${key === 'none' ? styles.overlaySwatchNone : ''}`}
                      style={color ? { backgroundColor: color } : undefined}
                      onClick={() => set('readingOverlay', key)}
                      aria-pressed={prefs.readingOverlay === key}
                    >
                      {key === 'none' && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', inset: 0, margin: 'auto', display: 'block' }} aria-hidden="true">
                          <line x1="3" y1="3" x2="13" y2="13" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={styles.settingLabel}>{t.progress.settingsReadingFont}</span>
                <div className={styles.fontPicker}>
                  {(['atkinson', 'opendyslexic'] as const).map((f) => (
                    <button
                      key={f}
                      className={`${styles.fontBtn} ${prefs.readingFont === f ? styles.fontBtnActive : ''}`}
                      onClick={() => set('readingFont', f)}
                      aria-pressed={prefs.readingFont === f}
                    >
                      {f === 'atkinson' ? t.progress.fontAtkinson : t.progress.fontOpendyslexic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Reading & Perception */}
          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.settingsReading}</h3>
            <div className={styles.settingsList}>
              <Toggle label={t.progress.settingsDyslexiaSpacing} checked={prefs.dyslexiaMode} onChange={(v) => set('dyslexiaMode', v)} />
              <Toggle label={t.progress.settingsAutoTTS} checked={prefs.autoTTS} onChange={(v) => set('autoTTS', v)} />

              <div>
                <span className={styles.settingLabel}>{t.progress.settingsTTSSpeed}</span>
                <div className={styles.speedRow}>
                  {([0.7, 1, 1.3] as const).map((speed) => (
                    <button
                      key={speed}
                      className={`${styles.speedBtn} ${prefs.ttsSpeed === speed ? styles.speedBtnActive : ''}`}
                      onClick={() => set('ttsSpeed', speed)}
                      aria-pressed={prefs.ttsSpeed === speed}
                    >
                      {speed === 0.7 ? t.progress.ttsSpeedSlow : speed === 1 ? t.progress.ttsSpeedNormal : t.progress.ttsSpeedFast}
                    </button>
                  ))}
                </div>
              </div>

              <Toggle label={t.progress.soundEnabled} checked={prefs.sound} onChange={(v) => set('sound', v)} />
            </div>
          </Card>

          {/* Exercises */}
          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.settingsExercises}</h3>
            <div className={styles.settingsList}>
              <div className={styles.settingRow}>
                <Toggle label={t.progress.settingsAdaptiveTiming} checked={prefs.adaptiveTiming} onChange={(v) => set('adaptiveTiming', v)} />
                <span className={styles.settingHint}>{t.progress.settingsAdaptiveTimingHint}</span>
              </div>

              <div>
                <span className={styles.settingLabel}>{t.progress.settingsHintThreshold}</span>
                <div className={styles.segmented} role="group">
                  {([0, 1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      className={`${styles.segBtn} ${prefs.hintThreshold === n ? styles.segBtnActive : ''}`}
                      onClick={() => set('hintThreshold', n)}
                      aria-pressed={prefs.hintThreshold === n}
                    >
                      {n === 0 ? t.progress.hintImmediately
                        : n === 1 ? t.progress.hintAfter1
                        : n === 2 ? t.progress.hintAfter2
                        : t.progress.hintAfter3}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.settingRow}>
                <Toggle label={t.progress.settingsMicroRewards} checked={prefs.microRewards} onChange={(v) => set('microRewards', v)} />
                <span className={styles.settingHint}>{t.progress.settingsMicroRewardsHint}</span>
              </div>
            </div>
          </Card>

          {/* Comfort */}
          <Card padding="md">
            <h3 className={styles.sectionLabel}>{t.progress.settingsComfort}</h3>
            <div className={styles.settingsList}>
              <div className={styles.settingRow}>
                <Toggle label={t.progress.settingsNoSurprises} checked={prefs.noSurprises} onChange={(v) => set('noSurprises', v)} />
                <span className={styles.settingHint}>{t.progress.settingsNoSurprisesHint}</span>
              </div>
              <Toggle label={t.progress.settingsShowPreview} checked={prefs.showPreview} onChange={(v) => set('showPreview', v)} />
            </div>
          </Card>

          <button className={styles.resetBtn} onClick={reset}>
            {t.progress.settingsReset}
          </button>
        </div>
      </div>
    </>
  )
}

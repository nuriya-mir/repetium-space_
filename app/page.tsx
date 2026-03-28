'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Logo } from '@/components/ui/Logo'
import { useT, useI18n, LOCALES, LOCALE_LABELS } from '@/lib/i18n'
import styles from './page.module.css'

// Видео-заглушка с кнопкой Play (реальное видео подключается через videoSrc)
const VIDEO_PLACEHOLDER = true // убрать, когда появится реальное видео

function VideoBlock({ className }: { className?: string }) {
  const t = useT()
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function toggle() {
    if (!videoRef.current) { setPlaying(!playing); return }
    if (playing) { videoRef.current.pause() } else { videoRef.current.play() }
    setPlaying(!playing)
  }

  return (
    <div className={`${styles.videoBlock} ${className ?? ''}`} onClick={toggle}>
      {VIDEO_PLACEHOLDER ? (
        <>
          <div className={styles.videoPlaceholderBg} aria-hidden="true" />
          <div className={styles.videoMeta}>
            <span className={styles.videoDuration}>~2 min</span>
          </div>
          <button className={styles.playBtn} aria-label="Play video">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 4.5l14 7.5-14 7.5V4.5z" fill="currentColor" />
            </svg>
          </button>
          <p className={styles.videoCaption}>{t.landing.hero.videoCaption}</p>
        </>
      ) : (
        <>
          <video ref={videoRef} className={styles.videoEl} playsInline />
          {!playing && (
            <button className={styles.playBtn} aria-label="Play video">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 4.5l14 7.5-14 7.5V4.5z" fill="currentColor" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function LandingPage() {
  const t = useT()
  const { locale, setLocale } = useI18n()
  const [sticky, setSticky] = useState(false)

  useEffect(() => {
    function onScroll() {
      setSticky(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={styles.landing}>

      {/* ── Лендинговый навбар (не продуктовый) ── */}
      <nav className={styles.topbar}>
        <Logo markHeight={28} wordmarkSize={17} layout="horizontal" />
        <div className={styles.topbarActions}>
          <div className={styles.topbarLocale} role="group" aria-label="Interface language">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                className={`${styles.topbarLocaleBtn} ${locale === loc ? styles.topbarLocaleActive : ''}`}
                onClick={() => setLocale(loc)}
                aria-pressed={locale === loc}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>
          <Link href="/login" className={styles.loginBtn}>{t.landing.login}</Link>
          <Link href="/progress" className={styles.tryBtn}>{t.landing.try}</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.overline}>{t.landing.hero.overline}</span>
          <h1 className={styles.headline}>
            {t.landing.hero.headline.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h1>
          <p className={styles.subheadline}>{t.landing.hero.sub}</p>
          <div className={styles.heroCta}>
            <Link href="/progress" className={styles.primaryBtn}>{t.landing.hero.cta}</Link>
            <p className={styles.heroNote}>{t.landing.hero.note}</p>
          </div>
        </div>
        <div className={styles.heroRight}>
          <VideoBlock />
        </div>
      </header>

      {/* ── Для кого ── */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionOverline}>{t.landing.forWhom.overline}</span>
          <h2 className={styles.sectionTitle}>{t.landing.forWhom.title}</h2>
          <div className={styles.personaGrid}>
            <div className={styles.personaCard}>
              <div className={styles.personaIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 10h16M4 14h10" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M18 14l-3 4 3 0" stroke="var(--flicker)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.personaTitle}>{t.landing.forWhom.p1title}</h3>
              <p className={styles.personaDesc}>{t.landing.forWhom.p1desc}</p>
            </div>
            <div className={styles.personaCard}>
              <div className={styles.personaIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <text x="4" y="20" fontFamily="serif" fontSize="18" fill="var(--blue)" stroke="none">é</text>
                  <path d="M16 8q3 1 3 5t-3 5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M14 10q1.5.5 1.5 3t-1.5 3" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
                </svg>
              </div>
              <h3 className={styles.personaTitle}>{t.landing.forWhom.p2title}</h3>
              <p className={styles.personaDesc}>{t.landing.forWhom.p2desc}</p>
            </div>
            <div className={styles.personaCard}>
              <div className={styles.personaIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="var(--blue)" strokeWidth="1.5" />
                  <path d="M12 8v4" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="var(--blue)" />
                </svg>
              </div>
              <h3 className={styles.personaTitle}>{t.landing.forWhom.p3title}</h3>
              <p className={styles.personaDesc}>{t.landing.forWhom.p3desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Что это ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionOverline}>{t.landing.whatIs.overline}</span>
          <h2 className={styles.sectionTitle}>{t.landing.whatIs.title}</h2>
          <p className={styles.sectionText}>{t.landing.whatIs.p1}</p>
          <p className={styles.sectionText}>{t.landing.whatIs.p2}</p>
        </div>
      </section>

      {/* ── Как это работает ── */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionOverline}>{t.landing.howItWorks.overline}</span>
          <h2 className={styles.sectionTitle}>{t.landing.howItWorks.title}</h2>
          <div className={styles.stepsRow}>
            <VideoBlock className={styles.stepsVideo} />
            <ol className={styles.stepsList}>
              {([
                [t.landing.howItWorks.s1title, t.landing.howItWorks.s1desc],
                [t.landing.howItWorks.s2title, t.landing.howItWorks.s2desc],
                [t.landing.howItWorks.s3title, t.landing.howItWorks.s3desc],
                [t.landing.howItWorks.s4title, t.landing.howItWorks.s4desc],
              ] as [string, string][]).map(([title, desc], i) => (
                <li key={i} className={styles.step}>
                  <div className={styles.stepNum}>{i + 1}</div>
                  <div>
                    <h3 className={styles.stepTitle}>{title}</h3>
                    <p className={styles.stepDesc}>{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Принципы ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionOverline}>{t.landing.principles.overline}</span>
          <h2 className={styles.sectionTitle}>{t.landing.principles.title}</h2>
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M2 17l10 5 10-5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12l10 5 10-5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>{t.landing.principles.f1title}</h3>
              <p className={styles.featureDesc}>{t.landing.principles.f1desc}</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="var(--blue)" strokeWidth="1.5" />
                  <path d="M12 7v5l3 3" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>{t.landing.principles.f2title}</h3>
              <p className={styles.featureDesc}>{t.landing.principles.f2desc}</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--blue)" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>{t.landing.principles.f3title}</h3>
              <p className={styles.featureDesc}>{t.landing.principles.f3desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Научная база ── */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionOverline}>{t.landing.science.overline}</span>
          <h2 className={styles.sectionTitle}>{t.landing.science.title}</h2>
          <div className={styles.scienceGrid}>
            <div className={styles.scienceItem}>
              <div className={styles.scienceEmoji} aria-hidden="true">🧬</div>
              <h3 className={styles.scienceLabel}>{t.landing.science.h1label}</h3>
              <p className={styles.scienceDesc}>{t.landing.science.h1desc}</p>
            </div>
            <div className={styles.scienceItem}>
              <div className={styles.scienceEmoji} aria-hidden="true">🔑</div>
              <h3 className={styles.scienceLabel}>{t.landing.science.d1label}</h3>
              <p className={styles.scienceDesc}>{t.landing.science.d1desc}</p>
            </div>
            <div className={styles.scienceItem}>
              <div className={styles.scienceEmoji} aria-hidden="true">👁️</div>
              <h3 className={styles.scienceLabel}>{t.landing.science.ms1label}</h3>
              <p className={styles.scienceDesc}>{t.landing.science.ms1desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── О названии ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionOverline}>{t.landing.manifesto.overline}</span>
          <h2 className={styles.sectionTitle}>{t.landing.manifesto.title}</h2>
          <p className={styles.sectionText}>{t.landing.manifesto.p1}</p>
          <p className={styles.sectionText}><strong>{t.landing.manifesto.p2}</strong></p>
          <p className={styles.sectionText}>{t.landing.manifesto.p3}</p>
          <blockquote className={styles.manifesto}>{t.landing.manifesto.quote}</blockquote>
        </div>
      </section>

      {/* ── Честность ── */}
      <section className={`${styles.section} ${styles.alt}`}>
        <div className={styles.sectionInner}>
          <blockquote className={styles.honestyQuote}>
            <span className={styles.quoteOpen}>&ldquo;</span>
            {t.landing.honesty.quote}
            <span className={styles.quoteClose}>&rdquo;</span>
          </blockquote>
          <p className={styles.honestyNote}>{t.landing.honesty.note}</p>
        </div>
      </section>

      {/* ── CTA bottom ── */}
      <section className={`${styles.section} ${styles.ctaSection}`}>
        <div className={styles.sectionInner}>
          <h2 className={styles.ctaTitle}>
            {t.landing.cta.title.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h2>
          <Link href="/progress" className={styles.primaryBtnLg}>{t.landing.cta.btn}</Link>
          <p className={styles.ctaNote}>{t.landing.cta.note}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Logo markHeight={20} wordmarkSize={13} layout="horizontal" />
          <span className={styles.footerCopy}>{t.landing.footer.slogan}</span>
          <div className={styles.footerLinks}>
            <Link href="/login" className={styles.footerLink}>{t.landing.footer.login}</Link>
            <Link href="/progress" className={styles.footerLink}>{t.landing.footer.test}</Link>
          </div>
        </div>
      </footer>

      {/* ── Sticky CTA ── */}
      <div className={`${styles.stickyCta} ${sticky ? styles.stickyVisible : ''}`}>
        <Link href="/progress" className={styles.stickyBtn}>{t.landing.sticky}</Link>
      </div>

    </div>
  )
}

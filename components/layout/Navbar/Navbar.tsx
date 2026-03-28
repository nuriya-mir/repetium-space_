'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, IconName } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { useI18n, useT, LOCALES, LOCALE_LABELS } from '@/lib/i18n'
import { SettingsPanel } from '@/components/ui/SettingsPanel/SettingsPanel'
import styles from './Navbar.module.css'

export function Navbar() {
  const pathname = usePathname()
  const t = useT()
  const { locale, setLocale } = useI18n()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const mainLinks: { href: string; label: string; icon: IconName }[] = [
    { href: '/home',      label: t.nav.home,      icon: 'home'      },
    { href: '/letters',   label: t.nav.letters,   icon: 'letters'   },
    { href: '/exercises', label: t.nav.exercises, icon: 'exercises' },
    { href: '/progress',  label: t.nav.progress,  icon: 'progress'  },
  ]

  const mobileLinks: { href: string; label: string; icon: IconName }[] = [
    ...mainLinks,
    { href: '/progress?tab=settings', label: t.nav.profile, icon: 'user' },
  ]

  return (
    <>
      {/* Desktop top navbar */}
      <nav className={styles.navbar}>
        <Link href="/" className={styles.logo} aria-label="Repetium — на главную">
          <Logo markHeight={32} wordmarkSize={18} layout="horizontal" />
        </Link>

        <div className={styles.nav}>
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname.startsWith(link.href) ? styles.active : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          {/* Locale switcher */}
          <div className={styles.localeSwitcher} role="group" aria-label="Interface language">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                className={`${styles.localeBtn} ${locale === loc ? styles.localeActive : ''}`}
                onClick={() => setLocale(loc)}
                aria-pressed={locale === loc}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>

          <button
            className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ''}`}
            aria-label={t.nav.settings}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="settings" size={20} />
          </button>
          <button className={styles.iconBtn} aria-label={t.nav.profile}>
            <Icon name="user" size={20} />
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className={styles.mobileTopBar}>
        <Link href="/" className={styles.mobileTopLogo} aria-label="Repetium — на главную">
          <Logo markHeight={24} wordmarkSize={14} layout="horizontal" />
        </Link>
        <div className={styles.mobileTopLocale}>
          {LOCALES.map((loc) => (
            <button
              key={loc}
              className={`${styles.mobileLocaleBtn} ${locale === loc ? styles.mobileLocaleActive : ''}`}
              onClick={() => setLocale(loc)}
              aria-pressed={locale === loc}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile bottom navbar */}
      <nav className={styles.mobileNav}>
        {mobileLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.mobileNavItem} ${pathname.startsWith(link.href.split('?')[0]) ? styles.active : ''}`}
          >
            <Icon name={link.icon} size={20} />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}

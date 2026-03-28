'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n'
import styles from './HouseTabs.module.css'

// Pure house silhouette — no interior decoration, inherits color via currentColor
function HouseIcon() {
  return (
    <svg className={styles.houseIcon} viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <polygon points="0,10 14,0 28,10" fill="currentColor" opacity="0.16" />
      <polygon points="1,10 14,1 27,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <rect x="1" y="10" width="26" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export function HouseTabs() {
  const pathname = usePathname()
  const t = useT()

  const tabs = [
    { href: '/letters/house-1', label: t.letters.tab1, accent: 'blue' },
    { href: '/letters/house-2', label: t.letters.tab2, accent: 'gold' },
    { href: '/letters/house-3', label: t.letters.tab3, accent: 'teal' },
  ]

  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map(({ href, label, accent }) => (
        <Link
          key={href}
          href={href}
          className={`${styles.tab} ${pathname === href ? styles.active : ''}`}
          role="tab"
          aria-selected={pathname === href}
          aria-label={label}
          title={label}
          data-accent={accent}
        >
          <HouseIcon />
        </Link>
      ))}
    </div>
  )
}

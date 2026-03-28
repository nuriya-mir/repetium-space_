'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import { useT } from '@/lib/i18n'
import styles from './page.module.css'

export default function LoginPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
      },
    })

    setSent(true)
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Logo markHeight={52} wordmarkSize={22} layout="stack" />
        </div>

        {sent ? (
          <div className={styles.sentState}>
            <p className={styles.sentTitle}>{t.login.sentTitle}</p>
            <p className={styles.sentDesc}>
              {t.login.sentDesc} <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <>
            <p className={styles.intro}>{t.login.intro}</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.login.placeholder}
                required
                className={styles.input}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={loading || !email}
                className={styles.submitBtn}
              >
                {loading ? t.login.loading : t.login.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

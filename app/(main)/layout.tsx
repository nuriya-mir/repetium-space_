import { Navbar } from '@/components/layout/Navbar'
import styles from './layout.module.css'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        {children}
      </main>
    </>
  )
}

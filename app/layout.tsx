import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import { I18nProvider } from '@/lib/i18n'
import { TargetLangProvider } from '@/lib/languages'
import { PreferencesProvider } from '@/components/PreferencesProvider/PreferencesProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Repetium.space',
  description: 'Французский язык — автоматизация восприятия через структурированное повторение',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F6F5F2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body>
        <I18nProvider>
          <TargetLangProvider>
            <PreferencesProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </PreferencesProvider>
          </TargetLangProvider>
        </I18nProvider>
      </body>
    </html>
  )
}

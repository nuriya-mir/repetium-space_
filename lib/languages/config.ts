import type { Locale } from '@/lib/i18n'

// ─── Target language = the language being learned (currently only French).
// When new languages are added, append them here and nowhere else.

export type TargetLanguage = 'fr' // | 'es' | 'de' | 'it'

export interface LanguageConfig {
  code: TargetLanguage
  /** Display name per UI locale */
  name: Record<Locale, string>
  /** BCP-47 tag used for TTS API */
  ttsLocale: string
  /** Default TTS voice */
  ttsVoice: string
  /** Country flag emoji */
  flag: string
  /** HTML dir attribute */
  dir: 'ltr' | 'rtl'
}

export const TARGET_LANGUAGES: Record<TargetLanguage, LanguageConfig> = {
  fr: {
    code: 'fr',
    name: { ru: 'Французский', en: 'French' },
    ttsLocale: 'fr-FR',
    ttsVoice: 'fr-FR-Neural2-C',
    flag: '🇫🇷',
    dir: 'ltr',
  },
  // Future:
  // es: { code: 'es', name: { ru: 'Испанский', en: 'Spanish' }, ttsLocale: 'es-ES', ... },
  // de: { code: 'de', name: { ru: 'Немецкий',  en: 'German'  }, ttsLocale: 'de-DE', ... },
}

export const DEFAULT_TARGET: TargetLanguage = 'fr'

/** Ordered list of available target languages (for future selector UI) */
export const AVAILABLE_TARGETS: TargetLanguage[] = ['fr']

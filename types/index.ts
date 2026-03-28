// ─── Locale / language ───────────────────────
export type Locale = 'ru' | 'en'
export type TargetLanguage = 'fr' // | 'es' | 'de' | 'it'

// ─── User ───────────────────────────────────
export interface Profile {
  id: string
  email: string
  theme: 'light' | 'dark'
  dyslexia_mode: boolean
  microphone_enabled: boolean
  tts_speed: number
  interface_lang: Locale
  target_language: TargetLanguage
}

// ─── Progress (internal — not exposed to UI labels) ───
export interface UserProgress {
  id: string
  user_id: string
  zone: 1 | 2 | 3
  group_id: string         // 'g1'–'g21', never shown to user
  step: number             // 1–5, difficulty step, never shown to user
  letters_seen: string[]
  letters_mastered: string[]
  last_session_at: string | null
  session_count: number
}

// ─── Letters ─────────────────────────────────
export interface LetterCell {
  letter: string            // 'A'–'Z'
  position: number          // 1–26
  diacritics: string[]      // ['à', 'â'] etc.
  status: 'empty' | 'seen' | 'mastered'
}

// ─── Exercises ───────────────────────────────
export type ExerciseFormat = 'standard' | 'adapted' | 'custom'

export interface GeneratedText {
  id: string
  cache_key: string
  group_id: string
  letter_targets: string[]
  format: ExerciseFormat
  content: string
  word_count: number
}

// ─── Audio ───────────────────────────────────
export interface AudioCacheEntry {
  id: string
  text_hash: string
  text_content: string
  voice: string
  storage_url: string
  duration_ms: number
}

// ─── Feedback states (no red, no stars) ──────
export type FeedbackState = 'idle' | 'correct' | 'try-again' | 'hint'

// ─── Theme ───────────────────────────────────
export type Theme = 'light' | 'dark'

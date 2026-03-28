import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, voice = 'fr-FR-Neural2-C' } = await req.json()

  const text_hash = createHash('sha256').update(text + voice).digest('hex')
  const supabase = await createClient()

  // Check cache
  const { data: cached } = await supabase
    .from('audio_cache')
    .select('storage_url')
    .eq('text_hash', text_hash)
    .single()

  if (cached) return NextResponse.json({ url: cached.storage_url })

  // Call Google Cloud TTS
  const ttsResponse = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'fr-FR', name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 }
      })
    }
  )

  const { audioContent } = await ttsResponse.json()
  const buffer = Buffer.from(audioContent, 'base64')

  // Upload to Supabase Storage
  const filename = `tts/${text_hash}.mp3`
  await supabase.storage.from('audio').upload(filename, buffer, {
    contentType: 'audio/mpeg',
    upsert: true
  })

  const { data: { publicUrl } } = supabase.storage
    .from('audio')
    .getPublicUrl(filename)

  // Save to cache table
  await supabase.from('audio_cache').insert({
    text_hash,
    text_content: text,
    voice,
    storage_url: publicUrl
  })

  return NextResponse.json({ url: publicUrl })
}

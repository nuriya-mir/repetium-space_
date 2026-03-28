export async function synthesizeSpeech(
  text: string,
  voice: string = 'fr-FR-Neural2-C'
): Promise<Buffer> {
  const response = await fetch(
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

  const { audioContent } = await response.json()
  return Buffer.from(audioContent, 'base64')
}

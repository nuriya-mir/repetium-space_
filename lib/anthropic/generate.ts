import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateText(
  group_id: string,
  letter_targets: string[],
  format: string,
  difficulty_step: number
): Promise<string> {
  const prompt = buildPrompt(group_id, letter_targets, format, difficulty_step)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

function buildPrompt(
  group_id: string,
  letter_targets: string[],
  format: string,
  difficulty_step: number
): string {
  return `Generate a French language learning text for adult learners.

Group: ${group_id}
Target letters/patterns: ${letter_targets.join(', ')}
Format: ${format}
Difficulty: ${difficulty_step}/5

Requirements:
- 100-150 words
- Natural French sentences (not artificial)
- Target patterns appear naturally, not forced
- Appropriate for adult learners
- No meta-commentary, just the text itself

Return only the French text, nothing else.`
}

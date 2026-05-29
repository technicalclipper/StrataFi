import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

type ImageInput = {
  base64: string
  mimeType?: string
}

/**
 * Shared helper for all AI route handlers.
 * Calls GPT-4o with JSON response format and optional image inputs.
 * Returns parsed JSON object.
 */
export async function aiJSON({
  system,
  user,
  images,
  model = 'gpt-4o',
}: {
  system: string
  user: string
  images?: ImageInput[]
  model?: 'gpt-4o' | 'gpt-4o-mini'
}): Promise<Record<string, unknown>> {
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

  if (images?.length) {
    for (const img of images) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`,
        },
      })
    }
  }

  userContent.push({ type: 'text', text: user })

  const completion = await getOpenAI().chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    max_tokens: 2000,
  })

  const raw = completion.choices[0]?.message?.content || '{}'
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { error: 'Failed to parse AI response', raw }
  }
}

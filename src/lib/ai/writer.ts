import 'server-only'

import type { z } from 'zod'

import { CLAUDE_MODEL, claudeKey, claudeStructured, writeWithClaude } from '@/lib/ai/claude'
import type { AiEvent, AiProvider, AiRequest } from '@/lib/ai/fields'
import { geminiKey, geminiModel, geminiStructured, writeWithGemini } from '@/lib/ai/gemini'
import type { StructuredResult, WriterContext } from '@/lib/ai/prompts'

export type { WriterContext } from '@/lib/ai/prompts'

/** Claude when its key is set (it can also search the web), otherwise Gemini's free tier. */
function activeProvider(): AiProvider | null {
  if (claudeKey()) return 'claude'
  if (geminiKey()) return 'gemini'
  return null
}

export function aiSetup(): { enabled: boolean; provider: AiProvider | null; message: string } {
  switch (activeProvider()) {
    case 'claude':
      return { enabled: true, provider: 'claude', message: `Claude (${CLAUDE_MODEL}), with web research.` }
    case 'gemini':
      return {
        enabled: true,
        provider: 'gemini',
        message: `Gemini (${geminiModel()}). It reads the sources you add; on the free tier it cannot search the web.`,
      }
    default:
      return {
        enabled: false,
        provider: null,
        message: 'Add a free Gemini API key as GEMINI_API_KEY, or a Claude API key as ANTHROPIC_API_KEY, to turn on the AI writer.',
      }
  }
}

/** One structured answer from the active provider, for tasks that are not about a single post. Never throws. */
export async function generateStructured(system: string, prompt: string, schema: z.ZodType): Promise<StructuredResult> {
  switch (activeProvider()) {
    case 'claude':
      return claudeStructured(system, prompt, schema)
    case 'gemini':
      return geminiStructured(system, prompt, schema)
    default:
      return { ok: false, message: aiSetup().message }
  }
}

/** Writes one field (or every short field, for `meta`) with the active provider, as a stream of events. Never throws. */
export async function* writeWithAi(request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  switch (activeProvider()) {
    case 'claude':
      yield* writeWithClaude(request, context, signal)
      break
    case 'gemini':
      yield* writeWithGemini(request, context, signal)
      break
    default:
      yield { type: 'error', message: aiSetup().message }
  }
}

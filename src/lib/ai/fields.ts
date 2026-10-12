// Shared by the AI writer's route handler and the post editor. Types and
// constants only, so it adds nothing to the browser bundle.

import type { ContentStatus, ContentType, Difficulty, Source } from '@/lib/content/types'

/** Post fields the AI writer can fill in. `meta` writes every short field in one go. */
export const AI_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'body',
  'seo_title',
  'seo_description',
  'keywords',
  'tags',
  'category',
  'difficulty',
  'cover_alt',
  'meta',
] as const
export type AiField = (typeof AI_FIELDS)[number]

/** What the editor currently holds: the AI writes each field with the rest of the post in view. */
export type AiPost = {
  id: string | null
  type: ContentType
  status: ContentStatus
  title: string
  slug: string
  excerpt: string
  body: string
  seoTitle: string
  seoDescription: string
  keywords: string[]
  tags: string[]
  category: string
  difficulty: string
  externalUrl: string
  videoUrl: string
  version: string
  sources: Source[]
}

/** Why a post started on the Trends page is topical, e.g. "Trending on Google in Ghana (2,000+ searches)". */
export type AiTrend = { context: string; region: 'ghana' | 'global' | null }

export type AiRequest = {
  field: AiField
  post: AiPost
  /** The editor's own instructions: angle, audience, points to cover. */
  guidance: string
  /** Body only: search the web and read the sources before writing. */
  research: boolean
  trend: AiTrend | null
  /** Cover alt text only: the image to describe. */
  imageUrl: string | null
}

/** Every short field at once, for "Write the whole post". */
export type AiMeta = {
  title: string
  slug: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  keywords: string[]
  tags: string[]
  category: string | null
  difficulty: Difficulty | null
}

/** One line of the newline-delimited JSON the AI writer streams back. */
export type AiEvent =
  | { type: 'status'; message: string }
  | { type: 'text'; text: string }
  /** Text streamed so far was a note before more research, not part of the body. */
  | { type: 'reset' }
  | { type: 'result'; value: string | string[] | AiMeta }
  /** Pages the AI read or cited while researching, for the Sources list. */
  | { type: 'sources'; sources: Source[] }
  | { type: 'notice'; message: string }
  | { type: 'error'; message: string }
  /** Sent every few seconds so slow networks do not close a quiet connection. */
  | { type: 'ping' }

export const AI_ENDPOINT = '/admin/ai'

/** Who writes: Claude when ANTHROPIC_API_KEY is set, otherwise Gemini (free tier) when GEMINI_API_KEY is. */
export type AiProvider = 'claude' | 'gemini'

export const AI_PROVIDER_NAMES: Record<AiProvider, string> = { claude: 'Claude', gemini: 'Gemini' }

/** AI advice on an existing category (Categories page). */
export type CategoryAdvice = {
  id: string
  name: string
  slug: string
  /** One sentence: keep, rename, merge… */
  note: string
  /** A better description, or empty when the current one is fine. */
  description: string
}

/** A new category the AI suggests (Categories page). */
export type CategorySuggestion = { name: string; slug: string; description: string; reason: string }

export type CategoryAdviceResult =
  | { status: 'ok'; existing: CategoryAdvice[]; suggestions: CategorySuggestion[] }
  | { status: 'error'; message: string }

'use server'

import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'

import {
  contentSlugSchema,
  errorState,
  formBool,
  formList,
  formText,
  optionalId,
  optionalMediaUrl,
  optionalWebUrl,
  parseSourcesJson,
  splitList,
  successState,
  toFieldErrors,
  type ActionState,
  type FieldErrors,
} from '@/lib/admin/validation'
import { requireAdmin } from '@/lib/auth'
import { PUBLIC_CONTENT_TAG } from '@/lib/content/queries'
import {
  CONTENT_TYPES,
  DIFFICULTIES,
  contentPath,
  contentTypeConfig,
  type ContentStatus,
  type ContentType,
} from '@/lib/content/types'
import { parseVideoUrl } from '@/lib/media'
import { notifySearchEngines } from '@/lib/search-engines'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

/** Minimum body length before publishing, to keep thin pages off the site. */
const MIN_BODY_LENGTH: Record<ContentType, number> = {
  article: 500,
  tutorial: 500,
  resource: 150,
  download: 150,
}
const MIN_EXCERPT_LENGTH = 50

const INTENTS = ['save', 'draft', 'review', 'publish'] as const
type Intent = (typeof INTENTS)[number]

const contentFormSchema = z.object({
  id: optionalId,
  type: z.enum(CONTENT_TYPES),
  intent: z.enum(INTENTS),
  title: z.string().trim().min(1, 'Enter a title.').max(200, 'Keep the title under 200 characters.'),
  slug: contentSlugSchema,
  excerpt: z.string().trim().max(320, 'Keep the summary under 320 characters.'),
  body: z.string().max(200000, 'The body is too long (200,000 characters maximum).'),
  category_id: optionalId,
  author_id: optionalId,
  cover_media_id: optionalId,
  cover_image_url: optionalMediaUrl,
  cover_alt: z.string().trim().max(300, 'Keep the alt text under 300 characters.'),
  icon_url: optionalMediaUrl,
  video_url: optionalMediaUrl.refine(
    (value) => !value || parseVideoUrl(value) !== null,
    'Use a YouTube or Vimeo video link, or a direct link to an MP4 or WebM file.',
  ),
  seo_title: z.string().trim().max(70, 'Keep the SEO title under 70 characters.'),
  seo_description: z.string().trim().max(170, 'Keep the meta description under 170 characters.'),
  canonical_url: optionalWebUrl,
  noindex: z.boolean(),
  keywords: z
    .array(z.string().max(50, 'Keep each keyword under 50 characters.'))
    .max(10, 'Use at most 10 keywords.'),
  external_url: optionalWebUrl,
  download_source: z.enum(['file', 'external']),
  file_path: z.union([
    z.literal(''),
    z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,200}$/, 'Upload the file again.'),
  ]),
  file_name: z.string().max(255),
  file_size: z.coerce.number().int().min(0).max(52428800),
  file_mime: z.string().max(150),
  version: z.string().trim().max(50, 'Keep the version under 50 characters.'),
  difficulty: z.union([z.literal(''), z.enum(DIFFICULTIES)]),
  ai_generated: z.boolean(),
  review_confirmed: z.boolean(),
  tag_ids: z.array(z.guid()).max(30, 'Use at most 30 tags.'),
  new_tags: z.array(z.string().max(50, 'Keep tag names under 50 characters.')).max(15, 'Add at most 15 new tags at once.'),
})

function nextStatus(intent: Intent, current: ContentStatus | undefined): ContentStatus {
  switch (intent) {
    case 'publish':
      return 'published'
    case 'review':
      return 'in_review'
    case 'draft':
      return 'draft'
    default:
      return current ?? 'draft'
  }
}

function successMessage(status: ContentStatus, previous: ContentStatus | undefined): string {
  if (status === 'published') {
    return previous === 'published' ? 'Changes published.' : 'Published. The page is now live.'
  }
  if (previous === 'published') return 'Unpublished. The page is no longer public.'
  return status === 'in_review' ? 'Saved and marked as ready for review.' : 'Draft saved.'
}

function databaseError(error: { code?: string; message: string }): ActionState {
  if (error.code === '23505') {
    return errorState('That slug is already in use.', {
      slug: 'Another page already uses this slug. Slugs must be unique across all content.',
    })
  }
  if (error.code === '42501') return errorState('You do not have permission to make this change.')
  console.error(`[admin] content save failed: ${error.message}`)
  return errorState('The item could not be saved. Please try again.')
}

type Supabase = Awaited<ReturnType<typeof createClient>>

async function syncTags(
  supabase: Supabase,
  contentId: string,
  tagIds: string[],
  newTagNames: string[],
): Promise<string | null> {
  const wanted = new Set(tagIds)

  const newTags = [
    ...new Map(
      newTagNames
        .map((name) => ({ name: name.trim(), slug: slugify(name, 60) }))
        .filter((tag) => tag.name && tag.slug)
        .map((tag) => [tag.slug, tag]),
    ).values(),
  ]
  if (newTags.length) {
    const { error: upsertError } = await supabase
      .from('tags')
      .upsert(newTags, { onConflict: 'slug', ignoreDuplicates: true })
    if (upsertError) return upsertError.message
    const { data, error } = await supabase
      .from('tags')
      .select('id')
      .in('slug', newTags.map((tag) => tag.slug))
    if (error) return error.message
    data.forEach((tag) => wanted.add(tag.id))
  }

  const { data: current, error: currentError } = await supabase
    .from('content_tags')
    .select('tag_id')
    .eq('content_id', contentId)
  if (currentError) return currentError.message

  const currentIds = new Set(current.map((row) => row.tag_id))
  const toRemove = [...currentIds].filter((id) => !wanted.has(id))
  const toAdd = [...wanted].filter((id) => !currentIds.has(id))

  if (toRemove.length) {
    const { error } = await supabase
      .from('content_tags')
      .delete()
      .eq('content_id', contentId)
      .in('tag_id', toRemove)
    if (error) return error.message
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from('content_tags')
      .insert(toAdd.map((tagId) => ({ content_id: contentId, tag_id: tagId })))
    if (error) return error.message
  }
  return null
}

export async function saveContent(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()

  const parsed = contentFormSchema.safeParse({
    id: formText(formData, 'id'),
    type: formText(formData, 'type'),
    intent: formText(formData, 'intent'),
    title: formText(formData, 'title'),
    slug: formText(formData, 'slug'),
    excerpt: formText(formData, 'excerpt'),
    body: formText(formData, 'body'),
    category_id: formText(formData, 'category_id'),
    author_id: formText(formData, 'author_id'),
    cover_media_id: formText(formData, 'cover_media_id'),
    cover_image_url: formText(formData, 'cover_image_url'),
    cover_alt: formText(formData, 'cover_alt'),
    icon_url: formText(formData, 'icon_url'),
    video_url: formText(formData, 'video_url'),
    seo_title: formText(formData, 'seo_title'),
    seo_description: formText(formData, 'seo_description'),
    canonical_url: formText(formData, 'canonical_url'),
    noindex: formBool(formData, 'noindex'),
    keywords: splitList(formText(formData, 'keywords')),
    external_url: formText(formData, 'external_url'),
    download_source: formText(formData, 'download_source') || 'file',
    file_path: formText(formData, 'file_path'),
    file_name: formText(formData, 'file_name'),
    file_size: formText(formData, 'file_size') || '0',
    file_mime: formText(formData, 'file_mime'),
    version: formText(formData, 'version'),
    difficulty: formText(formData, 'difficulty'),
    ai_generated: formBool(formData, 'ai_generated'),
    review_confirmed: formBool(formData, 'review_confirmed'),
    tag_ids: formList(formData, 'tag_ids'),
    new_tags: splitList(formText(formData, 'new_tags')),
  })
  const sources = parseSourcesJson(formText(formData, 'sources'))

  if (!parsed.success || !sources.success) {
    return errorState('Please fix the highlighted fields.', {
      ...(parsed.success ? {} : toFieldErrors(parsed.error)),
      ...(sources.success ? {} : { sources: sources.error.issues[0]?.message ?? 'Check the sources.' }),
    })
  }

  const input = parsed.data
  const supabase = await createClient()

  let existing: { id: string; type: string; status: ContentStatus; slug: string; file_path: string | null } | null = null
  if (input.id) {
    const { data, error } = await supabase
      .from('content_items')
      .select('id, type, status, slug, file_path')
      .eq('id', input.id)
      .maybeSingle()
    if (error) return databaseError(error)
    if (!data) return errorState('This item no longer exists.')
    if (data.type !== input.type) return errorState('The content type of an item cannot be changed.')
    existing = { ...data, status: data.status as ContentStatus }
  }

  const status = nextStatus(input.intent, existing?.status)
  const publishing = status === 'published'
  const isDownload = input.type === 'download'
  const useFile = isDownload && input.download_source === 'file'
  const filePath = useFile ? input.file_path || null : null
  const externalUrl =
    input.type === 'resource' || (isDownload && !useFile) ? input.external_url || null : null
  // A linked cover replaces an uploaded one; icons belong to downloads and videos to resources.
  const coverImageUrl = input.cover_image_url || null
  const coverMediaId = coverImageUrl ? null : input.cover_media_id || null
  const iconUrl = isDownload ? input.icon_url || null : null
  const videoUrl = input.type === 'resource' ? input.video_url || null : null

  if (publishing) {
    const errors: FieldErrors = {}
    const label = contentTypeConfig[input.type].plural
    if (input.excerpt.length < MIN_EXCERPT_LENGTH) {
      errors.excerpt = `Write a summary of at least ${MIN_EXCERPT_LENGTH} characters. It appears in listings and search results.`
    }
    if (input.body.trim().length < MIN_BODY_LENGTH[input.type]) {
      errors.body = `${label} need at least ${MIN_BODY_LENGTH[input.type]} characters of body text, so the page is useful on its own.`
    }
    if (input.type === 'resource' && !externalUrl && !videoUrl && !coverMediaId && !coverImageUrl) {
      errors.external_url = 'Add the website address, a video or a cover photo.'
    }
    if (isDownload && useFile && !filePath) errors.file_path = 'Upload the file, or switch to an external link.'
    if (isDownload && !useFile && !externalUrl) errors.external_url = 'Add the download link.'
    if (input.ai_generated && !input.review_confirmed) {
      errors.review_confirmed = 'Confirm that a person has reviewed and fact-checked this AI-assisted content.'
    }
    if (Object.keys(errors).length) {
      return errorState(
        existing?.status === 'published'
          ? 'Your changes were not saved yet: fix the highlighted fields, then press Update live page again. The live page has not changed.'
          : 'Not ready to publish yet. The item was not saved.',
        errors,
      )
    }
  }

  const row = {
    type: input.type,
    status,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    body: input.body.replace(/\s+$/, ''),
    category_id: input.category_id || null,
    author_id: input.author_id || null,
    cover_media_id: coverMediaId,
    cover_image_url: coverImageUrl,
    cover_alt: input.cover_alt || null,
    icon_url: iconUrl,
    video_url: videoUrl,
    seo_title: input.seo_title || null,
    seo_description: input.seo_description || null,
    canonical_url: input.canonical_url || null,
    noindex: input.noindex,
    keywords: input.keywords,
    external_url: externalUrl,
    file_path: filePath,
    file_name: filePath ? input.file_name || filePath.split('/').pop() || null : null,
    file_size: filePath ? input.file_size : null,
    file_mime: filePath ? input.file_mime || null : null,
    version: isDownload ? input.version || null : null,
    difficulty: input.type === 'tutorial' ? input.difficulty || null : null,
    sources: sources.data,
    ai_generated: input.ai_generated,
    // Publishing is the human review: record who approved it and when.
    ...(publishing ? { reviewed_by: admin.id, reviewed_at: new Date().toISOString() } : {}),
  }

  let id = existing?.id
  if (existing) {
    const { error } = await supabase.from('content_items').update(row).eq('id', existing.id)
    if (error) return databaseError(error)
  } else {
    const { data, error } = await supabase.from('content_items').insert(row).select('id').single()
    if (error) return databaseError(error)
    id = data.id
  }
  if (!id) return errorState('The item could not be saved. Please try again.')

  const tagError = await syncTags(supabase, id, input.tag_ids, input.new_tags)

  if (existing?.file_path && existing.file_path !== filePath) {
    const { error } = await supabase.storage.from('downloads').remove([existing.file_path])
    if (error) console.error(`[admin] could not remove replaced file: ${error.message}`)
  }

  // Public pages only change when published content is involved.
  if (publishing || existing?.status === 'published') {
    updateTag(PUBLIC_CONTENT_TAG)
    // Bing and other IndexNow engines recrawl the page (and its old address after a slug change).
    const paths = new Set([contentPath(input.type, input.slug)])
    if (existing && existing.slug !== input.slug) paths.add(contentPath(input.type, existing.slug))
    after(() => notifySearchEngines([...paths]))
  } else {
    refresh()
  }

  if (tagError) console.error(`[admin] tag update failed: ${tagError}`)

  if (!existing) {
    const query = new URLSearchParams({ saved: status, ...(tagError ? { tags: 'failed' } : {}) })
    redirect(`${contentTypeConfig[input.type].adminPath}/${id}?${query.toString()}`)
  }

  if (tagError) return errorState('Saved, but the tags could not be updated. Please try again.')
  return successState(successMessage(status, existing.status))
}

export async function deleteContent(id: string): Promise<ActionState> {
  await requireAdmin()
  if (!z.guid().safeParse(id).success) return errorState('Unknown item.')

  const supabase = await createClient()
  const { data: item, error: loadError } = await supabase
    .from('content_items')
    .select('type, status, slug, file_path')
    .eq('id', id)
    .maybeSingle()
  if (loadError) return databaseError(loadError)
  if (!item) return errorState('This item no longer exists.')

  const { error } = await supabase.from('content_items').delete().eq('id', id)
  if (error) return databaseError(error)

  if (item.file_path) {
    const { error: removeError } = await supabase.storage.from('downloads').remove([item.file_path])
    if (removeError) console.error(`[admin] could not remove file: ${removeError.message}`)
  }

  const type = CONTENT_TYPES.find((value) => value === item.type) ?? 'article'
  if (item.status === 'published') {
    updateTag(PUBLIC_CONTENT_TAG)
    after(() => notifySearchEngines([contentPath(type, item.slug)]))
  }
  redirect(`${contentTypeConfig[type].adminPath}?deleted=1`)
}

import { z } from 'zod'

import type { FieldErrors } from '@/lib/admin/action-state'
import { RESERVED_SLUGS } from '@/lib/content/types'
import { isMediaLibraryUrl } from '@/lib/supabase/config'

export {
  errorState,
  idleState,
  successState,
  type ActionState,
  type FieldErrors,
} from '@/lib/admin/action-state'

/** First message per field, keyed by field name. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const flattened = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>
  const result: FieldErrors = {}
  for (const [key, messages] of Object.entries(flattened)) {
    if (messages?.length) result[key] = messages[0]
  }
  return result
}

// ---------------------------------------------------------------------------
// FormData readers
// ---------------------------------------------------------------------------

export function formText(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export function formBool(formData: FormData, name: string): boolean {
  const value = formData.get(name)
  return value === 'on' || value === 'true' || value === '1'
}

export function formList(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === 'string')
}

/** Splits a comma-separated field into unique, trimmed, non-empty entries. */
export function splitList(value: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of value.split(',')) {
    const entry = part.trim().replace(/\s+/g, ' ')
    const key = entry.toLowerCase()
    if (entry && !seen.has(key)) {
      seen.add(key)
      result.push(entry)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

export const slugSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, 'Enter a slug.')
    .max(maxLength, `Keep the slug under ${maxLength} characters.`)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only.')

export const contentSlugSchema = slugSchema(100).refine(
  (slug) => !(RESERVED_SLUGS as readonly string[]).includes(slug),
  'This slug is reserved by the site. Choose another.',
)

export const webUrlSchema = z
  .string()
  .trim()
  .max(2000, 'This URL is too long.')
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
      error: 'Enter a full web address starting with https://',
    }),
  )

export const optionalWebUrl = z.union([z.literal(''), webUrlSchema])

const httpsUrl = z.url({ protocol: /^https$/, hostname: z.regexes.domain })

/**
 * Images and videos shown on the site. Links to other sites must use https, so
 * pages never load mixed content. Files in the site's own media library use the
 * Supabase URL as it is (plain http only for a local development database).
 */
export const optionalMediaUrl = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .max(2000, 'This URL is too long.')
    .refine((value) => isMediaLibraryUrl(value) || httpsUrl.safeParse(value).success, 'Enter a full https:// address.'),
])

export const optionalId = z.union([z.literal(''), z.guid()])

export const sourceSchema = z.object({
  title: z.string().trim().min(1, 'Each source needs a title.').max(200, 'Source titles must be under 200 characters.'),
  url: webUrlSchema,
  publisher: z.string().trim().max(100).optional().default(''),
})

export const sourcesSchema = z.array(sourceSchema).max(30, 'Add at most 30 sources.')

/** Parses the JSON produced by the sources editor. */
export function parseSourcesJson(raw: string): z.ZodSafeParseResult<z.infer<typeof sourcesSchema>> {
  let value: unknown = []
  try {
    value = raw ? JSON.parse(raw) : []
  } catch {
    value = null
  }
  const rows = Array.isArray(value)
    ? value.filter(
        (row) =>
          row && typeof row === 'object' && (String(row.title ?? '').trim() || String(row.url ?? '').trim()),
      )
    : value
  return sourcesSchema.safeParse(rows)
}

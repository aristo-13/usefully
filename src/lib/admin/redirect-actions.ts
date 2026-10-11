'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  errorState,
  formBool,
  formText,
  optionalId,
  slugSchema,
  successState,
  toFieldErrors,
  webUrlSchema,
  type ActionState,
} from '@/lib/admin/validation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const redirectSchema = z.object({
  id: optionalId,
  slug: slugSchema(100),
  destination_url: webUrlSchema,
  is_active: z.boolean(),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters.'),
})

export async function saveRedirect(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = redirectSchema.safeParse({
    id: formText(formData, 'id'),
    slug: formText(formData, 'slug'),
    destination_url: formText(formData, 'destination_url'),
    is_active: formBool(formData, 'is_active'),
    notes: formText(formData, 'notes'),
  })
  if (!parsed.success) return errorState('Please fix the highlighted fields.', toFieldErrors(parsed.error))

  const { id, ...values } = parsed.data
  const supabase = await createClient()

  // /go/<slug> also serves resource and download links; a redirect would hide them.
  const { data: clash, error: clashError } = await supabase
    .from('content_items')
    .select('title')
    .eq('slug', values.slug)
    .maybeSingle()
  if (clashError) return errorState('The redirect could not be saved. Please try again.')
  if (clash) {
    return errorState('That slug is already used by a page.', {
      slug: `“${clash.title}” already uses /go/${values.slug}. Choose another slug.`,
    })
  }

  const { error } = id
    ? await supabase.from('redirects').update(values).eq('id', id)
    : await supabase.from('redirects').insert(values)

  if (error) {
    if (error.code === '23505') {
      return errorState('That slug is already in use.', { slug: 'Another redirect already uses this slug.' })
    }
    console.error(`[admin] redirect save failed: ${error.message}`)
    return errorState('The redirect could not be saved. Please try again.')
  }

  refresh()
  return successState(id ? 'Changes saved.' : `Created /go/${values.slug}.`)
}

export async function deleteRedirect(id: string): Promise<ActionState> {
  await requireAdmin()
  if (!z.guid().safeParse(id).success) return errorState('Unknown redirect.')

  const supabase = await createClient()
  const { error } = await supabase.from('redirects').delete().eq('id', id)
  if (error) {
    console.error(`[admin] redirect delete failed: ${error.message}`)
    return errorState('The redirect could not be deleted. Please try again.')
  }
  redirect('/admin/redirects?deleted=1')
}

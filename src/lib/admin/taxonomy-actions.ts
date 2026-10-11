'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  errorState,
  formText,
  optionalId,
  slugSchema,
  successState,
  toFieldErrors,
  type ActionState,
} from '@/lib/admin/validation'
import { requireAdmin } from '@/lib/auth'
import { PUBLIC_CONTENT_TAG } from '@/lib/content/queries'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

type Kind = 'categories' | 'tags'

const limits = {
  categories: { name: 80, slug: 80, description: 1000, label: 'category' },
  tags: { name: 50, slug: 60, description: 500, label: 'tag' },
} as const

function schemaFor(kind: Kind) {
  const limit = limits[kind]
  return z.object({
    id: optionalId,
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(limit.name, `Keep the name under ${limit.name} characters.`),
    slug: slugSchema(limit.slug),
    description: z
      .string()
      .trim()
      .max(limit.description, `Keep the description under ${limit.description} characters.`),
  })
}

async function saveTaxonomy(kind: Kind, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const limit = limits[kind]
  const name = formText(formData, 'name')
  const parsed = schemaFor(kind).safeParse({
    id: formText(formData, 'id'),
    name,
    slug: formText(formData, 'slug').trim() || slugify(name, limit.slug),
    description: formText(formData, 'description'),
  })
  if (!parsed.success) return errorState('Please fix the highlighted fields.', toFieldErrors(parsed.error))

  const { id, ...values } = parsed.data
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from(kind).update(values).eq('id', id)
    : await supabase.from(kind).insert(values)

  if (error) {
    if (error.code === '23505') {
      return errorState(`That slug is already in use.`, { slug: `Another ${limit.label} already uses this slug.` })
    }
    console.error(`[admin] ${limit.label} save failed: ${error.message}`)
    return errorState(`The ${limit.label} could not be saved. Please try again.`)
  }

  updateTag(PUBLIC_CONTENT_TAG)
  return successState(id ? 'Changes saved.' : `The ${limit.label} “${values.name}” was created.`)
}

async function deleteTaxonomy(kind: Kind, id: string): Promise<ActionState> {
  await requireAdmin()
  if (!z.guid().safeParse(id).success) return errorState('Unknown item.')

  const supabase = await createClient()
  const { error } = await supabase.from(kind).delete().eq('id', id)
  if (error) {
    console.error(`[admin] ${limits[kind].label} delete failed: ${error.message}`)
    return errorState(`The ${limits[kind].label} could not be deleted. Please try again.`)
  }

  updateTag(PUBLIC_CONTENT_TAG)
  redirect(`/admin/${kind}?deleted=1`)
}

export async function saveCategory(_previous: ActionState, formData: FormData) {
  return saveTaxonomy('categories', formData)
}

export async function saveTag(_previous: ActionState, formData: FormData) {
  return saveTaxonomy('tags', formData)
}

export async function deleteCategory(id: string) {
  return deleteTaxonomy('categories', id)
}

export async function deleteTag(id: string) {
  return deleteTaxonomy('tags', id)
}

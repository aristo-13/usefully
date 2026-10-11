'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'

import {
  errorState,
  formText,
  successState,
  toFieldErrors,
  type ActionState,
} from '@/lib/admin/validation'
import { requireAdmin } from '@/lib/auth'
import { PUBLIC_CONTENT_TAG } from '@/lib/content/queries'
import { createClient } from '@/lib/supabase/server'

const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Enter the name shown on your articles.')
    .max(100, 'Keep the name under 100 characters.'),
  bio: z.string().trim().max(600, 'Keep the bio under 600 characters.'),
})

export async function updateProfile(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const parsed = profileSchema.safeParse({
    display_name: formText(formData, 'display_name'),
    bio: formText(formData, 'bio'),
  })
  if (!parsed.success) return errorState('Please fix the highlighted fields.', toFieldErrors(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', admin.id)
  if (error) {
    console.error(`[admin] profile update failed: ${error.message}`)
    return errorState('Your profile could not be saved. Please try again.')
  }

  // Author names and bios appear on published pages.
  updateTag(PUBLIC_CONTENT_TAG)
  return successState('Profile saved.')
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    new_password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .max(72, 'Use at most 72 characters.'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'The passwords do not match.',
  })
  .refine((data) => data.new_password !== data.current_password, {
    path: ['new_password'],
    message: 'Choose a password different from the current one.',
  })

export async function changePassword(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const parsed = passwordSchema.safeParse({
    current_password: formText(formData, 'current_password'),
    new_password: formText(formData, 'new_password'),
    confirm_password: formText(formData, 'confirm_password'),
  })
  if (!parsed.success) return errorState('Please fix the highlighted fields.', toFieldErrors(parsed.error))
  if (!admin.email) return errorState('Your account has no email address, so the password cannot be changed here.')

  const supabase = await createClient()

  // Re-authenticate before changing the password.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: admin.email,
    password: parsed.data.current_password,
  })
  if (verifyError) {
    return errorState('Please fix the highlighted fields.', {
      current_password: 'The current password is incorrect.',
    })
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password })
  if (error) {
    return errorState(error.message || 'The password could not be changed.')
  }
  return successState('Password changed.')
}

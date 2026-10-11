'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { errorState, formText, type ActionState } from '@/lib/admin/validation'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

const signInSchema = z.object({
  email: z.email('Enter a valid email address.').max(320),
  password: z.string().min(1, 'Enter your password.').max(200),
})

/** Only allow redirects back into the dashboard (prevents open redirects). */
function safeNext(value: string): string {
  return /^\/admin(?:[/?#][\w\-./?=&%#]*)?$/.test(value) ? value : '/admin'
}

export async function signIn(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return errorState('Supabase is not configured. Add the environment variables described in the README.')
  }

  const parsed = signInSchema.safeParse({
    email: formText(formData, 'email').trim(),
    password: formText(formData, 'password'),
  })
  if (!parsed.success) return errorState('Enter your email address and password.')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user) {
    // Same message for unknown accounts and wrong passwords.
    return errorState('Incorrect email or password.')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut()
    return errorState('This account does not have access to the dashboard.')
  }

  redirect(safeNext(formText(formData, 'next')))
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect('/auth/login')
}

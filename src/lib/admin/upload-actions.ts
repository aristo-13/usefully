'use server'

import { z } from 'zod'

import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// Uploads go straight from the browser to Supabase Storage (no server body
// limits), but only through a signed URL created here after the admin check.
// The URL allows exactly one upload to one generated path and expires.

export type SignedUpload = { ok: true; path: string; token: string } | { ok: false; message: string }

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
} as const

const mediaUploadSchema = z.object({
  mimeType: z.enum(Object.keys(IMAGE_EXTENSIONS) as [keyof typeof IMAGE_EXTENSIONS]),
  size: z.number().int().positive().max(5 * 1024 * 1024, 'Images must be 5 MB or smaller.'),
})

const downloadUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(50 * 1024 * 1024, 'Files must be 50 MB or smaller.'),
})

async function signedUpload(bucket: 'media' | 'downloads', path: string): Promise<SignedUpload> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) {
    console.error(`[admin] could not create a signed upload URL: ${error?.message ?? 'no data'}`)
    return { ok: false, message: 'The upload could not be started. Please try again.' }
  }
  return { ok: true, path: data.path, token: data.token }
}

export async function prepareMediaUpload(input: { mimeType: string; size: number }): Promise<SignedUpload> {
  await requireAdmin()
  const parsed = mediaUploadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Use a JPEG, PNG, WebP, GIF or AVIF image.' }
  }

  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const extension = IMAGE_EXTENSIONS[parsed.data.mimeType]
  return signedUpload('media', `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${extension}`)
}

export async function prepareDownloadUpload(input: { fileName: string; size: number }): Promise<SignedUpload> {
  await requireAdmin()
  const parsed = downloadUploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid file.' }

  const safeName =
    parsed.data.fileName
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^[-.]+|-+$/g, '')
      .slice(-200) || 'file'
  return signedUpload('downloads', `${crypto.randomUUID()}/${safeName}`)
}

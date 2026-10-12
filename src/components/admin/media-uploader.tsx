'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload } from 'lucide-react'

import { Field, FormMessage } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { idleState, type ActionState } from '@/lib/admin/action-state'
import { createMediaRecord } from '@/lib/admin/media-actions'
import { prepareMediaUpload } from '@/lib/admin/upload-actions'
import { createUploadClient } from '@/lib/supabase/client'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_BYTES = 5 * 1024 * 1024

async function readDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return { width: null, height: null }
  }
}

export function MediaUploader() {
  const [state, setState] = useState<ActionState>(idleState)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  async function upload(file: File, altText: string): Promise<ActionState> {
    if (!TYPES.includes(file.type)) return { status: 'error', message: 'Use a JPEG, PNG, WebP, GIF or AVIF image.' }
    if (file.size > MAX_BYTES) return { status: 'error', message: 'Images must be 5 MB or smaller.' }

    const { width, height } = await readDimensions(file)
    const prepared = await prepareMediaUpload({ mimeType: file.type, size: file.size })
    if (!prepared.ok) return { status: 'error', message: prepared.message }

    const { error } = await createUploadClient()
      .storage.from('media')
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) return { status: 'error', message: `Upload failed: ${error.message}` }

    return createMediaRecord({
      path: prepared.path,
      fileName: file.name.slice(0, 255),
      mimeType: file.type as 'image/jpeg',
      size: file.size,
      width,
      height,
      altText,
    })
  }

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        const file = data.get('file')
        const altText = String(data.get('alt_text') ?? '').trim()
        if (!(file instanceof File) || file.size === 0) {
          setState({ status: 'error', message: 'Choose an image to upload.' })
          return
        }
        if (altText.length > 300) {
          setState({ status: 'error', message: 'Keep alt text under 300 characters.' })
          return
        }
        startTransition(async () => {
          const result = await upload(file, altText)
          setState(result)
          if (result.status === 'success') form.reset()
        })
      }}
    >
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="media-file" label="Image" required hint="JPEG, PNG, WebP, GIF or AVIF, up to 5 MB.">
          <input
            id="media-file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            aria-describedby="media-file-hint"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
          />
        </Field>
        <Field
          name="media-alt"
          label="Alt text"
          hint="Describe what the image shows for people who cannot see it. Leave empty only for purely decorative images."
        >
          <Input id="media-alt" name="alt_text" maxLength={300} aria-describedby="media-alt-hint" />
        </Field>
      </div>
      <button type="submit" disabled={isPending} className={buttonVariants()}>
        <Upload aria-hidden />
        {isPending ? 'Uploading…' : 'Upload image'}
      </button>
    </form>
  )
}

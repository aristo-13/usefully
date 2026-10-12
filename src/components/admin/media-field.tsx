'use client'

import Image from 'next/image'
import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { Upload, X } from 'lucide-react'

import { fieldAria } from '@/components/admin/form'
import { VideoPlayer } from '@/components/content/video-player'
import { buttonVariants } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { createMediaRecord } from '@/lib/admin/media-actions'
import type { MediaOption } from '@/lib/admin/types'
import { prepareMediaUpload } from '@/lib/admin/upload-actions'
import {
  IMAGE_TYPES,
  VIDEO_TYPES,
  parseVideoUrl,
  readImageDimensions,
  uploadProblem,
  type MediaType,
  type VideoSource,
} from '@/lib/media'
import { createUploadClient } from '@/lib/supabase/client'
import { isMediaLibraryUrl } from '@/lib/supabase/config'
import { cn } from '@/lib/utils'

type Kind = 'cover' | 'icon' | 'video'
type Mode = 'upload' | 'link' | 'library'

/** A file in the media library (uploaded here or picked), or a link to another site. */
type Value = { source: 'none' } | { source: 'library'; id: string | null; url: string } | { source: 'link'; url: string }

const COPY: Record<Kind, { field: string; noun: string; accept: string; uploadHint: string; linkHint: string; placeholder: string }> = {
  cover: {
    field: 'cover_image_url',
    noun: 'image',
    accept: IMAGE_TYPES.join(','),
    uploadHint: 'JPEG, PNG, WebP, GIF or AVIF, up to 5 MB. Saved to the media library.',
    linkHint: 'A direct link to an image file on another site.',
    placeholder: 'https://example.com/photo.jpg',
  },
  icon: {
    field: 'icon_url',
    noun: 'icon',
    accept: IMAGE_TYPES.join(','),
    uploadHint: 'A square image of at least 128 × 128 pixels, up to 5 MB.',
    linkHint: 'A direct link to the icon image, for example from the official website.',
    placeholder: 'https://example.com/icon.png',
  },
  video: {
    field: 'video_url',
    noun: 'video',
    accept: VIDEO_TYPES.join(','),
    uploadHint: 'MP4 or WebM, up to 50 MB. Saved to the media library.',
    linkHint: 'A YouTube or Vimeo link, or a direct link to an MP4 or WebM file.',
    placeholder: 'https://www.youtube.com/watch?v=…',
  },
}

const MODE_LABELS: Record<Mode, string> = { upload: 'Upload', link: 'Link', library: 'Library' }

function initialValue(kind: Kind, initial: { id?: string | null; url: string; libraryUrl?: string | null }): Value {
  if (kind === 'cover' && initial.id && initial.libraryUrl) return { source: 'library', id: initial.id, url: initial.libraryUrl }
  if (!initial.url) return { source: 'none' }
  return kind !== 'cover' && isMediaLibraryUrl(initial.url)
    ? { source: 'library', id: null, url: initial.url }
    : { source: 'link', url: initial.url }
}

/**
 * An image or video for a post: uploaded, linked from another site or picked
 * from the media library, with a preview that updates as soon as it changes.
 * Submits `cover_media_id` / `cover_image_url` / `cover_alt` for covers, and a
 * single URL (`icon_url`, `video_url`) for icons and videos.
 */
export function MediaField({
  kind,
  label,
  hint,
  media,
  initial,
  errors = {},
  onChange,
  altAction,
}: {
  kind: Kind
  label: string
  hint?: string
  media: MediaOption[]
  initial: { id?: string | null; url: string; libraryUrl?: string | null; alt?: string }
  errors?: { url?: string; alt?: string }
  onChange?: () => void
  /** Covers only: a control next to the alt text label, given the image's web address (null while none is ready). */
  altAction?: (props: { imageUrl: string | null; alt: string; setAlt: (alt: string) => void }) => ReactNode
}) {
  const copy = COPY[kind]
  const [value, setValue] = useState<Value>(() => initialValue(kind, initial))
  const [mode, setMode] = useState<Mode>(value.source === 'link' ? 'link' : 'upload')
  const [linkText, setLinkText] = useState(value.source === 'link' ? value.url : '')
  const [previewLink, setPreviewLink] = useState(linkText)
  const [alt, setAlt] = useState(initial.alt ?? '')
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [uploading, startUpload] = useTransition()

  const options = media.filter((item) => item.url && item.kind === (kind === 'video' ? 'video' : 'image'))
  const libraryItem = value.source === 'library' ? options.find((item) => item.id === value.id || item.url === value.url) : undefined

  // Typing a link updates the value at once; the preview follows a moment later.
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewLink(linkText.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [linkText])

  useEffect(() => {
    if (!localPreview) return
    return () => URL.revokeObjectURL(localPreview)
  }, [localPreview])

  function choose(next: Value) {
    setValue(next)
    setLocalPreview(null)
    setProblem(null)
    onChange?.()
  }

  function upload(file: File) {
    const fileProblem = uploadProblem(file, kind === 'video' ? 'video' : 'image')
    if (fileProblem) {
      setProblem(fileProblem)
      return
    }
    setProblem(null)
    setLocalPreview(URL.createObjectURL(file))
    startUpload(async () => {
      try {
        const size = kind === 'video' ? { width: null, height: null } : await readImageDimensions(file)
        const prepared = await prepareMediaUpload({ mimeType: file.type, size: file.size })
        if (!prepared.ok) throw new Error(prepared.message)
        const { error } = await createUploadClient()
          .storage.from('media')
          .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type, cacheControl: '31536000' })
        if (error) throw new Error(error.message)
        const record = await createMediaRecord({
          path: prepared.path,
          fileName: file.name.slice(0, 255),
          mimeType: file.type as MediaType,
          size: file.size,
          ...size,
          altText: kind === 'cover' ? alt.trim().slice(0, 300) : '',
        })
        if (record.status !== 'success' || !record.id || !record.url) throw new Error(record.message ?? 'The file could not be saved.')
        // Keep showing the local preview: it is the same file, already loaded.
        setValue({ source: 'library', id: record.id, url: record.url })
        onChange?.()
      } catch (caught) {
        setLocalPreview(null)
        setProblem(`Upload failed: ${caught instanceof Error ? caught.message : 'unknown error'}`)
      }
    })
  }

  const previewSrc =
    localPreview ?? (value.source === 'library' ? value.url : value.source === 'link' ? previewLink || null : null)
  const video: VideoSource | null =
    kind !== 'video' || !previewSrc ? null : localPreview ? { provider: 'file', url: localPreview } : parseVideoUrl(previewSrc)
  const error = problem ?? errors.url
  const field = copy.field
  // The saved image (not a local preview), which the AI writer can open to describe it.
  const webImage = !uploading && !localPreview && previewSrc && /^https?:\/\//.test(previewSrc) ? previewSrc : null

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {hint ? <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}

      {kind === 'cover' ? (
        <>
          <input type="hidden" name="cover_media_id" value={value.source === 'library' ? (value.id ?? '') : ''} />
          <input type="hidden" name="cover_image_url" value={value.source === 'link' ? value.url : ''} />
        </>
      ) : (
        <input type="hidden" name={field} value={value.source === 'none' ? '' : value.url} />
      )}

      <div role="radiogroup" aria-label={`Add the ${copy.noun} by`} className="inline-flex rounded-md border border-border p-0.5 text-sm">
        {(['upload', 'link', 'library'] as const).map((option) => (
          <label
            key={option}
            className={cn(
              'cursor-pointer rounded px-3 py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
              mode === option ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <input
              type="radio"
              name={`${field}-mode`}
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              className="sr-only"
            />
            {MODE_LABELS[option]}
          </label>
        ))}
      </div>

      {mode === 'upload' ? (
        <div className="space-y-1.5">
          <label
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'cursor-pointer focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
              uploading && 'pointer-events-none opacity-60',
            )}
          >
            <Upload aria-hidden />
            {uploading ? 'Uploading…' : value.source === 'none' ? `Upload ${copy.noun}` : `Upload a different ${copy.noun}`}
            <input
              type="file"
              accept={copy.accept}
              className="sr-only"
              disabled={uploading}
              aria-describedby={`${field}-upload-hint${error ? ` ${field}-error` : ''}`}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) upload(file)
              }}
            />
          </label>
          <p id={`${field}-upload-hint`} className="text-xs text-muted-foreground">
            {copy.uploadHint}
          </p>
        </div>
      ) : null}

      {mode === 'link' ? (
        <div className="space-y-1.5">
          <Input
            id={field}
            type="url"
            inputMode="url"
            placeholder={copy.placeholder}
            maxLength={2000}
            value={linkText}
            aria-label={`Link to the ${copy.noun}`}
            onChange={(event) => {
              const text = event.target.value
              setLinkText(text)
              setValue(text.trim() ? { source: 'link', url: text.trim() } : { source: 'none' })
              setLocalPreview(null)
              setProblem(null)
            }}
            onPaste={(event) => setPreviewLink(event.clipboardData.getData('text').trim())}
            {...fieldAria(field, { hint: true, error })}
          />
          <p id={`${field}-hint`} className="text-xs text-muted-foreground">
            {copy.linkHint}
          </p>
        </div>
      ) : null}

      {mode === 'library' ? (
        options.length ? (
          <Select
            aria-label={`Choose a ${copy.noun} from the media library`}
            value={libraryItem?.id ?? ''}
            onChange={(event) => {
              const picked = options.find((item) => item.id === event.target.value)
              choose(picked?.url ? { source: 'library', id: picked.id, url: picked.url } : { source: 'none' })
            }}
          >
            <option value="">No {copy.noun}</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fileName}
                {item.altText ? ` – ${item.altText}` : ''}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            No {kind === 'video' ? 'videos' : 'images'} in the media library yet. Upload one instead.
          </p>
        )
      ) : null}

      {error ? (
        <p id={`${field}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {previewSrc ? (
        <div className="space-y-2">
          {kind === 'video' ? (
            video ? (
              <VideoPlayer
                key={video.url}
                video={video}
                title="Preview"
                onError={() => setBrokenSrc(previewSrc)}
                className={cn(uploading && 'opacity-60')}
              />
            ) : (
              <p className="text-xs font-medium text-destructive">{copy.linkHint}</p>
            )
          ) : (
            <div
              className={cn(
                'relative overflow-hidden border border-border bg-muted',
                kind === 'icon' ? 'size-24 rounded-2xl' : 'aspect-[1.91/1] rounded-md',
              )}
            >
              <Image
                key={previewSrc}
                src={previewSrc}
                alt=""
                fill
                sizes="320px"
                unoptimized
                onLoad={() => setBrokenSrc(null)}
                onError={() => setBrokenSrc(previewSrc)}
                className={cn(kind === 'icon' ? 'object-cover' : 'object-contain', uploading && 'opacity-60')}
              />
            </div>
          )}
          {brokenSrc === previewSrc ? (
            <p className="text-xs font-medium text-destructive">
              This {copy.noun} could not be loaded. Check that the link points directly to {kind === 'video' ? 'a video' : 'an image'} file.
            </p>
          ) : null}
          {uploading ? <p className="text-xs text-muted-foreground">Uploading to the media library…</p> : null}
          {!uploading ? (
            <button
              type="button"
              onClick={() => {
                setLinkText('')
                choose({ source: 'none' })
              }}
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2' })}
            >
              <X aria-hidden />
              Remove {copy.noun}
            </button>
          ) : null}
        </div>
      ) : null}

      {kind === 'cover' ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label htmlFor="cover_alt" className="text-sm font-medium text-foreground">
              Alt text
            </label>
            {altAction?.({
              imageUrl: webImage,
              alt,
              setAlt: (next) => {
                setAlt(next)
                onChange?.()
              },
            })}
          </div>
          <Input
            id="cover_alt"
            name="cover_alt"
            maxLength={300}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder={libraryItem?.altText || 'Describe what the image shows'}
            {...fieldAria('cover_alt', { hint: true, error: errors.alt })}
          />
          <p id="cover_alt-hint" className="text-xs text-muted-foreground">
            For people who cannot see the image.
            {value.source === 'library' ? ' Leave empty to use the alt text from the media library.' : ''}
          </p>
          {errors.alt ? (
            <p id="cover_alt-error" className="text-xs font-medium text-destructive">
              {errors.alt}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}

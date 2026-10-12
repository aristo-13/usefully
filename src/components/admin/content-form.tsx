'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, Eye, Plus, Upload, X } from 'lucide-react'

import { CharacterCount, Field, FormMessage, fieldAria, useActionForm } from '@/components/admin/form'
import { StatusBadge } from '@/components/admin/ui'
import { buttonVariants } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { saveContent } from '@/lib/admin/content-actions'
import { prepareDownloadUpload } from '@/lib/admin/upload-actions'
import type { EditableContent, MediaOption, Option } from '@/lib/admin/types'
import {
  DIFFICULTIES,
  contentPath,
  contentTypeConfig,
  difficultyLabels,
  type ContentType,
  type Source,
} from '@/lib/content/types'
import { createUploadClient } from '@/lib/supabase/client'
import { cn, formatBytes, formatDate, slugify } from '@/lib/utils'

type FileInfo = { path: string; name: string; size: number; mime: string }
type SourceRow = Source & { key: number }

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024

function SourcesField({ initial, error }: { initial: Source[]; error?: string }) {
  const nextKey = useRef(initial.length)
  const [rows, setRows] = useState<SourceRow[]>(() =>
    initial.map((source, index) => ({ ...source, publisher: source.publisher ?? '', key: index })),
  )

  const update = (key: number, field: keyof Source, value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)))

  return (
    <fieldset className="space-y-3" aria-describedby={error ? 'sources-error' : 'sources-hint'}>
      <legend className="text-sm font-medium text-foreground">Sources</legend>
      <p id="sources-hint" className="text-xs leading-relaxed text-muted-foreground">
        Cite the pages you relied on for facts, figures and quotes. Only add sources you have actually
        checked; they are listed at the end of the page.
      </p>
      <input
        type="hidden"
        name="sources"
        value={JSON.stringify(rows.map(({ title, url, publisher }) => ({ title, url, publisher })))}
      />
      {rows.map((row, index) => (
        <div key={row.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_9rem_auto]">
          <Input
            aria-label={`Source ${index + 1} title`}
            placeholder="Title"
            value={row.title}
            maxLength={200}
            onChange={(event) => update(row.key, 'title', event.target.value)}
          />
          <Input
            aria-label={`Source ${index + 1} URL`}
            placeholder="https://"
            type="url"
            value={row.url}
            maxLength={2000}
            onChange={(event) => update(row.key, 'url', event.target.value)}
          />
          <Input
            aria-label={`Source ${index + 1} publisher (optional)`}
            placeholder="Publisher"
            value={row.publisher ?? ''}
            maxLength={100}
            onChange={(event) => update(row.key, 'publisher', event.target.value)}
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            aria-label={`Remove source ${index + 1}`}
          >
            <X aria-hidden />
          </button>
        </div>
      ))}
      {rows.length < 30 ? (
        <button
          type="button"
          onClick={() =>
            setRows((current) => [...current, { title: '', url: '', publisher: '', key: nextKey.current++ }])
          }
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Plus aria-hidden />
          Add source
        </button>
      ) : null}
      {error ? (
        <p id="sources-error" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function DownloadFileField({
  file,
  onChange,
  error,
}: {
  file: FileInfo | null
  onChange: (file: FileInfo | null) => void
  error?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(selected: File) {
    setUploadError(null)
    if (selected.size > MAX_DOWNLOAD_BYTES) {
      setUploadError('Files must be 50 MB or smaller.')
      return
    }
    setUploading(true)
    try {
      const prepared = await prepareDownloadUpload({ fileName: selected.name, size: selected.size })
      if (!prepared.ok) throw new Error(prepared.message)
      const mime = selected.type || 'application/octet-stream'
      const { error: storageError } = await createUploadClient()
        .storage.from('downloads')
        .uploadToSignedUrl(prepared.path, prepared.token, selected, { contentType: mime })
      if (storageError) throw storageError
      onChange({ path: prepared.path, name: selected.name.slice(0, 255), size: selected.size, mime })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unknown error'
      setUploadError(`Upload failed: ${message}`)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="file_path" value={file?.path ?? ''} />
      <input type="hidden" name="file_name" value={file?.name ?? ''} />
      <input type="hidden" name="file_size" value={file?.size ?? 0} />
      <input type="hidden" name="file_mime" value={file?.mime ?? ''} />

      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
          <span className="min-w-0 break-all">
            <span className="font-medium text-foreground">{file.name}</span>{' '}
            <span className="text-muted-foreground">({formatBytes(file.size)})</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Remove
          </button>
        </div>
      ) : null}

      <label
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'cursor-pointer focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <Upload aria-hidden />
        {uploading ? 'Uploading…' : file ? 'Replace file' : 'Upload file'}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          disabled={uploading}
          {...fieldAria('file_path', { hint: true, error: uploadError ?? error })}
          onChange={(event) => {
            const selected = event.target.files?.[0]
            if (selected) void upload(selected)
          }}
        />
      </label>
      <p id="file_path-hint" className="text-xs text-muted-foreground">
        Up to 50 MB. Files are stored privately and served through short-lived links once published.
      </p>
      {uploadError || error ? (
        <p id="file_path-error" className="text-xs font-medium text-destructive">
          {uploadError ?? error}
        </p>
      ) : null}
    </div>
  )
}

function CoverField({ media, initialId }: { media: MediaOption[]; initialId: string | null }) {
  const [coverId, setCoverId] = useState(initialId ?? '')
  const selected = media.find((item) => item.id === coverId)

  return (
    <div className="space-y-2">
      <Select
        id="cover_media_id"
        name="cover_media_id"
        value={coverId}
        onChange={(event) => setCoverId(event.target.value)}
        aria-describedby="cover_media_id-hint"
      >
        <option value="">No cover image</option>
        {media.map((item) => (
          <option key={item.id} value={item.id}>
            {item.fileName}
            {item.altText ? ` – ${item.altText}` : ''}
          </option>
        ))}
      </Select>
      {selected?.url ? (
        <div className="relative aspect-[1.91/1] overflow-hidden rounded-md border border-border bg-muted">
          <Image src={selected.url} alt="" fill sizes="320px" className="object-cover" />
        </div>
      ) : null}
      {selected && !selected.altText ? (
        <p className="text-xs font-medium text-warning">This image has no alt text. Add it in the media library.</p>
      ) : null}
      <p id="cover_media_id-hint" className="text-xs text-muted-foreground">
        Also used when the page is shared. Upload images in the{' '}
        <Link href="/admin/media" className="text-link underline">
          media library
        </Link>
        .
      </p>
    </div>
  )
}

export function ContentForm({
  type,
  item,
  categories,
  tags,
  authors,
  media,
  defaultAuthorId,
  siteUrl,
  notice,
}: {
  type: ContentType
  item: EditableContent | null
  categories: Option[]
  tags: Option[]
  authors: Option[]
  media: MediaOption[]
  defaultAuthorId: string
  siteUrl: string
  notice?: string
}) {
  const config = contentTypeConfig[type]
  const status = item?.status ?? 'draft'
  const { state, pending, onSubmit } = useActionForm(saveContent)
  const errors = state.fieldErrors ?? {}

  const [title, setTitle] = useState(item?.title ?? '')
  const [slug, setSlug] = useState(item?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(item))
  const [excerpt, setExcerpt] = useState(item?.excerpt ?? '')
  const [body, setBody] = useState(item?.body ?? '')
  const [seoTitle, setSeoTitle] = useState(item?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(item?.seoDescription ?? '')
  const [aiGenerated, setAiGenerated] = useState(item?.aiGenerated ?? false)
  const [downloadSource, setDownloadSource] = useState<'file' | 'external'>(
    item && !item.filePath && item.externalUrl ? 'external' : 'file',
  )
  const [file, setFile] = useState<FileInfo | null>(
    item?.filePath
      ? {
          path: item.filePath,
          name: item.fileName ?? item.filePath.split('/').pop() ?? 'file',
          size: item.fileSize ?? 0,
          mime: item.fileMime ?? '',
        }
      : null,
  )
  const [dirty, setDirty] = useState(false)

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const [savedState, setSavedState] = useState(state)
  if (savedState !== state) {
    setSavedState(state)
    if (state.status === 'success') setDirty(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (
      status === 'published' &&
      submitter?.value === 'draft' &&
      !window.confirm('Unpublish this page? It will stop being available on the public site.')
    ) {
      event.preventDefault()
      return
    }
    onSubmit(event)
  }

  const path = contentPath(type, slug || 'your-slug')
  const snippetTitle = seoTitle || title || 'Page title'
  const snippetDescription = seoDescription || excerpt || 'The summary is used as the description.'
  const seoHasErrors = ['seo_title', 'seo_description', 'canonical_url', 'keywords'].some((key) => errors[key])

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setDirty(true)}
      onKeyDown={(event) => {
        // Enter in a single-line field would trigger the first button (Publish).
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') event.preventDefault()
      }}
      className="space-y-6"
    >
      <input type="hidden" name="type" value={type} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      {notice && state.status === 'idle' ? <FormMessage state={{ status: 'success', message: notice }} /> : null}
      <FormMessage state={state} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Field name="title" label="Title" required error={errors.title} counter={<CharacterCount value={title} max={200} />}>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                if (!slugEdited) setSlug(slugify(event.target.value))
              }}
              {...fieldAria('title', { error: errors.title })}
            />
          </Field>

          <Field
            name="slug"
            label="URL slug"
            required
            error={errors.slug}
            hint={
              <>
                {siteUrl.replace(/^https?:\/\//, '')}
                {path}
                {status === 'published' ? ' — changing the slug of a live page breaks existing links to it.' : null}
              </>
            }
          >
            <Input
              id="slug"
              name="slug"
              required
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true)
                setSlug(event.target.value.toLowerCase())
              }}
              {...fieldAria('slug', { hint: true, error: errors.slug })}
            />
          </Field>

          <Field
            name="excerpt"
            label="Summary"
            error={errors.excerpt}
            counter={<CharacterCount value={excerpt} max={320} />}
            hint="One or two plain sentences that directly answer what this page covers. Shown in listings, search results and as the meta description."
          >
            <Textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              maxLength={320}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              {...fieldAria('excerpt', { hint: true, error: errors.excerpt })}
            />
          </Field>

          {type === 'resource' ? (
            <Field
              name="external_url"
              label="Website address"
              error={errors.external_url}
              hint="Required before publishing. Visitors reach it through a /go/ link, which counts clicks."
            >
              <Input
                id="external_url"
                name="external_url"
                type="url"
                placeholder="https://"
                maxLength={2000}
                defaultValue={item?.externalUrl}
                {...fieldAria('external_url', { hint: true, error: errors.external_url })}
              />
            </Field>
          ) : null}

          {type === 'download' ? (
            <fieldset className="space-y-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium text-foreground">Download</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="download_source"
                    value="file"
                    checked={downloadSource === 'file'}
                    onChange={() => setDownloadSource('file')}
                  />
                  Uploaded file
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="download_source"
                    value="external"
                    checked={downloadSource === 'external'}
                    onChange={() => setDownloadSource('external')}
                  />
                  External link
                </label>
              </div>
              {downloadSource === 'file' ? (
                <DownloadFileField file={file} onChange={setFile} error={errors.file_path} />
              ) : (
                <Field
                  name="external_url"
                  label="Download link"
                  error={errors.external_url}
                  hint="Required before publishing. For files hosted elsewhere, such as an official release page."
                >
                  <Input
                    id="external_url"
                    name="external_url"
                    type="url"
                    placeholder="https://"
                    maxLength={2000}
                    defaultValue={item?.externalUrl}
                    {...fieldAria('external_url', { hint: true, error: errors.external_url })}
                  />
                </Field>
              )}
              <Field name="version" label="Version" error={errors.version} hint="Optional, e.g. 2.1 or 2026-10.">
                <Input
                  id="version"
                  name="version"
                  maxLength={50}
                  defaultValue={item?.version}
                  className="max-w-48"
                  {...fieldAria('version', { hint: true, error: errors.version })}
                />
              </Field>
            </fieldset>
          ) : null}

          {type === 'tutorial' ? (
            <Field name="difficulty" label="Difficulty" error={errors.difficulty}>
              <Select id="difficulty" name="difficulty" defaultValue={item?.difficulty ?? ''} className="max-w-60">
                <option value="">Not specified</option>
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {difficultyLabels[level]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field
            name="body"
            label="Body (Markdown)"
            error={errors.body}
            counter={
              <span className="text-xs text-muted-foreground tabular-nums">
                {body.trim() ? body.trim().split(/\s+/).length : 0} words
              </span>
            }
            hint={
              <>
                Use <code>## Heading</code> for sections (they build the table of contents), <code>**bold**</code>,{' '}
                <code>[link text](https://…)</code>, <code>- list items</code> and fenced code blocks. HTML is not
                rendered. Write for readers first: explain, show steps, and avoid filler.
              </>
            }
          >
            <Textarea
              id="body"
              name="body"
              rows={24}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="font-mono text-[0.85rem] leading-6"
              spellCheck
              {...fieldAria('body', { hint: true, error: errors.body })}
            />
          </Field>

          <SourcesField initial={item?.sources ?? []} error={errors.sources} />

          <details open={seoHasErrors || undefined} className="group rounded-lg border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
              Search engine settings
            </summary>
            <div className="space-y-5 border-t border-border p-4">
              <div className="rounded-md border border-border bg-muted/40 p-3" aria-label="Search result preview">
                <p className="truncate text-xs text-muted-foreground">
                  {siteUrl.replace(/^https?:\/\//, '')}
                  {path}
                </p>
                <p className="truncate text-base text-link">{snippetTitle}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{snippetDescription}</p>
              </div>
              <Field
                name="seo_title"
                label="SEO title"
                error={errors.seo_title}
                counter={<CharacterCount value={seoTitle} max={70} />}
                hint="Optional. Replaces the full browser/search title. Leave empty to use the title plus the site name."
              >
                <Input
                  id="seo_title"
                  name="seo_title"
                  maxLength={70}
                  value={seoTitle}
                  onChange={(event) => setSeoTitle(event.target.value)}
                  {...fieldAria('seo_title', { hint: true, error: errors.seo_title })}
                />
              </Field>
              <Field
                name="seo_description"
                label="Meta description"
                error={errors.seo_description}
                counter={<CharacterCount value={seoDescription} max={170} />}
                hint="Optional. Leave empty to use the summary."
              >
                <Textarea
                  id="seo_description"
                  name="seo_description"
                  rows={2}
                  maxLength={170}
                  value={seoDescription}
                  onChange={(event) => setSeoDescription(event.target.value)}
                  {...fieldAria('seo_description', { hint: true, error: errors.seo_description })}
                />
              </Field>
              <Field
                name="keywords"
                label="Keywords"
                error={errors.keywords}
                hint="Optional, comma-separated, up to 10. Used by site search and the keywords meta tag. Keep them precise; repeating phrases does not help."
              >
                <Input
                  id="keywords"
                  name="keywords"
                  defaultValue={item?.keywords.join(', ')}
                  {...fieldAria('keywords', { hint: true, error: errors.keywords })}
                />
              </Field>
              <Field
                name="canonical_url"
                label="Canonical URL"
                error={errors.canonical_url}
                hint="Only if this content was first published elsewhere. Leave empty to use this page’s own URL."
              >
                <Input
                  id="canonical_url"
                  name="canonical_url"
                  type="url"
                  placeholder="https://"
                  defaultValue={item?.canonicalUrl}
                  {...fieldAria('canonical_url', { hint: true, error: errors.canonical_url })}
                />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="noindex" defaultChecked={item?.noindex} className="mt-1" />
                <span>
                  Hide from search engines (<code>noindex</code>). The page stays public and is left out of the
                  sitemap.
                </span>
              </label>
            </div>
          </details>
        </div>

        <div className="space-y-5">
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Status</h2>
              <StatusBadge status={status} />
            </div>
            {item ? (
              <dl className="space-y-1 text-xs text-muted-foreground">
                {item.publishedAt ? (
                  <div className="flex justify-between gap-2">
                    <dt>First published</dt>
                    <dd>{formatDate(item.publishedAt)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt>Last updated</dt>
                  <dd>{formatDate(item.updatedAt)}</dd>
                </div>
                {item.reviewedAt ? (
                  <div className="flex justify-between gap-2">
                    <dt>Approved</dt>
                    <dd>
                      {formatDate(item.reviewedAt)}
                      {item.reviewerName ? ` by ${item.reviewerName}` : ''}
                    </dd>
                  </div>
                ) : null}
                {type === 'resource' || type === 'download' ? (
                  <div className="flex justify-between gap-2">
                    <dt>{type === 'download' ? 'Downloads' : 'Clicks'}</dt>
                    <dd className="tabular-nums">{item.clickCount}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">New {config.label.toLowerCase()}, not saved yet.</p>
            )}

            <div className="space-y-3 border-t border-border pt-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="ai_generated"
                  checked={aiGenerated}
                  onChange={(event) => setAiGenerated(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  Drafted with AI assistance
                  <span className="block text-xs text-muted-foreground">
                    Disclosed on the page. Stays a draft until a person reviews and approves it.
                  </span>
                </span>
              </label>
              {aiGenerated ? (
                <div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="review_confirmed"
                      className="mt-1"
                      {...fieldAria('review_confirmed', { error: errors.review_confirmed })}
                    />
                    <span>I have read this content in full, checked its facts and sources, and approve it.</span>
                  </label>
                  {errors.review_confirmed ? (
                    <p id="review_confirmed-error" className="mt-1 text-xs font-medium text-destructive">
                      {errors.review_confirmed}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {status === 'published' ? (
                <>
                  <button type="submit" name="intent" value="save" disabled={pending} className={buttonVariants({ size: 'lg' })}>
                    {pending ? 'Saving…' : 'Update live page'}
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="draft"
                    disabled={pending}
                    className={buttonVariants({ variant: 'outline', size: 'lg' })}
                  >
                    Unpublish
                  </button>
                </>
              ) : (
                <>
                  <button type="submit" name="intent" value="publish" disabled={pending} className={buttonVariants({ size: 'lg' })}>
                    {pending ? 'Saving…' : 'Publish'}
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="save"
                    disabled={pending}
                    className={buttonVariants({ variant: 'outline', size: 'lg' })}
                  >
                    {status === 'in_review' ? 'Save' : 'Save draft'}
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value={status === 'in_review' ? 'draft' : 'review'}
                    disabled={pending}
                    className={buttonVariants({ variant: 'ghost', size: 'lg' })}
                  >
                    {status === 'in_review' ? 'Move back to draft' : 'Mark ready for review'}
                  </button>
                </>
              )}
            </div>

            {item ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                <Link href={`/admin/preview/${item.id}`} className="inline-flex items-center gap-1 text-link hover:underline">
                  <Eye aria-hidden className="size-4" />
                  Preview saved version
                </Link>
                {status === 'published' ? (
                  <a
                    href={contentPath(type, item.slug)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-link hover:underline"
                  >
                    <ExternalLink aria-hidden className="size-4" />
                    View live
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <Field name="category_id" label="Category" error={errors.category_id}>
              <Select id="category_id" name="category_id" defaultValue={item?.categoryId ?? ''}>
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="author_id" label="Author" error={errors.author_id}>
              <Select id="author_id" name="author_id" defaultValue={item ? (item.authorId ?? '') : defaultAuthorId}>
                <option value="">No byline</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <fieldset>
              <legend className="text-sm font-medium text-foreground">Tags</legend>
              {tags.length ? (
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="tag_ids" value={tag.id} defaultChecked={item?.tagIds.includes(tag.id)} />
                      {tag.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No tags yet.</p>
              )}
            </fieldset>
            <Field name="new_tags" label="Add new tags" error={errors.new_tags} hint="Comma-separated. Created when you save.">
              <Input id="new_tags" name="new_tags" maxLength={500} {...fieldAria('new_tags', { hint: true, error: errors.new_tags })} />
            </Field>
            {errors.tag_ids ? <p className="text-xs font-medium text-destructive">{errors.tag_ids}</p> : null}
          </section>

          <section className="space-y-2 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-foreground">Cover image</h2>
            <CoverField media={media} initialId={item?.coverMediaId ?? null} />
          </section>
        </div>
      </div>
    </form>
  )
}

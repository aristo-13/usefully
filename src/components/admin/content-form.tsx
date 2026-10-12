'use client'

import Link from 'next/link'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { ExternalLink, Eye, Plus, Upload, X } from 'lucide-react'

import { AiButton, AiPanel, AiToast, useAiWriter, type AiCall, type AiTarget } from '@/components/admin/ai-writer'
import { CharacterCount, Field, FormMessage, fieldAria, useActionForm } from '@/components/admin/form'
import { MediaField } from '@/components/admin/media-field'
import { StatusBadge } from '@/components/admin/ui'
import { buttonVariants } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { saveContent } from '@/lib/admin/content-actions'
import { prepareDownloadUpload } from '@/lib/admin/upload-actions'
import type { ContentDraft, EditableContent, MediaOption, Option } from '@/lib/admin/types'
import type { AiField, AiMeta, AiPost, AiProvider, AiReference } from '@/lib/ai/fields'
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

/** Comma-separated names, trimmed and without duplicates (as the server reads them). */
function splitNames(value: string): string[] {
  const seen = new Set<string>()
  return value
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => {
      const key = part.toLowerCase()
      if (!part || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function toRows(sources: Source[]): SourceRow[] {
  return sources.map((source, index) => ({ ...source, publisher: source.publisher ?? '', key: index }))
}

function SourcesField({
  rows,
  setRows,
  error,
}: {
  rows: SourceRow[]
  setRows: Dispatch<SetStateAction<SourceRow[]>>
  error?: string
}) {
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
            setRows((current) => [
              ...current,
              { title: '', url: '', publisher: '', key: current.reduce((max, item) => Math.max(max, item.key), -1) + 1 },
            ])
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
  draft,
  aiProvider,
}: {
  type: ContentType
  item: EditableContent | null
  /** Starting values for a new post. */
  draft?: ContentDraft
  categories: Option[]
  tags: Option[]
  authors: Option[]
  media: MediaOption[]
  defaultAuthorId: string
  siteUrl: string
  notice?: string
  /** Who the AI writer uses (from the API keys that are set); null when it is off. */
  aiProvider: AiProvider | null
}) {
  const aiEnabled = aiProvider !== null
  const config = contentTypeConfig[type]
  const status = item?.status ?? 'draft'
  const { state, pending, onSubmit } = useActionForm(saveContent)
  const errors = state.fieldErrors ?? {}

  const [title, setTitle] = useState(item?.title ?? draft?.title ?? '')
  const [slug, setSlug] = useState(item?.slug ?? slugify(draft?.title ?? ''))
  const [slugEdited, setSlugEdited] = useState(Boolean(item))
  const [excerpt, setExcerpt] = useState(item?.excerpt ?? '')
  const [body, setBody] = useState(item?.body ?? '')
  const [seoTitle, setSeoTitle] = useState(item?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(item?.seoDescription ?? '')
  const [keywords, setKeywords] = useState((item?.keywords ?? draft?.keywords ?? []).join(', '))
  const [tagIds, setTagIds] = useState<string[]>(item?.tagIds ?? [])
  const [newTags, setNewTags] = useState('')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? '')
  const [sources, setSources] = useState<SourceRow[]>(() => toRows(item?.sources ?? (draft?.source ? [draft.source] : [])))
  const [aiGenerated, setAiGenerated] = useState(item?.aiGenerated ?? false)
  // A live post was approved when it was published, and that approval carries
  // over to edits made by hand. Anything the AI writes needs a fresh confirmation.
  const [reviewConfirmed, setReviewConfirmed] = useState(Boolean(item?.status === 'published' && item.reviewedAt))
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

  // AI writer
  const formRef = useRef<HTMLFormElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const trend = draft?.context ? { context: draft.context, region: draft.region } : null
  const [guidance, setGuidance] = useState('')
  const [research, setResearch] = useState(Boolean(trend))
  const [reference, setReference] = useState<AiReference | null>(null)
  const [undo, setUndo] = useState<{ target: AiTarget; restore: () => void } | null>(null)
  const ai = useAiWriter(() => ({ guidance, research, trend, reference }))
  const busy = ai.active !== null
  const bodyStreaming = ai.active === 'body' || ai.active === 'all'

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Follow the body as the AI writes it.
  useEffect(() => {
    if (bodyStreaming && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [body, bodyStreaming])

  const [savedState, setSavedState] = useState(state)
  if (savedState !== state) {
    setSavedState(state)
    if (state.status === 'success') {
      setDirty(false)
      setUndo(null)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (busy) {
      event.preventDefault()
      return
    }
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

  /** The post as it is in the editor now, for the AI writer. */
  function currentPost(form: HTMLFormElement | null, overrides: Partial<AiPost> = {}): AiPost {
    const data = form ? new FormData(form) : null
    const read = (name: string) => {
      const value = data?.get(name)
      return typeof value === 'string' ? value : ''
    }
    return {
      id: item?.id ?? null,
      type,
      status,
      title,
      slug,
      excerpt,
      body,
      seoTitle,
      seoDescription,
      keywords: splitNames(keywords).slice(0, 30),
      tags: [...tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name), ...splitNames(newTags)].slice(0, 60),
      category: categories.find((category) => category.id === categoryId)?.name ?? '',
      difficulty,
      externalUrl: read('external_url'),
      videoUrl: read('video_url'),
      version: read('version'),
      sources: sources
        .filter((source) => source.title.trim() && source.url.trim())
        .map(({ title: sourceTitle, url, publisher }) => ({ title: sourceTitle, url, ...(publisher ? { publisher } : {}) })),
      ...overrides,
    }
  }

  function snapshot() {
    return { title, slug, slugEdited, excerpt, body, seoTitle, seoDescription, keywords, tagIds, newTags, categoryId, difficulty, sources, aiGenerated }
  }

  function restoreAll(saved: ReturnType<typeof snapshot>) {
    setTitle(saved.title)
    setSlug(saved.slug)
    setSlugEdited(saved.slugEdited)
    setExcerpt(saved.excerpt)
    setBody(saved.body)
    setSeoTitle(saved.seoTitle)
    setSeoDescription(saved.seoDescription)
    setKeywords(saved.keywords)
    setTagIds(saved.tagIds)
    setNewTags(saved.newTags)
    setCategoryId(saved.categoryId)
    setDifficulty(saved.difficulty)
    setSources(saved.sources)
    setAiGenerated(saved.aiGenerated)
  }

  /** Existing tags are ticked; new names go to "Add new tags". */
  function applyTags(names: string[]) {
    const byName = new Map(tags.map((tag) => [tag.name.toLocaleLowerCase(), tag.id]))
    setTagIds(names.flatMap((name) => byName.get(name.toLocaleLowerCase()) ?? []))
    setNewTags(names.filter((name) => !byName.has(name.toLocaleLowerCase())).join(', '))
  }

  /** AI-written text needs a person's confirmation before it goes live, even on an approved page. */
  function markAiWritten() {
    setAiGenerated(true)
    setReviewConfirmed(false)
  }

  function addSources(found: Source[]) {
    if (!found.length) return
    setSources((rows) => {
      const known = new Set(rows.map((row) => row.url.trim()))
      let key = rows.reduce((max, row) => Math.max(max, row.key), -1)
      const added = found
        .filter((source) => !known.has(source.url))
        .slice(0, Math.max(0, 30 - rows.length))
        .map((source) => ({ ...source, publisher: source.publisher ?? '', key: ++key }))
      return [...rows, ...added]
    })
  }

  function applyMeta(meta: AiMeta) {
    setTitle(meta.title)
    // A live page keeps its address: changing it would break links to it.
    if (status !== 'published' && meta.slug) {
      setSlug(meta.slug)
      setSlugEdited(true)
    }
    setExcerpt(meta.excerpt)
    setSeoTitle(meta.seoTitle)
    setSeoDescription(meta.seoDescription)
    setKeywords(meta.keywords.join(', '))
    applyTags(meta.tags)
    const category = categories.find((option) => option.name === meta.category)
    if (category) setCategoryId(category.id)
    if (type === 'tutorial' && meta.difficulty) setDifficulty(meta.difficulty)
  }

  /** Streams a new body into the editor; `previousBody` is shown again if the AI only made notes. */
  async function streamBody(call: AiCall, post: AiPost, previousBody: string) {
    let streamed = ''
    const result = await call('body', post, {
      onText: (text) => {
        streamed += text
        setBody(streamed)
      },
      onReset: () => {
        streamed = ''
        setBody(previousBody)
      },
    })
    const written = typeof result.value === 'string' ? result.value : streamed
    setBody(written)
    addSources(result.sources)
    markAiWritten()
    setDirty(true)
    return { body: written, sources: result.sources, notices: result.notices }
  }

  function noticeOrNothing(notices: string[]) {
    if (notices.length) ai.setFeedback({ tone: 'notice', text: notices.join(' ') })
  }

  async function writeAll(form: HTMLFormElement | null) {
    if (busy) return
    if (body.trim() && !window.confirm('Replace this post with a new AI draft? You can undo it afterwards.')) return
    const saved = snapshot()
    let bodyWritten = false
    const notices = await ai.run('all', async (call) => {
      const post = currentPost(form)
      const written = await streamBody(call, post, saved.body)
      bodyWritten = true
      const meta = await call('meta', { ...post, body: written.body, sources: [...post.sources, ...written.sources] })
      if (meta.value && typeof meta.value === 'object' && !Array.isArray(meta.value)) applyMeta(meta.value)
      return [...written.notices, ...meta.notices]
    })
    if (notices === null) {
      // Failed or stopped: keep a finished body (undo is offered), discard a half-written one.
      if (bodyWritten) setUndo({ target: 'all', restore: () => restoreAll(saved) })
      else setBody(saved.body)
      return
    }
    setUndo({ target: 'all', restore: () => restoreAll(saved) })
    markAiWritten()
    setDirty(true)
    ai.setFeedback({
      tone: notices.length ? 'notice' : 'success',
      text: [...notices, 'Draft ready. Read it through, check the facts and sources, then tick the review box to publish.'].join(' '),
    })
  }

  // "Draft with AI" on the Trends page opens the editor with ?ai=1: start once,
  // and drop the flag from the address so a reload does not start again.
  const startDraft = useEffectEvent(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('ai')
    window.history.replaceState(window.history.state, '', url)
    void writeAll(formRef.current)
  })
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!aiEnabled || !draft?.autoDraft || autoStarted.current) return
    autoStarted.current = true
    startDraft()
  }, [aiEnabled, draft?.autoDraft])

  async function writeBody(form: HTMLFormElement | null) {
    if (busy) return
    if (body.trim() && !window.confirm('Replace the current body with a new AI draft? You can undo it afterwards.')) return
    const saved = { body, sources, aiGenerated }
    const notices = await ai.run('body', async (call) => (await streamBody(call, currentPost(form), saved.body)).notices)
    if (notices === null) {
      setBody(saved.body)
      return
    }
    setUndo({
      target: 'body',
      restore: () => {
        setBody(saved.body)
        setSources(saved.sources)
        setAiGenerated(saved.aiGenerated)
      },
    })
    ai.setFeedback({
      tone: notices.length ? 'notice' : 'success',
      text: [...notices, 'Body written. Read it through and check the facts before publishing.'].join(' '),
    })
  }

  /** Writes one short field and offers to undo it. */
  function writeField(field: Exclude<AiField, 'body' | 'meta' | 'cover_alt'>, form: HTMLFormElement | null) {
    if (busy) return
    const saved = snapshot()
    void ai.run(field, async (call) => {
      const { value, notices } = await call(field, currentPost(form))
      const text = typeof value === 'string' ? value : ''
      const list = Array.isArray(value) ? value : []
      let restore: () => void
      switch (field) {
        case 'title':
          setTitle(text)
          if (!slugEdited) setSlug(slugify(text))
          restore = () => {
            setTitle(saved.title)
            setSlug(saved.slug)
          }
          break
        case 'slug':
          setSlug(text)
          setSlugEdited(true)
          restore = () => {
            setSlug(saved.slug)
            setSlugEdited(saved.slugEdited)
          }
          break
        case 'excerpt':
          setExcerpt(text)
          markAiWritten()
          restore = () => {
            setExcerpt(saved.excerpt)
            setAiGenerated(saved.aiGenerated)
          }
          break
        case 'seo_title':
          setSeoTitle(text)
          restore = () => setSeoTitle(saved.seoTitle)
          break
        case 'seo_description':
          setSeoDescription(text)
          restore = () => setSeoDescription(saved.seoDescription)
          break
        case 'keywords':
          setKeywords(list.join(', '))
          restore = () => setKeywords(saved.keywords)
          break
        case 'tags':
          applyTags(list)
          restore = () => {
            setTagIds(saved.tagIds)
            setNewTags(saved.newTags)
          }
          break
        case 'category':
          setCategoryId(categories.find((category) => category.name === text)?.id ?? saved.categoryId)
          restore = () => setCategoryId(saved.categoryId)
          break
        case 'difficulty':
          setDifficulty(text)
          restore = () => setDifficulty(saved.difficulty)
          break
      }
      setUndo({ target: field, restore })
      setDirty(true)
      noticeOrNothing(notices)
    })
  }

  function writeAlt(form: HTMLFormElement | null, imageUrl: string | null, previous: string, setAlt: (alt: string) => void) {
    if (busy || !imageUrl) return
    void ai.run('cover_alt', async (call) => {
      const { value } = await call('cover_alt', currentPost(form), { imageUrl })
      if (typeof value !== 'string') return
      setAlt(value)
      setUndo({ target: 'cover_alt', restore: () => setAlt(previous) })
    })
  }

  /** The AI button for a field's label row (nothing when the AI writer is off). */
  function aiAction(
    field: AiField,
    label: string,
    verb: string,
    onRun: (form: HTMLFormElement | null) => void,
    unavailable?: string,
  ): ReactNode {
    if (!aiEnabled) return null
    return (
      <AiButton
        field={field}
        label={label}
        verb={verb}
        active={ai.active}
        busy={busy || Boolean(unavailable)}
        unavailable={unavailable}
        onRun={onRun}
        onStop={ai.stop}
        onUndo={
          undo?.target === field
            ? () => {
                undo.restore()
                setUndo(null)
              }
            : undefined
        }
      />
    )
  }

  const improve = (value: string) => (value.trim() ? 'Improve' : 'Write')

  const path = contentPath(type, slug || 'your-slug')
  const snippetTitle = seoTitle || title || 'Page title'
  const snippetDescription = seoDescription || excerpt || 'The summary is used as the description.'
  const seoHasErrors = ['seo_title', 'seo_description', 'canonical_url', 'keywords'].some((key) => errors[key])

  return (
    <form
      ref={formRef}
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

      {status === 'published' ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">This page is live.</strong> Change anything below, then press{' '}
          <strong className="font-medium text-foreground">Update live page</strong> to publish your changes straight away.
          The page stays online while you edit; <strong className="font-medium text-foreground">Unpublish</strong> takes it
          offline.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <AiPanel
            provider={aiProvider}
            trend={trend}
            reference={reference}
            onReference={setReference}
            onLinked={(linked) => {
              // Cite the post, and let the AI read it before writing.
              const title = linked.title || (linked.author ? `${linked.author} on ${linked.source}` : `${linked.source} post`)
              addSources([{ title: title.slice(0, 200), url: linked.url, publisher: linked.source.slice(0, 100) }])
              setResearch(true)
            }}
            guidance={guidance}
            onGuidance={setGuidance}
            research={research}
            onResearch={setResearch}
            active={ai.active}
            status={ai.status}
            onWriteAll={(form) => void writeAll(form)}
            onStop={ai.stop}
            onUndo={
              undo?.target === 'all'
                ? () => {
                    undo.restore()
                    setUndo(null)
                  }
                : undefined
            }
          />

          <Field
            name="title"
            label="Title"
            required
            error={errors.title}
            counter={<CharacterCount value={title} max={200} />}
            action={aiAction('title', 'title', improve(title), (form) => writeField('title', form))}
          >
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
            action={aiAction('slug', 'URL slug', improve(slug), (form) => writeField('slug', form))}
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
            action={aiAction('excerpt', 'summary', improve(excerpt), (form) => writeField('excerpt', form))}
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
              hint="Visitors reach it through a /go/ link, which counts clicks. Needed before publishing unless the resource has a video or a cover photo."
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
            <Field
              name="difficulty"
              label="Difficulty"
              error={errors.difficulty}
              action={aiAction('difficulty', 'difficulty', 'Suggest', (form) => writeField('difficulty', form))}
            >
              <Select
                id="difficulty"
                name="difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
                className="max-w-60"
              >
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
            action={aiAction('body', 'body', body.trim() ? 'Rewrite' : 'Write', (form) => void writeBody(form))}
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
              ref={bodyRef}
              id="body"
              name="body"
              rows={24}
              value={body}
              readOnly={bodyStreaming}
              aria-busy={bodyStreaming || undefined}
              onChange={(event) => setBody(event.target.value)}
              className="font-mono text-[0.85rem] leading-6"
              spellCheck
              {...fieldAria('body', { hint: true, error: errors.body })}
            />
          </Field>

          <SourcesField rows={sources} setRows={setSources} error={errors.sources} />

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
                action={aiAction('seo_title', 'SEO title', improve(seoTitle), (form) => writeField('seo_title', form))}
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
                action={aiAction('seo_description', 'meta description', improve(seoDescription), (form) =>
                  writeField('seo_description', form),
                )}
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
                action={aiAction('keywords', 'keywords', 'Suggest', (form) => writeField('keywords', form))}
                hint="Optional, comma-separated, up to 10. Used by site search and the keywords meta tag. Keep them precise; repeating phrases does not help."
              >
                <Input
                  id="keywords"
                  name="keywords"
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
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
                      checked={reviewConfirmed}
                      onChange={(event) => setReviewConfirmed(event.target.checked)}
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
                  <button type="submit" name="intent" value="save" disabled={pending || busy} className={buttonVariants({ size: 'lg' })}>
                    {pending ? 'Saving…' : 'Update live page'}
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="draft"
                    disabled={pending || busy}
                    className={buttonVariants({ variant: 'outline', size: 'lg' })}
                  >
                    Unpublish
                  </button>
                </>
              ) : (
                <>
                  <button type="submit" name="intent" value="publish" disabled={pending || busy} className={buttonVariants({ size: 'lg' })}>
                    {pending ? 'Saving…' : 'Publish'}
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="save"
                    disabled={pending || busy}
                    className={buttonVariants({ variant: 'outline', size: 'lg' })}
                  >
                    {status === 'in_review' ? 'Save' : 'Save draft'}
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value={status === 'in_review' ? 'draft' : 'review'}
                    disabled={pending || busy}
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
            <Field
              name="category_id"
              label="Category"
              error={errors.category_id}
              action={aiAction(
                'category',
                'category',
                'Suggest',
                (form) => writeField('category', form),
                categories.length ? undefined : 'Create a category first',
              )}
            >
              <Select id="category_id" name="category_id" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
              <legend className={aiEnabled ? 'sr-only' : 'text-sm font-medium text-foreground'}>Tags</legend>
              {aiEnabled ? (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span aria-hidden className="text-sm font-medium text-foreground">
                    Tags
                  </span>
                  {aiAction('tags', 'tags', 'Suggest', (form) => writeField('tags', form))}
                </div>
              ) : null}
              {tags.length ? (
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="tag_ids"
                        value={tag.id}
                        checked={tagIds.includes(tag.id)}
                        onChange={(event) =>
                          setTagIds((current) =>
                            event.target.checked ? [...current, tag.id] : current.filter((id) => id !== tag.id),
                          )
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No tags yet.</p>
              )}
            </fieldset>
            <Field name="new_tags" label="Add new tags" error={errors.new_tags} hint="Comma-separated. Created when you save.">
              <Input
                id="new_tags"
                name="new_tags"
                maxLength={500}
                value={newTags}
                onChange={(event) => setNewTags(event.target.value)}
                {...fieldAria('new_tags', { hint: true, error: errors.new_tags })}
              />
            </Field>
            {errors.tag_ids ? <p className="text-xs font-medium text-destructive">{errors.tag_ids}</p> : null}
          </section>

          {type === 'download' ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <MediaField
                kind="icon"
                label="App icon"
                hint="Shown next to the title on the page and on cards."
                media={media}
                initial={{ url: item?.iconUrl ?? '' }}
                errors={{ url: errors.icon_url }}
                onChange={() => setDirty(true)}
              />
            </section>
          ) : null}

          {type === 'resource' ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <MediaField
                kind="video"
                label="Video"
                hint="A trending or featured video. Plays on the page; the cover image is shown until it starts."
                media={media}
                initial={{ url: item?.videoUrl ?? draft?.videoUrl ?? '' }}
                errors={{ url: errors.video_url }}
                onChange={() => setDirty(true)}
              />
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-card p-4">
            <MediaField
              kind="cover"
              label={type === 'resource' ? 'Cover image or photo' : 'Cover image'}
              hint={
                type === 'download'
                  ? 'Shown on the page, for example a screenshot, and when the page is shared.'
                  : 'Shown on cards, on the page and when the page is shared.'
              }
              media={media}
              initial={{
                id: item?.coverMediaId,
                libraryUrl: item?.coverMediaUrl,
                url: item?.coverImageUrl ?? '',
                alt: item?.coverAlt ?? '',
              }}
              errors={{ url: errors.cover_image_url ?? errors.cover_media_id, alt: errors.cover_alt }}
              onChange={() => setDirty(true)}
              altAction={({ imageUrl, alt, setAlt }) =>
                aiAction(
                  'cover_alt',
                  'alt text',
                  improve(alt),
                  (form) => writeAlt(form, imageUrl, alt, setAlt),
                  imageUrl ? undefined : 'Add a cover image first',
                )
              }
            />
          </section>
        </div>
      </div>

      {aiEnabled ? (
        <AiToast active={ai.active} status={ai.status} feedback={ai.feedback} onDismiss={() => ai.setFeedback(null)} />
      ) : null}
    </form>
  )
}

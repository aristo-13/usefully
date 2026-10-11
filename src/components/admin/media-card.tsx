'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { DeleteButton } from '@/components/admin/delete-button'
import { FormMessage, useActionForm } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteMedia, updateMediaAlt } from '@/lib/admin/media-actions'
import type { MediaRow } from '@/lib/admin/types'
import { formatBytes } from '@/lib/utils'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Copy this value:', value)
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  )
}

export function MediaCard({ item }: { item: MediaRow }) {
  const { state, pending, onSubmit } = useActionForm(updateMediaAlt.bind(null, item.id))
  const markdown = item.url ? `![${item.altText.replace(/[[\]]/g, '')}](${item.url})` : ''

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-[4/3] bg-muted">
        {item.url ? (
          <Image src={item.url} alt={item.altText} fill sizes="(min-width: 1280px) 20rem, (min-width: 640px) 50vw, 100vw" className="object-contain" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3 text-sm">
        <div>
          <p className="truncate font-medium text-foreground" title={item.fileName}>
            {item.fileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
            {formatBytes(item.sizeBytes)}
            {item.coverUsage ? ` · cover of ${item.coverUsage} ${item.coverUsage === 1 ? 'item' : 'items'}` : ''}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-2">
          <label htmlFor={`alt-${item.id}`} className="text-xs font-medium text-foreground">
            Alt text
          </label>
          <div className="flex gap-2">
            <Input id={`alt-${item.id}`} name="alt_text" defaultValue={item.altText} maxLength={300} className="h-8" />
            <button type="submit" disabled={pending} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
          {!item.altText ? <p className="text-xs text-warning">Missing alt text</p> : null}
          <FormMessage state={state} />
        </form>

        {item.url ? (
          <div className="flex flex-wrap gap-2">
            <CopyButton value={item.url} label="Copy URL" />
            <CopyButton value={markdown} label="Copy Markdown" />
          </div>
        ) : null}

        <div className="mt-auto border-t border-border pt-3">
          <DeleteButton
            action={deleteMedia.bind(null, item.id)}
            size="sm"
            confirmMessage={`Delete ${item.fileName}? ${
              item.coverUsage ? `It is the cover image of ${item.coverUsage} item(s), which will lose their cover. ` : ''
            }Any article text that embeds this image will show a broken image.`}
          />
        </div>
      </div>
    </article>
  )
}

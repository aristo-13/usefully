'use client'

import { useSyncExternalStore } from 'react'
import { PenLine } from 'lucide-react'

import { EDITOR_HINT_COOKIE } from '@/lib/editor-hint'

function signedInEditor(): boolean {
  return document.cookie.split('; ').includes(`${EDITOR_HINT_COOKIE}=1`)
}

// The hint only changes when signing in or out, which reloads the page.
const subscribe = () => () => {}

/** "Edit" on a live page for editors signed in to the dashboard. Visitors never see it. */
export function EditLink({ path }: { path: string }) {
  const editor = useSyncExternalStore(subscribe, signedInEditor, () => false)
  if (!editor) return null
  return (
    <a
      href={`/admin/edit?path=${encodeURIComponent(path)}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <PenLine aria-hidden className="size-4" />
      Edit
    </a>
  )
}

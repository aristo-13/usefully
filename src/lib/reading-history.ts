import { useMemo, useSyncExternalStore } from 'react'

// What a visitor has read and how far, kept only in their own browser
// (localStorage): it is never sent to the server. It powers "Up next"
// (unread pages first) and "Pick up where you left off".

export type ReadingEntry = {
  path: string
  title: string
  /** e.g. "Article". */
  label: string
  /** Share of the body read when the visitor last left the page, 0 to 1. */
  progress: number
  /** Read to the end at least once. */
  finished: boolean
  /** Milliseconds since 1970. */
  updatedAt: number
}

type Area = 'local' | 'session'

const HISTORY_KEY = 'reading-history'
const DISMISSED_KEY = 'pick-up-dismissed'
const CHANGE_EVENT = 'stored-value-change'
const MAX_ENTRIES = 50
const KEEP_FOR = 30 * 86_400_000

function storage(area: Area): Storage {
  return area === 'local' ? window.localStorage : window.sessionStorage
}

function read(area: Area, key: string): string {
  try {
    return storage(area).getItem(key) ?? ''
  } catch {
    // Storage can be blocked (private windows, site data turned off).
    return ''
  }
}

function write(area: Area, key: string, value: string): void {
  try {
    storage(area).setItem(key, value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Not saved: the features that use it simply stay quiet.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/** A value from browser storage that re-renders when it changes. Empty on the server and while hydrating. */
function useStored(area: Area, key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => read(area, key),
    () => '',
  )
}

function isEntry(value: unknown): value is ReadingEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.path === 'string' &&
    // Site paths only, so an edited entry can never become an outside or script link.
    /^\/(?!\/)[\w\-/]*$/.test(entry.path) &&
    typeof entry.title === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.progress === 'number' &&
    typeof entry.finished === 'boolean' &&
    typeof entry.updatedAt === 'number'
  )
}

function parseHistory(raw: string): ReadingEntry[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter(isEntry).slice(0, MAX_ENTRIES) : []
  } catch {
    return []
  }
}

function parseList(raw: string): string[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/** Records how far the visitor got on a page, and forgets pages not opened for 30 days. Never throws. */
export function saveReading(entry: Omit<ReadingEntry, 'finished' | 'updatedAt'>): void {
  const now = Date.now()
  const entries = parseHistory(read('local', HISTORY_KEY))
  const previous = entries.find((item) => item.path === entry.path)
  const next: ReadingEntry = {
    ...entry,
    title: entry.title.slice(0, 300),
    progress: Math.min(1, Math.max(0, entry.progress)),
    finished: Boolean(previous?.finished) || entry.progress >= 0.9,
    updatedAt: now,
  }
  const rest = entries.filter((item) => item.path !== entry.path && now - item.updatedAt < KEEP_FOR)
  write('local', HISTORY_KEY, JSON.stringify([next, ...rest].slice(0, MAX_ENTRIES)))
}

/** The visitor's reading history, newest first. Empty on the server and while hydrating. */
export function useReadingHistory(): ReadingEntry[] {
  const raw = useStored('local', HISTORY_KEY)
  return useMemo(() => parseHistory(raw), [raw])
}

/** Pages started but not finished, newest first. */
export function unfinished(entries: ReadingEntry[]): ReadingEntry[] {
  return entries.filter((entry) => !entry.finished && entry.progress >= 0.1 && entry.progress < 0.9)
}

/** Suggestions the visitor closed during this visit (by key), so they do not come back. */
export function useDismissed(): { dismissed: string[]; dismiss: (key: string) => void } {
  const raw = useStored('session', DISMISSED_KEY)
  const dismissed = useMemo(() => parseList(raw), [raw])
  return {
    dismissed,
    dismiss: (key) => write('session', DISMISSED_KEY, JSON.stringify([...parseList(read('session', DISMISSED_KEY)), key].slice(-50))),
  }
}

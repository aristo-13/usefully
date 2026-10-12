// No imports: this file is also used by next.config.ts.

/**
 * An optional setting from the environment, or undefined when it is empty or
 * still holds a `your-…` placeholder from .env.local.example, so placeholders
 * behave exactly like settings that are not there. Pass the value itself
 * (`setting(process.env.NAME)`) so Next.js can inline NEXT_PUBLIC_ variables.
 */
export function setting(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || /^your[-_]/i.test(trimmed)) return undefined
  return trimmed
}

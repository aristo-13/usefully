import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { Logo } from '@/components/site/logo'
import { buttonVariants } from '@/components/ui/button'
import { getAuthState } from '@/lib/auth'
import { signOut } from '@/lib/auth-actions'

import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

const errorMessages: Record<string, string> = {
  forbidden: 'This account does not have access to the dashboard.',
  unconfigured:
    'Supabase is not configured yet. Add the environment variables described in the README and restart the server.',
}

async function LoginPanel({ searchParams }: Pick<PageProps<'/auth/login'>, 'searchParams'>) {
  const params = await searchParams
  const next = typeof params.next === 'string' ? params.next : '/admin'
  const errorKey = typeof params.error === 'string' ? params.error : ''
  const state = await getAuthState()

  if (state.status === 'admin') {
    return (
      <div className="mt-6 space-y-4 text-sm">
        <p>
          You are signed in as <span className="font-medium">{state.user.displayName || state.user.email}</span>.
        </p>
        <Link href="/admin" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
          Go to the dashboard
        </Link>
      </div>
    )
  }

  if (state.status === 'forbidden') {
    return (
      <div className="mt-6 space-y-4 text-sm">
        <p role="alert" className="text-destructive">
          {state.email ? `${state.email} does` : 'This account does'} not have access to the dashboard.
        </p>
        <form action={signOut}>
          <button type="submit" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}>
            Sign out and use another account
          </button>
        </form>
      </div>
    )
  }

  return (
    <LoginForm
      next={next}
      initialError={errorMessages[errorKey] ?? (state.status === 'unconfigured' ? errorMessages.unconfigured : undefined)}
      disabled={state.status === 'unconfigured'}
    />
  )
}

export default function LoginPage({ searchParams }: PageProps<'/auth/login'>) {
  return (
    <main id="main" className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto block w-fit">
          <Logo height={34} />
        </Link>
        <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dashboard access for site editors.</p>
          <Suspense fallback={<div aria-hidden className="mt-6 h-52 animate-pulse rounded-md bg-muted" />}>
            <LoginPanel searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

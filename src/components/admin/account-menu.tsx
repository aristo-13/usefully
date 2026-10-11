import { LogOut } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { getAuthState } from '@/lib/auth'
import { signOut } from '@/lib/auth-actions'

export async function AccountMenu() {
  const state = await getAuthState()
  if (state.status !== 'admin') return null

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="truncate text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{state.user.displayName || state.user.email}</span>
      </span>
      <form action={signOut}>
        <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <LogOut aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  )
}

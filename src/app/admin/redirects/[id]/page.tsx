import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DeleteButton } from '@/components/admin/delete-button'
import { RedirectForm } from '@/components/admin/redirect-form'
import { PageHeader, Panel } from '@/components/admin/ui'
import { getRedirect } from '@/lib/admin/queries'
import { deleteRedirect } from '@/lib/admin/redirect-actions'
import { requireAdmin } from '@/lib/auth'
import { siteConfig } from '@/lib/site'
import { formatShortDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Edit redirect' }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditRedirectPage({ params }: PageProps<'/admin/redirects/[id]'>) {
  await requireAdmin()
  const { id } = await params
  if (!GUID.test(id)) notFound()
  const redirect = await getRedirect(id)
  if (!redirect) notFound()

  return (
    <>
      <PageHeader
        backHref="/admin/redirects"
        backLabel="Redirects"
        title={`/go/${redirect.slug}`}
        description={`${redirect.click_count} clicks · last updated ${formatShortDate(redirect.updated_at)}`}
      />
      <div className="max-w-2xl space-y-10">
        <Panel>
          <RedirectForm item={redirect} siteUrl={siteConfig.url} />
        </Panel>
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-base font-semibold text-foreground">Delete this redirect</h2>
          <p className="text-sm text-muted-foreground">
            Links that point to /go/{redirect.slug} will show a “not found” page. To pause it instead, untick Active.
          </p>
          <DeleteButton
            action={deleteRedirect.bind(null, redirect.id)}
            confirmMessage={`Delete /go/${redirect.slug}? Existing links to it will stop working.`}
            label="Delete redirect"
          />
        </section>
      </div>
    </>
  )
}

import type { Metadata } from 'next'

import { ProfileForm, PasswordForm } from '@/components/admin/settings-forms'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = { title: 'Settings' }

export default async function AdminSettingsPage() {
  const admin = await requireAdmin()
  const siteUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SITE_URL)

  return (
    <>
      <PageHeader title="Settings" description="Your author profile, password and the site configuration." />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Panel title="Author profile" description="Used for bylines and the author box on published pages.">
          <ProfileForm displayName={admin.displayName} bio={admin.bio} />
        </Panel>

        <div className="space-y-6">
          <Panel title="Password" description={admin.email ? `Signed in as ${admin.email}.` : undefined}>
            <PasswordForm />
          </Panel>

          <Panel title="Site configuration" description="Set through environment variables; see the README.">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Site name</dt>
                <dd className="font-medium text-foreground">{siteConfig.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Public URL</dt>
                <dd className="font-medium break-all text-foreground">{siteConfig.url}</dd>
                {siteUrlConfigured ? null : (
                  <dd className="mt-1 text-xs text-warning">
                    NEXT_PUBLIC_SITE_URL is not set. Canonical URLs, the sitemap and social previews need your real
                    domain in production.
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="text-foreground">{siteConfig.description}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  )
}

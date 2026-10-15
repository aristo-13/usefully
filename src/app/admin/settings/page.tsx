import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ProfileForm, PasswordForm } from '@/components/admin/settings-forms'
import { AdminPageSkeleton, PageHeader, Panel } from '@/components/admin/ui'
import { adsense } from '@/lib/ads'
import { aiSetup } from '@/lib/ai/writer'
import { requireAdmin } from '@/lib/auth'
import { siteConfig, siteUrlConfigured } from '@/lib/site'
import { PHOTOS_OFF_MESSAGE, photosEnabled } from '@/lib/stock-photos'

export const metadata: Metadata = { title: 'Settings' }

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Settings" />}>
      <Settings />
    </Suspense>
  )
}

async function Settings() {
  const admin = await requireAdmin()
  const ai = aiSetup()

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
              <div>
                <dt className="text-muted-foreground">AI writer</dt>
                <dd className="font-medium text-foreground">{ai.enabled ? 'On' : 'Off'}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{ai.message}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cover photos</dt>
                <dd className="font-medium text-foreground">{photosEnabled() ? 'On (Pexels)' : 'Off'}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {photosEnabled()
                    ? `Search free photos from the cover field${ai.enabled ? ', or let the AI pick one' : ''}.`
                    : PHOTOS_OFF_MESSAGE}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Google AdSense</dt>
                <dd className="font-medium break-all text-foreground">
                  {adsense.client ? `On (${adsense.client})` : 'Off'}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {adsense.client
                    ? adsense.inArticleSlot
                      ? 'Auto ads plus in-article ads between sections. ads.txt is published.'
                      : 'Auto ads only. Add NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE for ads between sections.'
                    : 'Set NEXT_PUBLIC_ADSENSE_CLIENT_ID to your publisher ID (ca-pub-…) and rebuild.'}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  )
}

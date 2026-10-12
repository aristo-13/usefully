import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { Container } from '@/components/ui/container'
import { adsense } from '@/lib/ads'
import { setting } from '@/lib/env'
import { pageMetadata } from '@/lib/seo'
import { siteConfig } from '@/lib/site'

// Change this date whenever the text below changes.
const LAST_UPDATED = '12 October 2026'

export const metadata: Metadata = pageMetadata({
  title: 'Privacy policy',
  description: `How ${siteConfig.name} handles your information, cookies and advertising.`,
  path: '/privacy',
})

function contactEmail(): string | null {
  const email = setting(process.env.NEXT_PUBLIC_CONTACT_EMAIL)
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function OutboundLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/**
 * Required by the AdSense program policies once ads are shown: it discloses
 * that Google and other vendors use cookies to serve ads, and how to opt out.
 */
export default function PrivacyPage() {
  const email = contactEmail()
  const ads = adsense.client !== null

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ name: 'Privacy policy' }]} />
      <h1 className="sr-only">Privacy policy</h1>

      <div className="prose-content mt-6 max-w-3xl">
        <p className="text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
        <p>
          This page explains what information {siteConfig.name} collects when you visit {siteConfig.url.replace(/^https?:\/\//, '')},
          and how it is used.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>No account needed.</strong> You can read everything without signing up. We do not ask for your
            name, email address or any other personal details.
          </li>
          <li>
            <strong>Server logs.</strong> Like every website, our hosting provider records technical details of each
            request, such as the IP address, browser and page requested, to keep the site running and secure. These
            logs are kept for a short time and are not used to identify you.
          </li>
          <li>
            <strong>Your reading progress, on your device only.</strong> To offer &ldquo;Pick up where you left
            off&rdquo; and to suggest pages you have not read yet, your browser remembers which pages you opened and how
            far you read. This is stored in your browser&apos;s local storage and is never sent to us. Clearing this
            site&apos;s data in your browser removes it.
          </li>
          <li>
            <strong>Link and download counts.</strong> When you use a Visit or Download button, we add one to that
            page&apos;s click count. We do not record who clicked.
          </li>
        </ul>

        {ads ? (
          <>
            <h2>Advertising and cookies</h2>
            <p>We show ads from Google AdSense, which keeps the site free to read.</p>
            <ul>
              <li>
                Third-party vendors, including Google, use cookies to serve ads based on your previous visits to this
                website or other websites.
              </li>
              <li>
                Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your
                visits to this site and/or other sites on the Internet.
              </li>
              <li>
                You can opt out of personalised advertising in{' '}
                <OutboundLink href="https://adssettings.google.com/">Google&apos;s Ads Settings</OutboundLink>, and out
                of some other vendors&apos; cookies for personalised advertising at{' '}
                <OutboundLink href="https://www.aboutads.info/choices/">www.aboutads.info</OutboundLink>.
              </li>
              <li>
                Where the law requires it, for example in the European Economic Area, the United Kingdom and
                Switzerland, you are asked for your consent before personalised ads are shown.
              </li>
            </ul>
            <p>
              Read more in{' '}
              <OutboundLink href="https://policies.google.com/technologies/partner-sites">
                how Google uses information from sites that use its services
              </OutboundLink>
              .
            </p>
          </>
        ) : (
          <>
            <h2>Cookies</h2>
            <p>
              Reading the site sets no cookies. Only editors who sign in to manage the site receive a cookie, to keep
              them signed in.
            </p>
          </>
        )}

        <h2>Links to other websites</h2>
        <p>
          Pages link to other websites, such as sources and the tools we review. Those websites have their own privacy
          policies, which apply once you visit them.
        </p>

        <h2>Changes to this policy</h2>
        <p>When this policy changes, the date at the top of the page changes with it.</p>

        {email ? (
          <>
            <h2>Contact</h2>
            <p>
              Questions about privacy: <a href={`mailto:${email}`}>{email}</a>.
            </p>
          </>
        ) : null}
      </div>
    </Container>
  )
}

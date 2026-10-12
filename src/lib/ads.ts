// Relative import: next.config.ts reads this file too, outside the @/ alias.
import { setting } from './env'

/** "ca-pub-" plus the digits of the AdSense publisher ID ("pub-…" is accepted too). */
function publisherId(value: string | undefined): string | null {
  const id = setting(value)?.replace(/^pub-/, 'ca-pub-')
  return id && /^ca-pub-\d{10,20}$/.test(id) ? id : null
}

function adSlot(value: string | undefined): string | null {
  const slot = setting(value)
  return slot && /^\d{5,20}$/.test(slot) ? slot : null
}

const client = publisherId(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID)

/**
 * Google AdSense. Without a valid publisher ID every ad feature is off: no
 * script, no ad units, no ads.txt and the strict Content-Security-Policy.
 */
export const adsense = {
  client,
  /** In-article ad unit placed between sections. Without it, only Auto ads (set up in AdSense) appear. */
  inArticleSlot: client ? adSlot(process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE) : null,
}

/** The ads.txt line that authorises Google to sell ads on this site. */
export function adsTxt(publisher: string): string {
  return `google.com, ${publisher.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
}

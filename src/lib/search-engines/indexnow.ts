// IndexNow: tells Bing, Yandex and other participating search engines that
// pages changed, so they recrawl them within minutes. Google does not take part.
// No project imports, so this can be tested on its own.

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
/** Served by src/app/indexnow.txt/route.ts so search engines can verify the key. */
export const INDEXNOW_KEY_PATH = '/indexnow.txt'

export function isValidIndexNowKey(key: string | undefined): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9-]{8,128}$/.test(key)
}

export function indexNowPayload(siteUrl: string, key: string, urls: string[]) {
  const site = new URL(siteUrl)
  const urlList = [...new Set(urls)].filter((url) => {
    try {
      return new URL(url).host === site.host
    } catch {
      return false
    }
  })
  return { host: site.host, key, keyLocation: `${site.origin}${INDEXNOW_KEY_PATH}`, urlList: urlList.slice(0, 10_000) }
}

const MESSAGES: Record<number, string> = {
  200: 'Submitted.',
  202: 'Submitted. The search engines are still checking the key.',
  400: 'The request was not accepted.',
  403: 'The key could not be verified. Check that /indexnow.txt shows the key on the live site.',
  422: 'The links do not belong to this site.',
  429: 'Too many submissions. Try again later.',
}

export async function submitToIndexNow({
  siteUrl,
  key,
  urls,
  fetch: fetchImpl = fetch,
}: {
  siteUrl: string
  key: string
  urls: string[]
  fetch?: typeof fetch
}): Promise<{ ok: boolean; status: number; message: string; count: number }> {
  const payload = indexNowPayload(siteUrl, key, urls)
  if (!payload.urlList.length) return { ok: true, status: 0, message: 'Nothing to submit.', count: 0 }
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  return {
    ok: response.status === 200 || response.status === 202,
    status: response.status,
    message: MESSAGES[response.status] ?? `HTTP ${response.status}`,
    count: payload.urlList.length,
  }
}

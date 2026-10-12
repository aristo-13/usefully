// Checks your Supabase project from the outside, using the same public key the
// website ships with: everything this script can see, so can any visitor.
//
//   npm run check:supabase        (reads .env.local if present)
//
// It only reads data and never prints your keys. Exit code 1 means a check failed.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

let failures = 0
let warnings = 0
const pass = (message) => console.log(`  PASS  ${message}`)
const fail = (message, fix) => {
  failures++
  console.log(`  FAIL  ${message}${fix ? `\n        → ${fix}` : ''}`)
}
const warn = (message, fix) => {
  warnings++
  console.log(`  WARN  ${message}${fix ? `\n        → ${fix}` : ''}`)
}
const skip = (message) => console.log(`  SKIP  ${message} (apply the migrations first)`)

if (!url || !key || key.startsWith('your-')) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.local.example).')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }

async function request(path, init = {}) {
  try {
    const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } })
    const text = await response.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { status: response.status, body }
  } catch (error) {
    return { status: 0, body: String(error) }
  }
}

const denied = (status) => status === 401 || status === 403

console.log(`\nChecking ${new URL(url).host} with the public key\n`)

// 1. The key in the browser must be a public one.
console.log('Keys')
if (key.startsWith('sb_secret_')) {
  fail('The configured key is a SECRET key and would be sent to every browser.', 'Use the publishable key, then rotate the secret key in Supabase.')
} else if (key.startsWith('sb_publishable_')) {
  pass('Publishable key in use')
} else {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
    if (payload.role === 'service_role') {
      fail('The configured key is the SERVICE ROLE key and bypasses all security rules.', 'Use the publishable (or anon) key, then rotate the service role key.')
    } else pass(`Legacy "${payload.role}" key in use (a publishable key is preferred)`)
  } catch {
    warn('Could not identify the key type.', 'Use the publishable key from Project Settings → API Keys.')
  }
}

// 2. Schema.
console.log('\nDatabase')
const schema = await request('/rest/v1/content_items?select=id&limit=1')
if (schema.status === 200) pass('Schema is applied (content_items is reachable)')
else if (schema.status === 0) fail(`Could not reach Supabase: ${schema.body}`)
else fail('Schema is missing or not exposed.', 'Run supabase/migrations/20261011120000_initial_schema.sql (README, step 2).')

const search = await request('/rest/v1/rpc/search_content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ search_query: 'test', result_limit: 1, result_offset: 0 }),
})
if (search.status === 200) pass('Search with paging works')
else fail('search_content with paging is missing.', 'Run supabase/migrations/20261012090000_search_paging.sql.')

const schemaReady = schema.status === 200
const messageOf = (body) => (body && typeof body === 'object' ? String(body.message ?? body.error ?? '') : String(body ?? ''))

// 3. Row Level Security as seen by an anonymous visitor.
console.log('\nWhat anonymous visitors can see')
if (!schemaReady) {
  skip('Drafts, redirects, account roles and dashboard statistics')
} else {
  const drafts = await request('/rest/v1/content_items?select=id&status=neq.published&limit=1')
  if (drafts.status === 200 && Array.isArray(drafts.body) && drafts.body.length === 0) pass('Drafts and items in review are hidden')
  else if (drafts.status === 200) fail('Unpublished content is readable by anyone!', 'Re-run the initial migration; check that RLS is enabled on content_items.')
  else warn(`Could not verify drafts (HTTP ${drafts.status}).`)

  const redirects = await request('/rest/v1/redirects?select=id&limit=1')
  if (denied(redirects.status) || (redirects.status === 200 && Array.isArray(redirects.body) && redirects.body.length === 0)) {
    pass('Redirects table is private')
  } else if (redirects.status === 200) fail('The redirects table (including private notes) is readable by anyone!')
  else warn(`Could not verify redirects (HTTP ${redirects.status}).`)

  const roles = await request('/rest/v1/profiles?select=role&limit=1')
  if (denied(roles.status)) pass('Account roles are private')
  else if (roles.status === 200) fail('Account roles are readable by anyone.', 'Re-run the grants section of the initial migration.')
  else warn(`Could not verify profile privacy (HTTP ${roles.status}).`)

  const counts = await request('/rest/v1/rpc/content_status_counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (denied(counts.status)) pass('Dashboard statistics are private')
  else if (counts.status === 200) fail('Dashboard statistics (including draft counts) are callable by anyone.')
  else warn(`Could not verify dashboard statistics (HTTP ${counts.status}).`)
}

// 4. Storage.
console.log('\nStorage')
if (!schemaReady) {
  skip('Storage buckets')
} else {
  const media = await request('/storage/v1/object/public/media/__setup-check__')
  if (/bucket not found/i.test(messageOf(media.body))) {
    fail('The "media" bucket is missing or not public.', 'Run the initial migration (it creates the buckets).')
  } else pass('The "media" bucket exists and is public')

  for (const bucket of ['media', 'downloads']) {
    const list = await request(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1 }),
    })
    if (list.status === 200 && Array.isArray(list.body) && list.body.length > 0) fail(`Anyone can list the files in "${bucket}".`)
    else pass(`Files in "${bucket}" cannot be listed by visitors`)
  }
}

// 5. Auth.
console.log('\nAuthentication')
const settings = await request('/auth/v1/settings')
if (settings.status === 200 && settings.body && typeof settings.body === 'object') {
  if (settings.body.disable_signup === true) pass('Public sign-ups are disabled')
  else fail('Anyone can create an account.', 'Supabase → Authentication → Sign In / Providers → turn off "Allow new users to sign up".')
  if (settings.body.external && settings.body.external.email === false) {
    warn('The email provider is disabled, so password sign-in will not work.')
  }
} else warn(`Could not read auth settings (HTTP ${settings.status}).`)

// 6. Site configuration.
console.log('\nSite')
if (!siteUrl) warn('NEXT_PUBLIC_SITE_URL is not set.', 'Set it to your domain (https://…) in production.')
else if (!siteUrl.startsWith('https://')) warn(`NEXT_PUBLIC_SITE_URL is ${siteUrl}.`, 'Use your https:// domain in production.')
else pass(`Site URL is ${siteUrl}`)

console.log(`\n${failures ? `${failures} failed` : 'All checks passed'}${warnings ? `, ${warnings} warning(s)` : ''}.`)
console.log('Still check by hand: the admin account exists, and a draft is not visible when signed out (see README).\n')
// Set the code instead of calling process.exit(), so open connections can close cleanly.
process.exitCode = failures ? 1 : 0

# Usefully

A content and resource website with an editorial dashboard. It publishes **articles**, **tutorials**, **resources** (reviewed external tools and sites) and **downloads** (uploaded files or external links), organized by categories and tags, with site search and `/go/` short links.

Built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 and Supabase (Postgres, Auth, Storage).

- [Features](#features)
- [Setup](#setup)
- [Accessing the dashboard](#accessing-the-dashboard)
- [Verify your setup](#verify-your-setup)
- [Production security checklist](#production-security-checklist)
- [Using the dashboard](#using-the-dashboard)
- [How it works](#how-it-works)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Features

**Public site**
- Pages show the breadcrumb and the content only: no visible page titles or descriptions. Each page keeps a hidden heading for screen readers and search engines.
- Every list (home sections, articles, tutorials, resources, downloads, categories, category and tag pages, search results) shows **3 items at a time** with a **Load more** button. Without JavaScript the button is a link to the next page, so everything stays reachable.
- Every item has a **share** button. It shares the item's page on this site (using the device's share sheet, or copying the link), never a direct download or outbound link, so people land on the page and decide what to do there.
- Item pages with breadcrumbs, table of contents, cover image, sources, tags, author box and related reading.
- Resource pages link out through `/go/<slug>`; download pages show file name, format, size, version and last update. Uploaded files are served through short-lived signed links.
- Static, cached pages that update the moment an editor publishes, unpublishes or edits something.

**Dashboard (`/admin`)**
- Create, edit, preview, publish, unpublish and delete all content.
- Workflow: *Draft → Ready for review → Published*. Publishing records who approved the item and when.
- Categories, tags, keywords, media library, custom `/go/` redirects with click counts, and SEO fields (SEO title, meta description, canonical URL, noindex).

**Content quality safeguards**
- Source references on every item, listed at the end of the page.
- Items marked *Drafted with AI assistance* cannot be published until an editor ticks an explicit review confirmation. The page then discloses that it was AI-assisted and who reviewed it.
- Publishing is blocked for thin pages: a summary of at least 50 characters, and at least 500 characters of body text for articles and tutorials (150 for resources and downloads).
- The database itself refuses any published row without a recorded review.

**SEO**
- Per-page metadata (titles and descriptions stay in the page `<head>`), canonical URLs, Open Graph and Twitter cards, a default social image, XML sitemap and `robots.txt`.
- Structured data: `WebSite`/`Organization` (home), `Article` (articles, tutorials, resources), `CreativeWork` (downloads) with citations, and `BreadcrumbList`.
- Thin pages are kept out of the index: search results, the `…/page/2` fallback pages, empty categories, tags with fewer than two published items, and anything marked noindex. The sitemap applies the same rules and lists every published item.

## Setup

### Requirements

- **Node.js 22 or newer.** supabase-js needs the global `WebSocket` that Node 22 provides.
- A [Supabase](https://supabase.com) project.

### 1. Install

```bash
npm install
```

### 2. Create the database schema

The schema (tables, Row Level Security policies, search, storage buckets and storage policies) is in [`supabase/migrations/`](supabase/migrations). Apply the files **in order**, one of these ways:

1. `20261011120000_initial_schema.sql`
2. `20261012090000_search_paging.sql`
3. `20261012120000_least_privilege_grants.sql`: removes the broad grants that older Supabase projects give every new table and function automatically. Required on those projects.

- **SQL Editor:** open your project → SQL Editor, paste each file's contents in order and run it.
- **Supabase CLI** (applies them all automatically):
  ```bash
  npx supabase login
  npx supabase init            # only if supabase/config.toml does not exist yet
  npx supabase link --project-ref <your-project-ref>
  npx supabase db push
  ```

### 3. Configure authentication

The site has no public sign-up; only accounts you create can sign in.

1. **Authentication → Sign In / Providers:** keep *Email* enabled and turn **off** *Allow new users to sign up*.
2. **Authentication → Users → Add user:** create your account with an email and a strong password (tick *Auto Confirm User*).
3. Give the account the admin role in the **SQL Editor** (roles can only be changed with SQL, never through the app):

   ```sql
   insert into public.profiles (id, display_name, role)
   select id, 'Your Name', 'admin'
   from auth.users
   where email = 'you@example.com'
   on conflict (id) do update set role = 'admin';
   ```

   Repeat for every editor who needs dashboard access.

### 4. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL (Project Settings → API Keys). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key (the legacy anon key also works). **Never** use the secret or service-role key here. |
| `NEXT_PUBLIC_SITE_URL` | In production | Public address, e.g. `https://www.example.com`. Used for canonical URLs, the sitemap, social previews and security headers. |
| `NEXT_PUBLIC_SITE_NAME` | No | Defaults to `Usefully`. |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Default meta description. |

The app never uses a service-role or secret key; everything runs as the visitor or the signed-in editor, and Row Level Security decides what each can do. `NEXT_PUBLIC_*` values are compiled into the build, so rebuild after changing them.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### Checks

```bash
npm run lint             # ESLint
npm run typecheck        # route types + TypeScript
npm run build            # production build
npm run check:supabase   # security and setup checks against your Supabase project
```

## Accessing the dashboard

1. Complete [setup](#setup) steps 2 and 3: the schema must exist and your account needs the admin role.
2. Open **`/auth/login`** on your site (for example `https://www.example.com/auth/login`, or <http://localhost:3000/auth/login> locally). Visiting `/admin` while signed out also takes you there.
3. Sign in with the email and password of the account you created in Supabase. You land on the dashboard at **`/admin`**.

Only accounts with `role = 'admin'` in `public.profiles` get in; any other account is signed straight back out. To add an editor, create their user in Supabase and run the SQL from step 3 with their email. To remove access, run `update public.profiles set role = 'user' where id = (select id from auth.users where email = 'them@example.com');`. If you forget your password, set a new one under Supabase → Authentication → Users. Once signed in, you can change your password under **Settings**.

## Verify your setup

### 1. Automated check

```bash
npm run check:supabase
```

It probes your project with the same public key the website uses, so it sees exactly what any visitor (or attacker) can. It checks that:

- the configured key is a public one (fails if it's a secret or service-role key)
- the migrations are applied
- drafts, the redirects table, account roles and dashboard statistics are not readable
- visitors cannot add content, delete content or change account roles
- files in the storage buckets cannot be listed
- public sign-up is disabled
- the site URL uses `https://`

It never changes your data (its write attempts match zero rows) and never prints your keys. Fix anything marked `FAIL`.

### 2. Database settings (SQL Editor)

```sql
-- Row Level Security is enabled on every table (expect no rows)
select relname from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;

-- Buckets (expect media: public = true, downloads: public = false)
select id, public, file_size_limit from storage.buckets where id in ('media', 'downloads');

-- Least-privilege grants (expect every value to be false)
select
  has_column_privilege('anon', 'public.profiles', 'role', 'SELECT') as visitors_read_roles,
  has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') as accounts_change_roles,
  has_table_privilege('anon', 'public.redirects', 'SELECT') as visitors_read_redirects,
  has_table_privilege('anon', 'public.content_items', 'INSERT') as visitors_write_content,
  has_table_privilege('authenticated', 'public.content_items', 'TRUNCATE') as accounts_truncate,
  has_function_privilege('anon', 'public.content_status_counts()', 'EXECUTE') as visitors_call_stats;

-- Dashboard accounts (expect one row per editor)
select u.email, p.display_name from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
```

### 3. Manual walk-through

1. Sign in at `/auth/login`. You should land on `/admin`.
2. Create a category, then an article. Choose **Save draft**.
3. In a private browser window (signed out), open the article's URL. It must show **404**.
4. Publish it, then reload the private window. The article appears, and it's listed on `/articles` and in `/sitemap.xml`.
5. Click the share icon. The link must be the article's page on your site.
6. Upload an image in **Media**, and a file to a download. Open the download page signed out, and check that **Download** starts the file.
7. **Unpublish** the article. The private window shows 404 again.
8. Sign out. Visiting `/admin` must send you back to the sign-in page.

## Production security checklist

Most of this is already enforced in code; these are the settings only you can make.

**Supabase dashboard**
- [ ] All three migrations applied, `npm run check:supabase` passes, and the "Least-privilege grants" query above returns only `false`.
- [ ] *Allow new users to sign up* is **off** (Authentication → Sign In / Providers).
- [ ] Password policy: minimum length **12** or more, and *Leaked password protection* on where your plan offers it (Authentication → Providers → Email / Policies).
- [ ] Rate limits for sign-ins and token refreshes left at their defaults or lower (Authentication → Rate Limits).
- [ ] The secret / service-role key is not in this app or in any `NEXT_PUBLIC_` variable. If it was ever exposed, rotate it (Project Settings → API Keys).
- [ ] Database: SSL enforcement on, and Network Restrictions limited to the IPs you run migrations from (Database → Settings). The app talks to Supabase over HTTPS only, never through a direct Postgres connection.
- [ ] Backups, or point-in-time recovery, appropriate for your plan.

**Hosting**
- [ ] `NEXT_PUBLIC_SITE_URL` set to your `https://` domain, then rebuilt.
- [ ] Node.js 22 or newer.
- [ ] If your host has a firewall or WAF (for example Vercel Firewall), add a rate limit on `POST /auth/login`.
- [ ] Multiple self-hosted instances share one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

**Already handled by the code**
- Row Level Security on every table, explicit Data API grants, admin role checked on every page and action (and again by the database).
- Session cookies are `httpOnly`, `Secure` in production and `SameSite=Lax`. Page scripts cannot read them, because uploads use one-time signed URLs instead of a browser session.
- Content-Security-Policy, HSTS (production), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and `Permissions-Policy` headers.
- Strict input validation on every Server Action and API request. Markdown ignores raw HTML and strips unsafe links. The sign-in redirect only allows `/admin` paths (no open redirect).
- Private downloads are served through 60-second signed links, and only for published items.
- `npm audit --omit=dev` reports no known vulnerabilities in the code that runs the site.

## Using the dashboard

A typical first session:

1. **Settings:** set your display name and a short bio. They appear as the byline and author box.
2. **Categories:** create a few categories. Descriptions are used as meta descriptions for category pages.
3. **Articles / Tutorials / Resources / Downloads → New:** write the item.
   - **Summary:** one or two plain sentences that directly answer what the page covers. It is used in listings, search results and as the meta description.
   - **Body:** Markdown. `##` headings build the table of contents. Raw HTML is not rendered.
   - **Sources:** cite what you relied on; only add sources you have checked.
   - **Resources** need the website address. **Downloads** need either an uploaded file (up to 50 MB) or an external link.
4. Use **Save draft** or **Mark ready for review**, check **Preview saved version**, then **Publish**.
5. To take a page offline without deleting it, use **Unpublish**.

Other tools:

- **Media:** upload images (JPEG, PNG, WebP, GIF or AVIF, up to 5 MB) with alt text, pick them as cover images, or copy the Markdown snippet to place an image inside an article.
- **Redirects:** every published resource and download is reachable at `/go/<its-slug>`. Add custom short links here (for example `/go/newsletter`); each visit is counted.
- **Search engine settings** (in the editor): SEO title (replaces the whole `<title>`), meta description, keywords, canonical URL (only for content first published elsewhere) and *noindex*.

## How it works

### Routes

| Path | Description |
| --- | --- |
| `/` | Home: search, 3 latest items per type (Load more) and categories |
| `/articles`, `/tutorials`, `/resources`, `/downloads` | Listings, 3 at a time. `…/page/2` and onwards are the no-JavaScript fallback (not indexed) |
| `/articles/<slug>` (and the other types) | Item pages |
| `/categories`, `/categories/<slug>` | Category index and category pages |
| `/tags/<slug>` | Tag pages |
| `/search?q=` | Search (not indexed) |
| `/api/content` | Next batch for Load more buttons (published content only, not indexed) |
| `/go/<slug>` | Outbound links, downloads and custom redirects (counted, not indexed) |
| `/sitemap.xml`, `/robots.txt`, `/og.png` | SEO files and the default social image |
| `/admin`, `/auth/login` | Dashboard and sign-in |

Slugs are unique across all content types, which keeps `/go/<slug>` unambiguous.

### Caching and publishing

- Public pages are prerendered and served as static HTML containing the first 3 items. Every public data read uses `'use cache'` and the `public-content` tag.
- **Load more** requests `/api/content`. It validates its parameters, reuses the same cached, RLS-restricted queries, returns only published items and skips any it has already shown.
- Dashboard actions that touch published content call `updateTag('public-content')`, so listings, item pages, the sitemap and search reflect the change on the next request. Content also revalidates hourly as a safety net.
- Item pages use `ensureStatic = 'navigation'`: an item published after the build is generated on its first visit, and unknown or unpublished slugs return a real `404`.
- If the database cannot be reached, list pages show an empty state that is cached for minutes only, while an item page returns an error instead of caching a false "not found".
- Dashboard pages are rendered per request.

### Security model

- **Row Level Security** on every table. Visitors can read published content only. Drafts, items in review, redirects and unused media are visible only to admins, identified by `profiles.role = 'admin'` through a `private.is_admin()` helper that is not exposed by the API.
- **Explicit grants:** new tables are no longer exposed to the Supabase Data API automatically (enforced from 2026-10-30), so the migrations grant each role exactly what it needs. Editors can change only their own display name and bio, never a role.
- **Authentication:** the proxy (`src/proxy.ts`) refreshes the session and redirects signed-out visitors away from `/admin`. Every admin page and Server Action verifies the JWT (`getClaims`) and the admin role again, and RLS is the final check. Sign-in uses the same message for unknown accounts and wrong passwords.
- **Cookies:** auth cookies are `httpOnly`. The browser never holds a Supabase session: to upload, the dashboard asks a Server Action (which checks the admin role) for a one-time signed upload URL for one generated path.
- **Storage:** `media` is a public image bucket (5 MB, no SVG). `downloads` is private (50 MB); storage policies let visitors obtain a 60-second signed link only for files attached to published downloads. Only admins can upload or delete.
- **Input handling:** all Server Action and API input is validated with zod. URLs must be `http(s)` (also enforced by database constraints). Markdown ignores raw HTML and strips unsafe link targets. JSON-LD output is escaped.
- **Headers** (`next.config.ts`): Content-Security-Policy, HSTS in production, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and `Permissions-Policy`.

### Writing for search and AI answers

The technical SEO is handled; what ranks and gets quoted is useful content. Lead with a summary that answers the question, use descriptive `##` headings for each step or sub-question, cite primary sources, keep facts and dates accurate, and update the page when things change (the *Updated* date is shown and sent to search engines). Avoid repeating keywords and avoid publishing pages that say little: the publishing checks and noindex rules exist to keep the site free of thin pages.

### Project structure

```
src/
  app/
    (public)/        public site: home, listings, item pages, categories, tags, search
    admin/           dashboard
    api/content/     next batch for Load more buttons
    auth/login/      sign-in
    go/[slug]/       outbound link and download redirects
    sitemap.ts, robots.ts, og.png/, icon.svg, apple-icon.tsx
  components/
    admin/           dashboard UI (editor, tables, forms)
    content/         item page, lists, Load more, share button, Markdown
    site/            header, footer, search box, logo
    ui/              small form and layout primitives
  lib/
    admin/           Server Actions (including signed uploads), admin queries and validation
    content/         public queries (cached), feeds, types and route helpers
    supabase/        server, upload, public and proxy clients
    auth.ts          admin checks (data access layer)
    seo.ts           metadata and structured data builders
scripts/check-supabase.mjs   setup and security check
supabase/migrations/         database schema
public/logo/                 logo files
```

## Deployment

### Vercel

1. Push the repository and import it in Vercel.
2. Add the environment variables from the table above for Production (and Preview if you use it), with `NEXT_PUBLIC_SITE_URL` set to your domain.
3. Set **Node.js 22.x** or newer (Project Settings → Build and Deployment).
4. Deploy, then sign in at `/auth/login` and publish your first items.

### Any Node.js host

```bash
npm ci
npm run build
npm run start   # listens on port 3000
```

- Use Node.js 22 or newer.
- Serve the site over HTTPS (HSTS and `Secure` cookies are on in production).
- Behind a reverse proxy, forward the `Host` / `X-Forwarded-Host` headers (Server Actions compare them with `Origin`) and disable response buffering so pages can stream.
- When running more than one instance, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the same value on every instance.

### Changing the schema

Add a new migration under `supabase/migrations/` (for example with `npx supabase migration new <name>`), apply it, then regenerate the TypeScript types. In every new migration, enable RLS, `revoke all` on new tables and functions from `anon` and `authenticated`, then grant only what is needed (see `20261012120000_least_privilege_grants.sql`): older projects grant everything by default.

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/database.types.ts
```

If you applied earlier migrations in the SQL Editor and later switch to the CLI, first tell the CLI they are already applied, so `db push` does not run them again:

```bash
npx supabase migration repair --status applied 20261011120000 20261012090000 20261012120000
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Logs show `Could not find the table 'public.content_items'` (`PGRST205`) and the site is empty | The migrations have not been applied (step 2). |
| Search shows "temporarily unavailable" and logs mention `search_content` | Apply the second migration, `20261012090000_search_paging.sql`. |
| `check:supabase` says account roles or dashboard statistics are readable by anyone | Apply the third migration, `20261012120000_least_privilege_grants.sql`. |
| "This account does not have access to the dashboard" | The account has no admin profile; run the SQL in step 3. |
| "Supabase is not configured" on the sign-in page | Check `.env.local`, then restart the dev server or rebuild. |
| Signed in, but you're sent back to the login page on a plain `http://` production server | Production cookies are `Secure`; serve the site over HTTPS (localhost is exempt). |
| Cover images do not load | Image optimization allows the host of `NEXT_PUBLIC_SUPABASE_URL` at build time; rebuild after changing it. |
| Canonical URLs or the sitemap show `localhost` | Set `NEXT_PUBLIC_SITE_URL` and rebuild. |

## Notes

- A file uploaded in the download editor but never saved stays in the `downloads` bucket; remove it from Supabase → Storage if needed. Replacing or deleting a saved file removes the old one automatically.

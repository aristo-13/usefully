# Usefully

A content and resource website with an editorial dashboard. It publishes **articles**, **tutorials**, **resources** (reviewed external tools and sites) and **downloads** (uploaded files or external links), organized by categories and tags, with site search and `/go/` short links.

Built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 and Supabase (Postgres, Auth, Storage).

- [Features](#features)
- [Setup](#setup)
- [Using the dashboard](#using-the-dashboard)
- [How it works](#how-it-works)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Features

**Public site**
- Listing pages per content type with pagination, category and tag pages, and full-text search.
- Article pages with breadcrumbs, table of contents, cover image, sources, tags, author box and related reading.
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
- Per-page metadata, canonical URLs, Open Graph and Twitter cards, a default social image, XML sitemap and `robots.txt`.
- Structured data: `WebSite`/`Organization` (home), `Article` (articles, tutorials, resources), `CreativeWork` (downloads) with citations, and `BreadcrumbList`.
- Thin pages are kept out of the index: search results, empty categories, tags with fewer than two published items, and anything marked noindex. The sitemap applies the same rules.

## Setup

### Requirements

- **Node.js 22 or newer.** supabase-js needs the global `WebSocket` that Node 22 provides.
- A [Supabase](https://supabase.com) project.

### 1. Install

```bash
npm install
```

### 2. Create the database schema

The whole schema (tables, Row Level Security policies, search, storage buckets and storage policies) is in [`supabase/migrations/20261011120000_initial_schema.sql`](supabase/migrations/20261011120000_initial_schema.sql). Apply it **one** of these ways:

- **SQL Editor:** open your project → SQL Editor, paste the file's contents and run it.
- **Supabase CLI:**
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key (the legacy anon key also works). |
| `NEXT_PUBLIC_SITE_URL` | In production | Public address, e.g. `https://www.example.com`. Used for canonical URLs, the sitemap and social previews. |
| `NEXT_PUBLIC_SITE_NAME` | No | Defaults to `Usefully`. |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Home page heading and default meta description. |

The app never uses a service-role or secret key; everything runs as the visitor or the signed-in editor, and Row Level Security decides what each can do. `NEXT_PUBLIC_*` values are compiled into the build, so rebuild after changing them.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>, then sign in at <http://localhost:3000/auth/login>.

### Checks

```bash
npm run lint        # ESLint
npm run typecheck   # route types + TypeScript
npm run build       # production build
```

## Using the dashboard

A typical first session:

1. **Settings:** set your display name and a short bio. They appear as the byline and author box.
2. **Categories:** create a few categories with descriptions. Each one becomes a landing page, and the description is its intro and meta description.
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
| `/` | Home: latest items per type and categories |
| `/articles`, `/tutorials`, `/resources`, `/downloads` | Listings; further pages at `…/page/2` |
| `/articles/<slug>` (and the other types) | Item pages |
| `/categories`, `/categories/<slug>` | Category index and category pages |
| `/tags/<slug>` | Tag pages |
| `/search?q=` | Search (not indexed) |
| `/go/<slug>` | Outbound links, downloads and custom redirects (counted, not indexed) |
| `/sitemap.xml`, `/robots.txt`, `/og.png` | SEO files and the default social image |
| `/admin`, `/auth/login` | Dashboard and sign-in |

Slugs are unique across all content types, which keeps `/go/<slug>` unambiguous.

### Caching and publishing

- Public pages are prerendered and served as static HTML. Every public data read uses `'use cache'` and the `public-content` tag.
- Dashboard actions that touch published content call `updateTag('public-content')`, so listings, item pages, the sitemap and search reflect the change on the next request. Content also revalidates hourly as a safety net.
- Item pages use `ensureStatic = 'navigation'`: an item published after the build is generated on its first visit, and unknown or unpublished slugs return a real `404`.
- If the database cannot be reached, list pages show an empty state that is cached for minutes only, while an item page returns an error instead of caching a false "not found".
- Dashboard pages are rendered per request.

### Security model

- **Row Level Security** on every table. Visitors can read published content only. Drafts, items in review, redirects and unused media are visible only to admins, identified by `profiles.role = 'admin'` through a `private.is_admin()` helper that is not exposed by the API.
- **Explicit grants:** new tables are no longer exposed to the Supabase Data API automatically (enforced from 2026-10-30), so the migration grants each role exactly what it needs. Editors can change only their own display name and bio, never a role.
- **Authentication:** the proxy (`src/proxy.ts`) refreshes the session and redirects signed-out visitors away from `/admin`. Every admin page and Server Action verifies the JWT (`getClaims`) and the admin role again, and RLS is the final check. Sign-in uses the same message for unknown accounts and wrong passwords.
- **Storage:** `media` is a public image bucket (5 MB, no SVG). `downloads` is private (50 MB); storage policies let visitors obtain a 60-second signed link only for files attached to published downloads. Only admins can upload or delete.
- **Input handling:** all Server Action input is validated with zod. URLs must be `http(s)` (also enforced by database constraints). Markdown ignores raw HTML and strips unsafe link targets. JSON-LD output is escaped.
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` headers are set in `next.config.ts`.

### Writing for search and AI answers

The technical SEO is handled; what ranks and gets quoted is useful content. Lead with a summary that answers the question, use descriptive `##` headings for each step or sub-question, cite primary sources, keep facts and dates accurate, and update the page when things change (the *Updated* date is shown and sent to search engines). Avoid repeating keywords and avoid publishing pages that say little: the publishing checks and noindex rules exist to keep the site free of thin pages.

### Project structure

```
src/
  app/
    (public)/        public site: home, listings, item pages, categories, tags, search
    admin/           dashboard
    auth/login/      sign-in
    go/[slug]/       outbound link and download redirects
    sitemap.ts, robots.ts, og.png/, icon.svg, apple-icon.tsx
  components/
    admin/           dashboard UI (editor, tables, forms)
    content/         article, listing, Markdown and pagination components
    site/            header, footer, search box, logo
    ui/              small form and layout primitives
  lib/
    admin/           Server Actions, admin queries and validation
    content/         public queries (cached), types and route helpers
    supabase/        server, browser, public and proxy clients
    auth.ts          admin checks (data access layer)
    seo.ts           metadata and structured data builders
supabase/migrations/ database schema
public/logo/         logo files
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
- Behind a reverse proxy, forward the `Host` / `X-Forwarded-Host` headers (Server Actions compare them with `Origin`) and disable response buffering so pages can stream.
- When running more than one instance, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the same value on every instance.

### Changing the schema

Add a new migration under `supabase/migrations/` (for example with `npx supabase migration new <name>`), apply it, then regenerate the TypeScript types:

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/database.types.ts
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Logs show `Could not find the table 'public.content_items'` (`PGRST205`) and the site is empty | The migration has not been applied (step 2). |
| "This account does not have access to the dashboard" | The account has no admin profile; run the SQL in step 3. |
| "Supabase is not configured" on the sign-in page | Check `.env.local`, then restart the dev server or rebuild. |
| Cover images do not load | Image optimization allows the host of `NEXT_PUBLIC_SUPABASE_URL` at build time; rebuild after changing it. |
| Canonical URLs or the sitemap show `localhost` | Set `NEXT_PUBLIC_SITE_URL` and rebuild. |

## Notes

- `npm audit` reports advisories in dependencies of the `shadcn` CLI (build tooling, not code that runs on the site).
- A file uploaded in the download editor but never saved stays in the `downloads` bucket; remove it from Supabase → Storage if needed. Replacing or deleting a saved file removes the old one automatically.

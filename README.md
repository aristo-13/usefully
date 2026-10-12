# Usefully

A content and resource website with an editorial dashboard. It publishes **articles**, **tutorials**, **resources** (reviewed external tools and sites) and **downloads** (uploaded files or external links), organized by categories and tags, with site search and `/go/` short links.

Built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 and Supabase (Postgres, Auth, Storage).

- [Features](#features)
- [Setup](#setup)
- [Accessing the dashboard](#accessing-the-dashboard)
- [Verify your setup](#verify-your-setup)
- [Production security checklist](#production-security-checklist)
- [Using the dashboard](#using-the-dashboard)
- [Trends and SEO](#trends-and-seo)
- [AI writer](#ai-writer)
- [Ads and reader engagement](#ads-and-reader-engagement)
- [How it works](#how-it-works)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Features

**Public site**
- Pages show the breadcrumb and the content only: no visible page titles or descriptions. Each page keeps a hidden heading for screen readers and search engines.
- Every list (home sections, articles, tutorials, resources, downloads, categories, category and tag pages, search results) shows **3 items at a time** with a **Load more** button. Without JavaScript the button is a link to the next page, so everything stays reachable.
- Every item has a **share** button. It shares the item's page on this site (using the device's share sheet, or copying the link), never a direct download or outbound link, so people land on the page and decide what to do there.
- Item pages with breadcrumbs, table of contents, cover image (uploaded or linked from another site), sources, tags, author box and related reading. Downloads show the app's icon next to the title. Resources can feature a video (YouTube, Vimeo or a video file); YouTube and Vimeo load only when a visitor presses play.
- Cards show a download's icon, otherwise the cover image (or the video's still image), so lists are easy to scan.
- Every page fades in when it opens, on a full load and after navigating (instant for visitors who prefer reduced motion).
- **Keeps readers reading:** a reading progress bar with the minutes left, "Also read" links between sections, an "Up next" bar near the end that suggests a page the visitor has not read yet, and "Pick up where you left off" for returning visitors. Links to other sites open in a new tab. See [Ads and reader engagement](#ads-and-reader-engagement).
- **Google AdSense** (optional): Auto ads, in-article ads between sections, `ads.txt` and the required privacy page. Off until you add your publisher ID.
- Resource pages link out through `/go/<slug>`; download pages show file name, format, size, version and last update. Uploaded files are served through short-lived signed links.
- Static, cached pages that update the moment an editor publishes, unpublishes or edits something.

**Dashboard (`/admin`)**
- Create, edit, preview, publish, unpublish and delete all content.
- Workflow: *Draft → Ready for review → Published*. Publishing records who approved the item and when.
- Categories, tags, keywords, media library, custom `/go/` redirects with click counts, and SEO fields (SEO title, meta description, canonical URL, noindex).
- Every post has a cover image field, downloads an app icon field and resources a video field. Each one accepts an upload, a link or a file from the media library, with a preview that appears as soon as you pick a file or paste a link.
- **AI writer** (optional, free with Gemini or paid with Claude): every field of the post editor (title, slug, summary, body, SEO title, meta description, keywords, tags, category, difficulty, cover alt text) has a Write with AI button, and **Write the whole post** researches the topic, writes the body and fills in every other field. See [AI writer](#ai-writer).
- **Trends:** top Google searches, news, YouTube videos, X trends and Wikipedia's most-read pages, for Ghana and worldwide. Start a post from any topic with the title, keywords and source filled in, or **Draft with AI** to have it researched and written for you to review; topics you have covered are marked.
- **SEO:** Google Search Console performance, index status and sitemap; Bing and other IndexNow engines told about every change; content checks that point out what to fix on each post.

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
4. `20261012180000_post_media.sql`: linked cover images, app icons for downloads, videos for resources, and MP4/WebM videos in the media library. The site's pages need it.

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

The example file lists every setting with a placeholder. A value that is empty or still starts with `your-` counts as **not set**: the feature behind it stays off (and says how to turn it on) instead of failing, so you can fill the values in as you get them.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL (Project Settings → API Keys). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key (the legacy anon key also works). **Never** use the secret or service-role key here. |
| `NEXT_PUBLIC_SITE_URL` | In production | Public address, e.g. `https://www.example.com`. Used for canonical URLs, the sitemap, social previews and security headers. |
| `NEXT_PUBLIC_SITE_NAME` | No | Defaults to `Usefully`. |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Default meta description. |
| `GEMINI_API_KEY` | No | Free Gemini API key: turns on the [AI writer](#ai-writer). Server only. |
| `GEMINI_MODEL` | No | Another Gemini model, for when Google retires the default (`gemini-3.8-flash`). |
| `ANTHROPIC_API_KEY` | No | Claude API key (paid): the [AI writer](#ai-writer) with web research. Used instead of Gemini when set. Server only. |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | No | AdSense publisher ID, e.g. `ca-pub-1234567890123456`: turns on [ads](#ads-and-reader-engagement). |
| `NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE` | No | ID of an AdSense *In-article* ad unit, e.g. `1234567890`, for ads between sections. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Shown on `/privacy` as the address for privacy questions. |
| `YOUTUBE_API_KEY` | No | Free YouTube Data API key: popular videos on the Trends page. |
| `X_BEARER_TOKEN` | No | Bearer token of a paid X API plan that includes trends. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | JSON key of a Google service account that can read your Search Console property. |
| `SEARCH_CONSOLE_PROPERTY` | No | Your Search Console property, e.g. `sc-domain:example.com`. |
| `INDEXNOW_KEY` | No | 8 to 128 letters, digits or dashes; served at `/indexnow.txt`. |

The app never uses a Supabase service-role or secret key; everything runs as the visitor or the signed-in editor, and Row Level Security decides what each can do. `NEXT_PUBLIC_*` values are compiled into the build, so rebuild after changing them. The AI keys and the five keys for the [Trends and SEO](#trends-and-seo) pages are read only on the server: never give them a `NEXT_PUBLIC_` name. **Settings** in the dashboard shows whether the AI writer and AdSense are on.

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
- [ ] All four migrations applied, `npm run check:supabase` passes, and the "Least-privilege grants" query above returns only `false`.
- [ ] *Allow new users to sign up* is **off** (Authentication → Sign In / Providers).
- [ ] Password policy: minimum length **12** or more, and *Leaked password protection* on where your plan offers it (Authentication → Providers → Email / Policies).
- [ ] Rate limits for sign-ins and token refreshes left at their defaults or lower (Authentication → Rate Limits).
- [ ] The secret / service-role key is not in this app or in any `NEXT_PUBLIC_` variable. If it was ever exposed, rotate it (Project Settings → API Keys).
- [ ] Database: SSL enforcement on, and Network Restrictions limited to the IPs you run migrations from (Database → Settings). The app talks to Supabase over HTTPS only, never through a direct Postgres connection.
- [ ] Backups, or point-in-time recovery, appropriate for your plan.

**Hosting**
- [ ] `NEXT_PUBLIC_SITE_URL` set to your `https://` domain, then rebuilt.
- [ ] `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` (if used) are set only as server variables; with Claude, a monthly spend limit is set in the Claude Console.
- [ ] With AdSense on: `/ads.txt` shows your publisher ID, the consent message for the EEA/UK is published, and `/privacy` has a contact address.
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
   - **Resources** need a website address, a video or a cover photo before publishing. **Downloads** need either an uploaded file (up to 50 MB) or an external link.
   - **Cover image** (every post), **App icon** (downloads) and **Video** (resources): choose *Upload*, *Link* or *Library*. The preview updates as soon as you pick a file or paste a link. Links to other sites must start with `https://`; videos can be YouTube or Vimeo links, or a direct link to an MP4 or WebM file. Give covers alt text that describes the image.
4. Use **Save draft** or **Mark ready for review**, check **Preview saved version**, then **Publish**.
5. **Edit a live post** from its row in the list, or with the **Edit** button that appears next to **Share** on the post itself while you are signed in. Change anything, then press **Update live page**: the page stays online while you edit and the changes go live at once. If something needs fixing first, nothing is saved and the live page stays as it was. A post approved earlier keeps its approval for changes you make by hand; text the AI writes needs the review box ticked again.
6. To take a page offline without deleting it, use **Unpublish**.

Other tools:

- **Media:** upload images (JPEG, PNG, WebP, GIF or AVIF, up to 5 MB) and videos (MP4 or WebM, up to 50 MB). Use them as covers, icons or videos, or copy the Markdown snippet to place an image inside an article. Deleting a file removes it from every post that uses it.
- **Redirects:** every published resource and download is reachable at `/go/<its-slug>`. Add custom short links here (for example `/go/newsletter`); each visit is counted.
- **Trends** and **SEO:** see [Trends and SEO](#trends-and-seo).
- **Search engine settings** (in the editor): SEO title (replaces the whole `<title>`), meta description, keywords, canonical URL (only for content first published elsewhere) and *noindex*.

## Trends and SEO

### Trends (`/admin/trends`)

Two tabs, **Ghana** and **Global**, list what people are searching for and talking about right now:

| Source | Ghana | Global | Setup |
| --- | --- | --- | --- |
| Top Google searches (Google Trends) | Ghana | Combined from 8 large markets (US, UK, India, Nigeria, South Africa, Kenya, Canada, Australia); terms trending in more countries come first | None |
| Top news (Google News) | Ghana edition | World section | None |
| Popular videos (YouTube) | Ghana | US, UK and India | `YOUTUBE_API_KEY` (free) |
| Trending on X | Ghana | Worldwide | `X_BEARER_TOKEN` (paid X API plan that includes trends) |
| Most-read pages (Wikipedia) | – | English Wikipedia, yesterday | None |

- **Write a post** opens a new article with the title, a keyword and the news story as a source already filled in. On a YouTube video, **Feature as a resource** opens a new resource with the video attached. With the [AI writer](#ai-writer) on, **Draft with AI** next to each opens the same post and has it researched and written for you to review.
- Topics that an existing post's title already mentions are marked **Covered**, with a link to that post.
- Lists are cached for 15 minutes; **Refresh** fetches them again.
- **Instagram, Facebook and TikTok** do not offer trend data to other websites, and copying it out of their apps breaks their terms, so the page links to where you can check them by hand. X shares trends only through its paid API.

To get a YouTube key: in the Google Cloud console, create a project, enable *YouTube Data API v3*, then *Credentials → Create credentials → API key*, and restrict the key to that API. The free daily quota is far more than the page uses.

### SEO (`/admin/seo`)

- **Google Search Console** (once connected): clicks, impressions, click rate and average position for the last 28 days; top searches and pages; *opportunities* (searches just off the first page, and searches where you appear often but few people click); the index status of the 20 most recent posts, with plain-language advice and a link to inspect each page; and the sitemap's status, with a button to submit it.
- **Bing and others (IndexNow):** every publish, edit, unpublish or delete of a published post is announced automatically, so Bing, Yandex and other IndexNow engines recrawl it within minutes. A button sends every page at once.
- **Content checks:** every published post is checked for what holds it back: noindex left on, duplicate titles, descriptions that are too short or too long, titles that get cut off, thin pages, missing sources, cover images or alt text, missing categories or tags, and pages not updated for a year. Each comes with an Edit link.

Google offers no way to make it index ordinary pages faster (its Indexing API is limited to job postings and livestreams). Keep the sitemap submitted, link new posts from older ones, and use *Request indexing* in Search Console for important pages.

**Connect Google Search Console**

1. Add and verify the site in [Search Console](https://search.google.com/search-console). A *Domain* property, verified with a DNS record, covers every address of the site.
2. In Google Cloud, create a project, enable the *Google Search Console API*, create a service account, and create a JSON key for it.
3. In Search Console, open *Settings → Users and permissions* and add the service account's email address. *Full* permission is needed to submit the sitemap; *Restricted* is enough for the reports.
4. Set `GOOGLE_SERVICE_ACCOUNT_KEY` to the contents of the JSON key file (or the same JSON base64-encoded) and `SEARCH_CONSOLE_PROPERTY` to `sc-domain:your-domain` (Domain property) or `https://your-domain/` (URL-prefix property). Redeploy.

**Turn on IndexNow**

1. Choose a key of 8 to 128 letters, digits or dashes, for example `node -e "console.log(crypto.randomUUID())"`.
2. Set `INDEXNOW_KEY` and redeploy (the key file is generated at build time). `https://your-domain/indexnow.txt` must show the key. Announcements only run when `NEXT_PUBLIC_SITE_URL` is an `https://` address.
3. Optionally add the site to Bing Webmaster Tools (it can import from Search Console) to see Bing's own reports.

All of this runs on the server: trend sources and Google are called from the server, and keys are never sent to the browser or written to the logs.

## AI writer

The post editor can research and write posts with **Gemini** (Google, free tier) or **Claude** (Anthropic, paid). It is off until one of their keys is set; until then the editor says how to turn it on. With both keys set, Claude is used.

| | Gemini (`gemini-3.8-flash`) | Claude (`claude-opus-5-5`) |
| --- | --- | --- |
| Cost | Free tier, no card needed, with daily limits | Pay per use (see Cost below) |
| Research for the body | Reads the pages listed under **Sources** (such as the trend's news story). Cannot search Google on the free tier | Searches the web and reads pages itself; adds what it used to **Sources** |
| Writing quality | Good | Best |
| Your prompts | On the free tier, Google may use them to improve its products | Not used for training by default |

**Turn on Gemini (free)**

1. Sign in at [aistudio.google.com](https://aistudio.google.com) with a Google account and choose **Get API key → Create API key**.
2. Set it as `GEMINI_API_KEY` (server only, never `NEXT_PUBLIC_`) and restart or redeploy. **Settings** in the dashboard shows *AI writer: On* with the model.
3. Google retires models often. If the editor says the model is not available, set `GEMINI_MODEL` to a current Flash model from Google's [models page](https://ai.google.dev/gemini-api/docs/models).

Free-tier limits are per project and shown in AI Studio. When they run out, the editor says so; they reset daily.

**Turn on Claude (paid)**

1. At [console.anthropic.com](https://console.anthropic.com), add credit under *Billing*, set a monthly spend limit under *Settings → Limits*, then create a key under *API Keys*. A Claude Pro or Max plan does not include API credit: the API is billed separately.
2. Set it as `ANTHROPIC_API_KEY` and restart or redeploy.
3. Research uses Claude's web search and web fetch tools. If an organization admin has switched web search off in the Claude Console, the writer says so and writes from the model's own knowledge instead.

**In the editor**

- **AI writer** panel at the top: optional instructions (angle, audience, points to cover), the research option (*Research the web* with Claude, *Read the sources* with Gemini; ticked for posts started from Trends), and **Write the whole post**. That researches the topic, streams the body into the editor, then writes the title, slug (never for a published page, whose address must not change), summary, SEO title, meta description, keywords, tags, category and, for tutorials, difficulty. With Claude, pages it relied on are added to **Sources**.
- Every field also has its own button: **Write** / **Improve** for text, **Suggest** for keywords, tags, category and difficulty, **Write** / **Rewrite** for the body, and alt text that describes the cover image itself. **Undo** puts back what was there; **Stop** cancels.
- Each request sees the rest of the post, your instructions and, for posts from Trends, why the topic is trending. Bodies are written to hold attention (a hook, the answer early, clear headings, lists, an FAQ where useful) and link to up to four of your recent posts.
- Whatever the AI writes ticks *Drafted with AI assistance*, so publishing still needs the review confirmation and the page discloses AI assistance. Read it all and check the facts and sources before publishing.

**Categories:** on the **Categories** page, **Suggest categories** has the AI review your categories, your posts (and which have no category) and what people are searching for in Ghana and worldwide. It comments on each existing category (keep, rename, merge) with a better description you can apply in one click, and suggests new categories you can edit and add in one click. Nothing changes until you add or apply one.

**From Trends:** **Draft with AI** on any topic opens a new post and starts *Write the whole post* straight away, with the trend's context (for example "Trending on Google in Ghana (2,000+ searches)" and related headlines) and research on. Most trends come with a news story as their source, which Gemini reads; for trends without one (such as X), add a source link first so the facts come from somewhere current.

**Cost:** Gemini's free tier costs nothing within its limits. Claude Opus 5.5 is billed per token (US$4 per million input tokens, US$20 per million output tokens), web searches at US$10 per 1,000: short fields cost a few cents at most, and a researched body usually well under US$1. The Claude instructions are cached between requests, which makes repeated buttons on the same post cheaper. If Claude's safety filters decline a request, the API retries it on another model automatically.

The keys stay on the server. The editor talks to `/admin/ai`, which accepts only same-origin requests from signed-in admins.

## Ads and reader engagement

### Google AdSense

1. Apply at [adsense.google.com](https://adsense.google.com) with your domain once the site is live with original, reviewed posts.
2. Copy your publisher ID (*Account → Account information*, `ca-pub-…`) into `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and rebuild. This adds the AdSense code to public pages (never the dashboard or sign-in page), serves `/ads.txt`, opens the Content-Security-Policy for Google's ad hosts, and adds the advertising and cookie disclosures that AdSense requires to `/privacy` (linked in the footer).
3. In AdSense, turn on **Auto ads** for the site (*Ads → By site*).
4. Recommended: create an **In-article** ad unit (*Ads → By ad unit*) and put its ID in `NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE`. Up to two in-article ads then appear between sections of every post, including pages reached by clicking around the site (Auto ads only fill the first page of a visit, because later pages load without a full page reload). Units are labelled *Advertisement* and take no space when unfilled or blocked.
5. *Privacy & messaging → European regulations*: publish a consent message. Google requires one for visitors from the EEA, the UK and Switzerland, and the AdSense code shows it with no change to the site.
6. Set `NEXT_PUBLIC_CONTACT_EMAIL` so the privacy page has a contact address, and read the page through (it describes what this site does; adapt it if you add other services).

### What keeps readers on the site

Built into every post page, without slowing it or moving the layout:

- **Reading progress bar** under the header, with the minutes left on wide screens.
- **"Also read"** links between sections to related posts (same category first), placed where readers decide whether to go on.
- **"Up next"** bar once a reader is three quarters through, suggesting a related post they have not opened yet.
- **"Pick up where you left off"** for returning visitors: on the post itself, and on the home page for their latest unfinished post.
- **Links to other websites** (in posts, sources and Visit buttons) open in a new tab, so your page stays open behind them.
- **AI-written posts** follow a structure that holds attention and link to your related posts.

Reading progress is stored only in the visitor's browser (local storage), never sent to the server; the privacy page says so.

Deliberately left out: tricks that inflate time on site by misleading visitors get AdSense accounts suspended and earnings withheld, and some also hurt search rankings. The site does not hijack the back button, disguise ads as content or download buttons, put ads next to buttons to cause accidental clicks, split articles across pages for extra page views, refresh ads automatically, open pop-unders, or cover content with pop-ups.

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
| `/admin/trends`, `/admin/seo` | Trends and SEO tools (admins only) |
| `/admin/ai` | AI writer endpoint used by the post editor (admins only, same-origin `POST`, streams newline-delimited JSON) |
| `/admin/edit?path=/articles/<slug>` | Opens a live post in the editor (the **Edit** button on post pages; admins only) |
| `/privacy` | Privacy policy, including the AdSense cookie disclosures when ads are on |
| `/indexnow.txt` | IndexNow key file (only when `INDEXNOW_KEY` is set) |
| `/ads.txt` | Authorises Google to sell ads on the site (only when `NEXT_PUBLIC_ADSENSE_CLIENT_ID` is set) |

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
- **Cookies:** auth cookies are `httpOnly`. The browser never holds a Supabase session: to upload, the dashboard asks a Server Action (which checks the admin role) for a one-time signed upload URL for one generated path. While someone is signed in, the proxy also sets a readable `editor-hint` cookie so static post pages can show them an **Edit** button; it grants nothing (the dashboard checks the session and role itself) and is cleared on sign-out.
- **Storage:** `media` is a public bucket for images (5 MB, no SVG) and videos (MP4/WebM, 50 MB). `downloads` is private (50 MB); storage policies let visitors obtain a 60-second signed link only for files attached to published downloads. Only admins can upload or delete.
- **Input handling:** all Server Action and API input is validated with zod. URLs must be `http(s)` (also enforced by database constraints). Markdown ignores raw HTML and strips unsafe link targets. JSON-LD output is escaped.
- **Media from other sites:** linked images and video files must use `https://` and are shown as they are; only files from your own media library go through image optimisation, so the optimiser never fetches arbitrary URLs. The only embeddable players are YouTube (privacy-enhanced `youtube-nocookie.com`) and Vimeo, sandboxed and loaded on demand.
- **External services:** Google Trends, Google News, Wikipedia, YouTube, X and Search Console are called from the server only. Keys live in server-only environment variables and are never logged; the Search Console service account needs access to that one property and nothing else.
- **AI writer:** the Gemini and Claude APIs are called from the server only. `/admin/ai` rejects requests from other origins, requires a signed-in admin (the proxy sends everyone else to the sign-in page), validates every field with zod and caps sizes. Model output only ever fills editor fields for a person to review; web pages it reads are treated as reference material, never as instructions. For Gemini's alt text the server downloads the cover itself, but only from the media library or a public `https://` address, without following redirects and up to 5 MB, so it cannot be pointed at internal addresses.
- **Headers** (`next.config.ts`): Content-Security-Policy, HSTS in production, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and `Permissions-Policy`. With AdSense on, scripts, frames and connections may also come from any HTTPS host (the ad code loads from many Google hosts, including country domains such as `adservice.google.com.gh`, that an allowlist cannot cover; inline scripts are already allowed, so this adds little exposure), and `Cross-Origin-Opener-Policy` becomes `same-origin-allow-popups` so ad clicks can open the advertiser's page.

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
    admin/           dashboard UI (editor, AI writer controls, tables, forms)
    ads/             AdSense script and in-article ad unit
    content/         item page, lists, Load more, share button, Markdown
    engagement/      reading progress, Up next, Also read, Pick up where you left off
    site/            header, footer, search box, logo
    ui/              small form and layout primitives
  lib/
    admin/           Server Actions (including signed uploads), admin queries and validation
    ai/              AI writer: provider choice (writer.ts), shared prompts (prompts.ts), Claude (claude.ts), Gemini (gemini.ts), types shared with the editor (fields.ts)
    content/         public queries (cached), feeds, types and route helpers
    supabase/        server, upload, public and proxy clients
    ads.ts           AdSense settings and ads.txt
    env.ts           reads optional settings (placeholders count as not set)
    reading-history.ts  what a visitor has read, in their own browser
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
npx supabase migration repair --status applied 20261011120000 20261012090000 20261012120000 20261012180000
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Logs show `Could not find the table 'public.content_items'` (`PGRST205`) and the site is empty | The migrations have not been applied (step 2). |
| Search shows "temporarily unavailable" and logs mention `search_content` | Apply the second migration, `20261012090000_search_paging.sql`. |
| `check:supabase` says account roles or dashboard statistics are readable by anyone | Apply the third migration, `20261012120000_least_privilege_grants.sql`. |
| Pages fail to load and logs mention `cover_image_url`, `icon_url` or `video_url` (`42703`), or `check:supabase` says post media fields are missing | Apply the fourth migration, `20261012180000_post_media.sql`. |
| A video upload is rejected by storage (unsupported type or too large) | Apply the fourth migration; it lets the `media` bucket accept MP4 and WebM videos up to 50 MB. |
| "This account does not have access to the dashboard" | The account has no admin profile; run the SQL in step 3. |
| "Supabase is not configured" on the sign-in page | Check `.env.local`, then restart the dev server or rebuild. |
| Signed in, but you're sent back to the login page on a plain `http://` production server | Production cookies are `Secure`; serve the site over HTTPS (localhost is exempt). |
| Cover images do not load | Image optimization allows the host of `NEXT_PUBLIC_SUPABASE_URL` at build time; rebuild after changing it. |
| Canonical URLs or the sitemap show `localhost` | Set `NEXT_PUBLIC_SITE_URL` and rebuild. |
| The editor says "The AI writer is off" | Neither `GEMINI_API_KEY` nor `ANTHROPIC_API_KEY` is set (or they still hold the `your-…` placeholder). Set one and restart. |
| "Gemini's free usage limit is used up for now" | The free tier's daily quota ran out. Wait for it to reset, or add a Claude key. |
| "The Gemini model … is not available" | Google retired it. Set `GEMINI_MODEL` to a current Flash model from Google's models page and restart. |
| "The Claude API key was not accepted" / "billing problem" | Check the key, and that the Claude Console account has credit. |
| "Web research is not available for this API key" | Web search is switched off for the organization in the Claude Console; the body is written without research until it is allowed. |
| "Your session has ended" when using an AI button | Sign in again in another tab, then retry (your edits stay in the editor). |
| No ads appear | Check `/ads.txt` and **Settings** (*Google AdSense: On*), rebuild after setting the ID, and wait for AdSense to approve the site; ad blockers hide ads too. |

## Notes

- A file uploaded in the download editor but never saved stays in the `downloads` bucket; remove it from Supabase → Storage if needed. Replacing or deleting a saved file removes the old one automatically.

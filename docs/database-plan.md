# Database

The schema lives in [`supabase/migrations/20261011120000_initial_schema.sql`](../supabase/migrations/20261011120000_initial_schema.sql). This page summarizes it.

All four content types share one table, so search, tags, categories, the sitemap and the editor work the same way for every type.

## Tables

### `profiles`
Authors and admins, one row per `auth.users` account that needs dashboard access (created with SQL, see the README).
- `id` (uuid, references `auth.users`), `display_name`, `bio`
- `role`: `'user' | 'admin'`. Only changeable with SQL; the API grants editors update access to `display_name` and `bio` only.

### `content_items`
Articles, tutorials, resources and downloads.
- `type`: `'article' | 'tutorial' | 'resource' | 'download'`
- `status`: `'draft' | 'in_review' | 'published'`
- `title`, `slug` (unique across all types), `excerpt` (summary), `body` (Markdown)
- `category_id` → `categories`, `author_id` → `profiles`, `cover_media_id` → `media`
- SEO: `seo_title`, `seo_description`, `canonical_url`, `noindex`, `keywords text[]`
- Type-specific: `external_url` (resources, external downloads), `file_path`/`file_name`/`file_size`/`file_mime` (uploaded downloads), `version`, `difficulty` (tutorials)
- Trust: `sources jsonb` (`[{ title, url, publisher? }]`), `ai_generated`, `reviewed_by`, `reviewed_at`
- `published_at` (set on first publish), `updated_at` (not changed by click counting), `click_count`, `search_vector` (weighted full-text index: title, then summary and keywords, then body)

Constraints: a published row must have `reviewed_at`; published resources need a URL; published downloads need a file or a URL; URLs must be `http(s)`; slugs are lowercase words separated by hyphens.

### `categories`, `tags`
`name`, `slug` (unique), `description`. Items have at most one category and any number of tags through `content_tags (content_id, tag_id)`.

### `media`
Images in the `media` bucket: `storage_path`, `file_name`, `mime_type`, `size_bytes`, `width`, `height`, `alt_text`, `uploaded_by`.

### `redirects`
Custom short links served at `/go/<slug>`: `slug` (unique), `destination_url`, `is_active`, `click_count`, `notes`.

## Functions

| Function | Access | Purpose |
| --- | --- | --- |
| `search_content(query, type, limit)` | everyone (RLS applies) | Ranked full-text search with a partial-title fallback. Published items only. |
| `resolve_go_link(slug)` | everyone (security definer) | Returns the target of an active redirect or a published resource/download and increments its click counter. |
| `category_counts()`, `tag_counts()` | everyone | Published item counts. |
| `content_status_counts()` | signed-in (RLS applies) | Dashboard counts by type and status. |
| `private.is_admin()` | used by policies | Whether the current user has the admin role. Not exposed by the API. |

## Access rules (RLS)

| Table | Visitors (`anon`) | Admins |
| --- | --- | --- |
| `content_items`, `content_tags` | Published items only | Everything |
| `categories`, `tags` | Read | Everything |
| `media` | Images used as covers of published items | Everything |
| `profiles` | `id`, `display_name`, `bio` of authors and reviewers of published items | Read all; editors update their own name and bio |
| `redirects` | None (resolved only through `resolve_go_link`) | Everything |

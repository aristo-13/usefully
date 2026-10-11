-- =============================================================================
-- Initial schema: content, taxonomy, media, redirects, search and storage.
--
-- Access model
--   * anon / authenticated: read published content only (enforced by RLS).
--   * admins (public.profiles.role = 'admin'): full read/write.
--   * Drafts and items in review are never readable without the admin role.
--
-- New tables in `public` are no longer exposed to the Data API automatically,
-- so every table below is granted explicitly. RLS decides which rows each role
-- can see once a table is reachable.
-- =============================================================================

-- Helper functions live in a schema that is not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;
-- RLS policies scoped to `authenticated` call private.is_admin().
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Profiles (one row per admin/author; created manually, see README)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  bio text not null default '' check (char_length(bio) <= 600),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Authors and administrators. Roles can only be changed with SQL, never through the API.';

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Taxonomy
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Media library (images stored in the public `media` bucket)
-- -----------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (char_length(storage_path) between 1 and 300),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif')),
  size_bytes bigint not null check (size_bytes > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  uploaded_by uuid constraint media_uploaded_by_fkey
    references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_uploaded_by_idx on public.media (uploaded_by);
create index media_created_at_idx on public.media (created_at desc);

create trigger media_set_updated_at
  before update on public.media
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Content: articles, tutorials, resources and downloads share one table
-- -----------------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('article', 'tutorial', 'resource', 'download')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published')),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  excerpt text not null default '' check (char_length(excerpt) <= 320),
  body text not null default '' check (char_length(body) <= 200000),

  category_id uuid constraint content_items_category_id_fkey
    references public.categories (id) on delete set null,
  author_id uuid constraint content_items_author_id_fkey
    references public.profiles (id) on delete set null,
  cover_media_id uuid constraint content_items_cover_media_id_fkey
    references public.media (id) on delete set null,

  -- SEO overrides. Empty values fall back to title/excerpt/canonical page URL.
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  canonical_url text check (canonical_url ~ '^https?://' and char_length(canonical_url) <= 2000),
  noindex boolean not null default false,
  keywords text[] not null default '{}' check (cardinality(keywords) <= 10),

  -- Resources link out; downloads use either an external link or an uploaded file.
  external_url text check (external_url ~ '^https?://' and char_length(external_url) <= 2000),
  file_path text check (char_length(file_path) <= 300),
  file_name text check (char_length(file_name) <= 255),
  file_size bigint check (file_size >= 0),
  file_mime text check (char_length(file_mime) <= 150),
  version text check (char_length(version) <= 50),
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),

  -- Trust signals and editorial review.
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  ai_generated boolean not null default false,
  reviewed_by uuid constraint content_items_reviewed_by_fkey
    references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,

  click_count bigint not null default 0,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Nothing reaches the public site without a recorded human review.
  constraint content_items_published_requires_review
    check (status <> 'published' or reviewed_at is not null),
  constraint content_items_published_requires_date
    check (status <> 'published' or published_at is not null),
  constraint content_items_resource_requires_url
    check (type <> 'resource' or status <> 'published' or external_url is not null),
  constraint content_items_download_requires_source
    check (type <> 'download' or status <> 'published' or external_url is not null or file_path is not null)
);

comment on column public.content_items.ai_generated is
  'Drafted with AI assistance. Publishing still requires an explicit human review (reviewed_at).';

create index content_items_published_type_idx
  on public.content_items (type, published_at desc) where status = 'published';
create index content_items_published_idx
  on public.content_items (published_at desc) where status = 'published';
create index content_items_category_id_idx on public.content_items (category_id);
create index content_items_author_id_idx on public.content_items (author_id);
create index content_items_cover_media_id_idx on public.content_items (cover_media_id);
create index content_items_reviewed_by_idx on public.content_items (reviewed_by);
create index content_items_file_path_idx
  on public.content_items (file_path) where file_path is not null;
create index content_items_updated_at_idx on public.content_items (updated_at desc);
create index content_items_search_idx on public.content_items using gin (search_vector);

create or replace function private.content_items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  text_changed boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then
    -- The /go/ endpoint only bumps click_count; that must not look like an edit.
    if new.click_count is distinct from old.click_count
       and (to_jsonb(new) - 'click_count') = (to_jsonb(old) - 'click_count') then
      return new;
    end if;

    new.updated_at := now();
    text_changed := new.title is distinct from old.title
      or new.excerpt is distinct from old.excerpt
      or new.body is distinct from old.body
      or new.keywords is distinct from old.keywords;
  end if;

  if text_changed then
    new.search_vector :=
      setweight(to_tsvector('english'::regconfig, coalesce(new.title, '')), 'A')
      || setweight(to_tsvector('english'::regconfig,
           coalesce(new.excerpt, '') || ' ' || array_to_string(new.keywords, ' ')), 'B')
      || setweight(to_tsvector('english'::regconfig, coalesce(new.body, '')), 'C');
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

revoke all on function private.content_items_before_write() from public;

create trigger content_items_before_write
  before insert or update on public.content_items
  for each row execute function private.content_items_before_write();

create table public.content_tags (
  content_id uuid not null references public.content_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (content_id, tag_id)
);

create index content_tags_tag_id_idx on public.content_tags (tag_id);

-- -----------------------------------------------------------------------------
-- Custom short links served from /go/[slug]
-- -----------------------------------------------------------------------------
create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  destination_url text not null
    check (destination_url ~ '^https?://' and char_length(destination_url) <= 2000),
  is_active boolean not null default true,
  click_count bigint not null default 0,
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger redirects_set_updated_at
  before update of slug, destination_url, is_active, notes on public.redirects
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.media enable row level security;
alter table public.content_items enable row level security;
alter table public.content_tags enable row level security;
alter table public.redirects enable row level security;

-- Profiles ---------------------------------------------------------------------
create policy "Profiles: read own, admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Profiles: public reads authors and reviewers of published content"
  on public.profiles for select to anon, authenticated
  using (
    exists (
      select 1
      from public.content_items c
      where c.status = 'published'
        and (c.author_id = profiles.id or c.reviewed_by = profiles.id)
    )
  );

-- Column grants below restrict this to display_name and bio (never role).
create policy "Profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Categories and tags are public metadata ---------------------------------------
create policy "Categories: public read"
  on public.categories for select to anon, authenticated using (true);
create policy "Categories: admin insert"
  on public.categories for insert to authenticated with check ((select private.is_admin()));
create policy "Categories: admin update"
  on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Categories: admin delete"
  on public.categories for delete to authenticated using ((select private.is_admin()));

create policy "Tags: public read"
  on public.tags for select to anon, authenticated using (true);
create policy "Tags: admin insert"
  on public.tags for insert to authenticated with check ((select private.is_admin()));
create policy "Tags: admin update"
  on public.tags for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Tags: admin delete"
  on public.tags for delete to authenticated using ((select private.is_admin()));

-- Content ---------------------------------------------------------------------
create policy "Content: public reads published"
  on public.content_items for select to anon, authenticated
  using (status = 'published');
create policy "Content: admin reads all"
  on public.content_items for select to authenticated using ((select private.is_admin()));
create policy "Content: admin insert"
  on public.content_items for insert to authenticated with check ((select private.is_admin()));
create policy "Content: admin update"
  on public.content_items for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Content: admin delete"
  on public.content_items for delete to authenticated using ((select private.is_admin()));

create policy "Content tags: public reads tags of published content"
  on public.content_tags for select to anon, authenticated
  using (
    exists (
      select 1 from public.content_items c
      where c.id = content_tags.content_id and c.status = 'published'
    )
  );
create policy "Content tags: admin reads all"
  on public.content_tags for select to authenticated using ((select private.is_admin()));
create policy "Content tags: admin insert"
  on public.content_tags for insert to authenticated with check ((select private.is_admin()));
create policy "Content tags: admin delete"
  on public.content_tags for delete to authenticated using ((select private.is_admin()));

-- Media -----------------------------------------------------------------------
create policy "Media: public reads covers of published content"
  on public.media for select to anon, authenticated
  using (
    exists (
      select 1 from public.content_items c
      where c.cover_media_id = media.id and c.status = 'published'
    )
  );
create policy "Media: admin reads all"
  on public.media for select to authenticated using ((select private.is_admin()));
create policy "Media: admin insert"
  on public.media for insert to authenticated with check ((select private.is_admin()));
create policy "Media: admin update"
  on public.media for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Media: admin delete"
  on public.media for delete to authenticated using ((select private.is_admin()));

-- Redirects (resolved publicly only through public.resolve_go_link) ------------
create policy "Redirects: admin read"
  on public.redirects for select to authenticated using ((select private.is_admin()));
create policy "Redirects: admin insert"
  on public.redirects for insert to authenticated with check ((select private.is_admin()));
create policy "Redirects: admin update"
  on public.redirects for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Redirects: admin delete"
  on public.redirects for delete to authenticated using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Grants (Data API access). RLS above still filters every row.
-- -----------------------------------------------------------------------------
grant select on public.categories, public.tags, public.media,
  public.content_items, public.content_tags to anon, authenticated;
grant select (id, display_name, bio) on public.profiles to anon;
grant select on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;

grant insert, update, delete on public.categories, public.tags, public.media,
  public.content_items to authenticated;
grant insert, delete on public.content_tags to authenticated;
grant select, insert, update, delete on public.redirects to authenticated;

grant select, insert, update, delete on public.profiles, public.categories, public.tags,
  public.media, public.content_items, public.content_tags, public.redirects to service_role;

-- -----------------------------------------------------------------------------
-- Full-text search over published content (runs with the caller's RLS)
-- -----------------------------------------------------------------------------
create or replace function public.search_content(
  search_query text,
  content_type text default null,
  result_limit integer default 20
)
returns table (
  id uuid,
  type text,
  title text,
  slug text,
  excerpt text,
  published_at timestamptz,
  updated_at timestamptz,
  category_name text,
  category_slug text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      websearch_to_tsquery('english'::regconfig, left(trim(coalesce(search_query, '')), 200)) as tsq,
      '%' || replace(replace(replace(left(trim(coalesce(search_query, '')), 200),
        '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select
    c.id,
    c.type,
    c.title,
    c.slug,
    c.excerpt,
    c.published_at,
    c.updated_at,
    cat.name,
    cat.slug,
    ts_rank_cd(c.search_vector, p.tsq) as rank
  from public.content_items c
  cross join params p
  left join public.categories cat on cat.id = c.category_id
  where c.status = 'published'
    and char_length(trim(coalesce(search_query, ''))) >= 2
    and (content_type is null or c.type = content_type)
    and (c.search_vector @@ p.tsq or c.title ilike p.pattern)
  order by rank desc, c.published_at desc
  limit least(greatest(coalesce(result_limit, 20), 1), 50);
$$;

revoke all on function public.search_content(text, text, integer) from public;
grant execute on function public.search_content(text, text, integer)
  to anon, authenticated, service_role;

-- Published item counts per category and tag (used for listings, sitemap and
-- to keep near-empty taxonomy pages out of the index).
create or replace function public.category_counts()
returns table (category_id uuid, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.category_id, count(*)
  from public.content_items c
  where c.status = 'published' and c.category_id is not null
  group by c.category_id;
$$;

create or replace function public.tag_counts()
returns table (tag_id uuid, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select ct.tag_id, count(*)
  from public.content_tags ct
  join public.content_items c on c.id = ct.content_id
  where c.status = 'published'
  group by ct.tag_id;
$$;

revoke all on function public.category_counts() from public;
revoke all on function public.tag_counts() from public;
grant execute on function public.category_counts() to anon, authenticated, service_role;
grant execute on function public.tag_counts() to anon, authenticated, service_role;

-- Item counts per type and status for the dashboard. Runs with the caller's
-- RLS, so only admins see draft and in-review counts.
create or replace function public.content_status_counts()
returns table (type text, status text, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.type, c.status, count(*)
  from public.content_items c
  group by c.type, c.status;
$$;

revoke all on function public.content_status_counts() from public;
grant execute on function public.content_status_counts() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- /go/[slug] resolver
--
-- SECURITY DEFINER so anonymous visitors can increment click counters without
-- any write access to the tables. It only ever returns the destination of an
-- active redirect or of a published resource/download, which is public anyway.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_go_link(link_slug text)
returns table (link_kind text, link_target text, link_file_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
    with hit as (
      update public.redirects r
         set click_count = r.click_count + 1
       where r.slug = link_slug
         and r.is_active
      returning r.destination_url
    )
    select 'redirect'::text, hit.destination_url, null::text from hit;

  if found then
    return;
  end if;

  return query
    with hit as (
      update public.content_items c
         set click_count = c.click_count + 1
       where c.slug = link_slug
         and c.status = 'published'
         and c.type in ('resource', 'download')
         and (c.file_path is not null or c.external_url is not null)
      returning c.file_path, c.external_url, c.file_name
    )
    select
      case when hit.file_path is not null then 'file' else 'external' end,
      coalesce(hit.file_path, hit.external_url),
      hit.file_name
    from hit;
end;
$$;

revoke all on function public.resolve_go_link(text) from public;
grant execute on function public.resolve_go_link(text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Storage
--   media:     public images (covers and inline images), 5 MB, no SVG.
--   downloads: private files, served through short-lived signed URLs, 50 MB.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('downloads', 'downloads', false, 52428800, null)
on conflict (id) do nothing;

create policy "Media bucket: admins manage files"
  on storage.objects for all to authenticated
  using (bucket_id = 'media' and (select private.is_admin()))
  with check (bucket_id = 'media' and (select private.is_admin()));

create policy "Downloads bucket: admins manage files"
  on storage.objects for all to authenticated
  using (bucket_id = 'downloads' and (select private.is_admin()))
  with check (bucket_id = 'downloads' and (select private.is_admin()));

-- Lets the public (anon key) create signed URLs only for files attached to
-- published downloads. Draft files stay private.
create policy "Downloads bucket: public reads files of published downloads"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'downloads'
    and exists (
      select 1
      from public.content_items c
      where c.file_path = objects.name
        and c.type = 'download'
        and c.status = 'published'
    )
  );

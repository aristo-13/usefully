-- Images and video on posts.
--
--   * Every post can have a cover image, uploaded to the media library
--     (cover_media_id, as before) or linked from another site (cover_image_url).
--   * Downloads can show the app's icon (icon_url).
--   * Resources can feature a video (video_url): YouTube, Vimeo or a video file.
--
-- Uploaded icons and videos live in the media library and are referenced by
-- their public URL. content_items therefore keeps a single foreign key to
-- media, so existing API queries that embed the cover stay unambiguous.
-- Everything here is additive: it is safe to apply before deploying the code
-- that uses it. Links are checked like the other URL columns; the app also
-- requires https for anything that is not in the site's own media library.

-- Media library: also accept MP4 and WebM videos. The bucket allows 50 MB per
-- file; the app still limits images to 5 MB.
alter table public.media drop constraint media_mime_type_check;
alter table public.media add constraint media_mime_type_check check (
  mime_type in (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm'
  )
);

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm'
  ]
where id = 'media';

-- Posts ------------------------------------------------------------------------
alter table public.content_items
  add column cover_image_url text
    constraint content_items_cover_image_url_check
    check (cover_image_url ~ '^https?://' and char_length(cover_image_url) <= 2000),
  add column cover_alt text
    constraint content_items_cover_alt_check check (char_length(cover_alt) <= 300),
  add column icon_url text
    constraint content_items_icon_url_check
    check (icon_url ~ '^https?://' and char_length(icon_url) <= 2000),
  add column video_url text
    constraint content_items_video_url_check
    check (video_url ~ '^https?://' and char_length(video_url) <= 2000),
  add constraint content_items_single_cover
    check (cover_media_id is null or cover_image_url is null),
  add constraint content_items_icon_only_for_downloads
    check (icon_url is null or type = 'download'),
  add constraint content_items_video_only_for_resources
    check (video_url is null or type = 'resource');

comment on column public.content_items.cover_alt is
  'Alt text for the cover image. Falls back to the media library alt text for uploaded covers.';

-- A published resource needs something to show: a website, a video or a photo.
alter table public.content_items drop constraint content_items_resource_requires_url;
alter table public.content_items add constraint content_items_resource_requires_content check (
  type <> 'resource' or status <> 'published'
  or external_url is not null or video_url is not null
  or cover_media_id is not null or cover_image_url is not null
);

-- Search results also carry what a result card displays. The return type
-- changes, so the function is recreated.
drop function public.search_content(text, text, integer, integer);

create function public.search_content(
  search_query text,
  content_type text default null,
  result_limit integer default 20,
  result_offset integer default 0
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
  cover_path text,
  cover_media_alt text,
  cover_width integer,
  cover_height integer,
  cover_image_url text,
  cover_alt text,
  icon_url text,
  video_url text,
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
    m.storage_path,
    m.alt_text,
    m.width,
    m.height,
    c.cover_image_url,
    c.cover_alt,
    c.icon_url,
    c.video_url,
    ts_rank_cd(c.search_vector, p.tsq) as rank
  from public.content_items c
  cross join params p
  left join public.categories cat on cat.id = c.category_id
  left join public.media m on m.id = c.cover_media_id
  where c.status = 'published'
    and char_length(trim(coalesce(search_query, ''))) >= 2
    and (content_type is null or c.type = content_type)
    and (c.search_vector @@ p.tsq or c.title ilike p.pattern)
  -- id makes the order stable, so pages never repeat or skip rows.
  order by rank desc, c.published_at desc, c.id
  limit least(greatest(coalesce(result_limit, 20), 1), 50)
  offset least(greatest(coalesce(result_offset, 0), 0), 10000);
$$;

revoke all on function public.search_content(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_content(text, text, integer, integer)
  to anon, authenticated, service_role;

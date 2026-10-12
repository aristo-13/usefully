-- Adds paging to search_content so results can be loaded a few at a time.
-- A separate migration so it also applies to projects that already ran the
-- initial schema.

drop function if exists public.search_content(text, text, integer);

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
  -- id makes the order stable, so pages never repeat or skip rows.
  order by rank desc, c.published_at desc, c.id
  limit least(greatest(coalesce(result_limit, 20), 1), 50)
  offset least(greatest(coalesce(result_offset, 0), 0), 10000);
$$;

revoke all on function public.search_content(text, text, integer, integer) from public;
grant execute on function public.search_content(text, text, integer, integer)
  to anon, authenticated, service_role;

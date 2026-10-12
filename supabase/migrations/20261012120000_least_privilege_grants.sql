-- Least-privilege grants that do not depend on the project's default privileges.
--
-- Supabase projects created before the Data API change of 2026-10-30 grant ALL
-- privileges on every new table and function in `public` to anon and
-- authenticated. The initial migration added narrow grants on top of those
-- defaults without removing them, which left, among other things,
-- profiles.role updatable by any signed-in account and account roles readable
-- by visitors. This migration revokes the broad grants and re-applies exactly
-- what the site needs. On projects without the legacy defaults it changes
-- nothing. Row Level Security still filters every row on top of these grants.

-- Tables ----------------------------------------------------------------------
revoke all on table
  public.profiles, public.categories, public.tags, public.media,
  public.content_items, public.content_tags, public.redirects
from anon, authenticated;

grant select on public.categories, public.tags, public.media,
  public.content_items, public.content_tags to anon, authenticated;
grant select (id, display_name, bio) on public.profiles to anon;
grant select on public.profiles to authenticated;
-- Editors may change their own name and bio, never their role.
grant update (display_name, bio) on public.profiles to authenticated;

grant insert, update, delete on public.categories, public.tags, public.media,
  public.content_items to authenticated;
grant insert, delete on public.content_tags to authenticated;
grant select, insert, update, delete on public.redirects to authenticated;

-- Functions in the exposed schema ----------------------------------------------
revoke all on function public.content_status_counts() from public, anon, authenticated;
grant execute on function public.content_status_counts() to authenticated, service_role;

revoke all on function public.search_content(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_content(text, text, integer, integer) to anon, authenticated, service_role;

revoke all on function public.resolve_go_link(text) from public, anon, authenticated;
grant execute on function public.resolve_go_link(text) to anon, authenticated, service_role;

revoke all on function public.category_counts() from public, anon, authenticated;
revoke all on function public.tag_counts() from public, anon, authenticated;
grant execute on function public.category_counts() to anon, authenticated, service_role;
grant execute on function public.tag_counts() to anon, authenticated, service_role;

-- Private helpers (not exposed by the API; revoked in case defaults granted them) --
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.content_items_before_write() from public, anon, authenticated;

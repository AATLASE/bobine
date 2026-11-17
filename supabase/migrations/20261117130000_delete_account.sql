-- Account deletion: Profil › « Supprimer mon compte » (decided 2026-11-17).
--
-- What goes for good: the e-mail, the password, every sign-in method and
-- session, the name, the photo, the bio, the devices registered for push, the
-- notifications, the activity logs, and the place in every space.
--
-- What stays, signed « Ancien membre »: the reviews, comments, ideas, photos,
-- episodes, likes and votes left in the group's spaces. Deleting them would tear
-- holes in other people's memories and change the group rating of episodes
-- already revealed.
--
-- How: the auth row is kept as an empty shell (same id, no e-mail, no password,
-- no identity, no session, banned, deleted_at set: GoTrue's own "soft delete"),
-- so every row the group keeps still has a valid author and no foreign key has
-- to change. Nothing left in it points to the person.
--
-- Spaces the person owns: handed to another owner if there is one, else to the
-- oldest participant, else to the oldest observer (who becomes owner and
-- participant), with a notification. A space where they were alone is deleted
-- with everything in it.
--
-- Files (the photo, the files of the deleted spaces) cannot be removed from
-- SQL: Storage refuses direct deletes, and removing the rows would leave the
-- files behind. delete_my_account returns their URLs and the app removes them
-- through the Storage API right after, with the same token (the person still
-- owns those objects).

-- 0. Storage: an uploader always sees and can remove their own files ------------
-- Removing a file goes through DELETE … RETURNING, which also needs the file to
-- be visible. Reading was tied to membership of the space only, so as soon as
-- the person had left (account deleted) or the space was gone (useDeleteSpace
-- removes the files after the rows), the removal matched nothing and the files
-- stayed in the bucket. The existing "uploader deletes" rules test `owner`,
-- which newer Storage versions leave empty (they fill `owner_id`, as text):
-- these two use owner_id, filled by every version.
drop policy if exists "episode-media: uploader reads own" on storage.objects;
create policy "episode-media: uploader reads own" on storage.objects
  for select to authenticated
  using (bucket_id = 'episode-media' and owner_id = (select auth.uid())::text);

drop policy if exists "episode-media: uploader removes own" on storage.objects;
create policy "episode-media: uploader removes own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'episode-media' and owner_id = (select auth.uid())::text);

-- 1. What happens to each space the person owns ---------------------------------
create or replace function public.account_deletion_plan(p_user uuid)
returns table (space_id uuid, space_name text, action text, heir uuid, heir_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    case
      when h.user_id is null then 'delete'
      when h.role = 'owner' then 'leave'
      else 'transfer'
    end,
    h.user_id,
    p.name
  from public.space_members me
  join public.spaces s on s.id = me.space_id
  left join lateral (
    select m.user_id, m.role
    from public.space_members m
    where m.space_id = me.space_id and m.user_id <> p_user
    order by
      (m.role = 'owner') desc,
      (m.role = 'member' and coalesce(m.can_create_episodes, false)) desc,
      m.joined_at asc nulls last,
      m.user_id
    limit 1
  ) h on true
  left join public.profiles p on p.id = h.user_id
  where me.user_id = p_user and me.role = 'owner'
$$;

revoke all on function public.account_deletion_plan(uuid) from public, anon, authenticated;

-- 2. What the confirmation dialog shows ----------------------------------------
create or replace function public.account_deletion_preview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('space_name', space_name, 'action', action, 'heir_name', heir_name)
      order by space_name
    ),
    '[]'::jsonb
  )
  from public.account_deletion_plan(auth.uid())
  where action <> 'leave'
$$;

revoke all on function public.account_deletion_preview() from public, anon;
grant execute on function public.account_deletion_preview() to authenticated;

-- 3. The deletion itself, for the signed-in person only -------------------------
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_files text[] := '{}';
  r record;
  t text;
begin
  if v_me is null then
    raise exception 'Connecte-toi pour supprimer ton compte.' using errcode = '42501';
  end if;

  -- A double tap waits for the first call, then finds nothing left to do.
  perform 1 from auth.users where id = v_me and deleted_at is null for update;
  if not found then
    raise exception 'Ce compte est déjà supprimé.' using errcode = '42501';
  end if;

  select v_files || array_remove(array[avatar_url], null) into v_files
  from public.profiles where id = v_me;

  -- Spaces the person owns.
  for r in select * from public.account_deletion_plan(v_me) loop
    if r.action = 'delete' then
      v_files := v_files
        || coalesce((select array_agg(m.url) from public.episode_media m where m.space_id = r.space_id and m.url is not null), '{}')
        || coalesce((select array_agg(e.cover_url) from public.episodes e where e.space_id = r.space_id and e.cover_url is not null), '{}')
        || coalesce((select array_agg(s.cover_url) from public.spaces s where s.id = r.space_id and s.cover_url is not null), '{}');
      delete from public.spaces where id = r.space_id;
    elsif r.action = 'transfer' then
      update public.space_members
      set role = 'owner', can_create_episodes = true
      where space_id = r.space_id and user_id = r.heir;
      update public.spaces set created_by = r.heir where id = r.space_id;
      update public.invite_codes set created_by = r.heir
      where space_id = r.space_id and created_by = v_me;
      insert into public.notifications (user_id, space_id, title, body, url)
      values (
        r.heir,
        r.space_id,
        '👑 « ' || r.space_name || ' » est à toi',
        'Son propriétaire a supprimé son compte : tu gères maintenant l''espace (invitations, réglages, saison).',
        '/'
      );
    end if;
    -- 'leave': another owner is already there, nothing to hand over.
  end loop;

  -- Leave every space. The member triggers reveal the episodes that were only
  -- waiting for this person, and drop their notifications of that space.
  delete from public.space_members where user_id = v_me;

  -- What the group keeps is now signed « Ancien membre ».
  update public.profiles
  set name = 'Ancien membre', avatar_url = null, bio = null, invite_code = null, daily_prompt_enabled = false
  where id = v_me;
  update public.reviews set author_name = 'Ancien membre' where author_id = v_me;
  update public.episode_comments set author_name = 'Ancien membre' where author_id = v_me;

  -- Personal traces. The logs go last: the updates above write some.
  delete from public.notifications where user_id = v_me;
  delete from public.push_subscriptions where user_id = v_me;
  delete from public.daily_prompt_log where user_id = v_me;
  delete from public.review_reminder_log where user_id = v_me;
  delete from public.audit_logs where user_id = v_me;

  -- The account: no way left to sign in, nothing left that points to the person.
  delete from auth.identities where user_id = v_me;
  delete from auth.sessions where user_id = v_me;
  delete from auth.refresh_tokens where user_id = v_me::text;
  delete from auth.mfa_factors where user_id = v_me;
  delete from auth.one_time_tokens where user_id = v_me;
  -- Newer GoTrue tables (passkeys, OAuth grants…): whichever exist here.
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'auth' and c.column_name = 'user_id'
      and c.table_name not in ('identities', 'sessions', 'refresh_tokens', 'mfa_factors', 'one_time_tokens', 'audit_log_entries')
  loop
    begin
      execute format('delete from auth.%I where user_id::text = $1', t) using v_me::text;
    exception when others then
      raise notice 'auth.% non nettoyée : %', t, sqlerrm;
    end;
  end loop;

  update auth.users
  set email = null,
      phone = null,
      encrypted_password = '',
      email_change = '',
      phone_change = '',
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change_token_current = '',
      phone_change_token = '',
      reauthentication_token = '',
      raw_user_meta_data = '{}'::jsonb,
      raw_app_meta_data = '{"provider": "deleted", "providers": []}'::jsonb,
      banned_until = '2999-12-31 00:00:00+00',
      deleted_at = now(),
      updated_at = now()
  where id = v_me;

  return jsonb_build_object('files', to_jsonb(v_files));
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

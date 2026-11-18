-- Rollback of 20261118100000_invite_preview_and_join_notice.
drop function if exists public.invite_preview(text);

create or replace function public.space_members_after_insert_notify() returns trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_space text;
  v_newcomer text;
  v_owner uuid;
  v_user uuid;
  v_url text;
begin
  -- The creator's own row, written by the "create space" flow.
  if coalesce(new.role::text, 'observer') = 'owner' then
    return null;
  end if;

  select s.name into v_space from public.spaces s where s.id = new.space_id;
  v_newcomer := public.display_name(new.user_id);
  v_url := '/space-members/' || new.space_id;

  -- The membership row is the source of truth for who owns the space (it is
  -- what the app reads), with the space's creator as a fallback for rows that
  -- predate it.
  select m.user_id into v_owner
  from public.space_members m
  where m.space_id = new.space_id and coalesce(m.role::text, '') = 'owner'
  limit 1;

  if v_owner is null then
    select s.created_by into v_owner from public.spaces s where s.id = new.space_id;
  end if;

  if v_owner is not null and v_owner is distinct from new.user_id then
    perform public.notify_user(
      v_owner,
      new.space_id,
      format('%s a rejoint « %s »', v_newcomer, coalesce(v_space, 'ton aventure')),
      format(
        '%s est observateur pour l''instant. Autorise-la à participer depuis les membres.',
        v_newcomer
      ),
      v_url
    );
  end if;

  -- The other participants: the news, without the button they do not have.
  for v_user in select public.space_participant_ids(new.space_id) loop
    if v_user is distinct from new.user_id and v_user is distinct from v_owner then
      perform public.notify_user(
        v_user,
        new.space_id,
        format('%s a rejoint « %s »', v_newcomer, coalesce(v_space, 'votre aventure')),
        'Une personne de plus dans l''aventure.',
        v_url
      );
    end if;
  end loop;

  return null;
end $$;
;

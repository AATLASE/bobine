-- Invitation: a real welcome for the person who opens an invite link, and a
-- truthful notification for the owner when somebody joins.
--
-- 1. invite_preview(code): what an invite leads to (space name, who invites,
--    role, how many people), readable before having an account. The invite
--    link used to land on a bare login form that said nothing about the space.
--    Only somebody holding a valid code learns anything, and a code already
--    lets its holder join the space.
-- 2. The "X a rejoint" notification told the owner that the newcomer was an
--    observer to promote, even when they had joined with the participant code.

create or replace function public.invite_preview(p_code text)
  returns table (space_name text, space_type text, role text, inviter_name text, member_count int)
  language sql stable security definer
  set search_path = public
as $$
  select
    s.name,
    s.type,
    c.role::text,
    public.display_name(coalesce(
      (select m.user_id from public.space_members m where m.space_id = s.id and m.role::text = 'owner' limit 1),
      s.created_by
    )),
    (select count(*)::int from public.space_members m where m.space_id = s.id)
  from public.invite_codes c
  join public.spaces s on s.id = c.space_id
  where length(btrim(coalesce(p_code, ''))) >= 6
    and upper(c.code) = upper(btrim(p_code))
  limit 1;
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- The owner's notification now says what the newcomer's role really is.
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
      case when new.role::text = 'member'
        then format('%s participe : ses reviews comptent pour la révélation des prochains épisodes.', v_newcomer)
        else format('%s suit l''aventure en observateur. Tu peux lui ouvrir la participation depuis les membres.', v_newcomer)
      end,
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

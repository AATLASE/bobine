-- Quitter une aventure : n'importe qui (propriétaire, participant, observateur)
-- peut partir de lui-même, depuis les membres ou les paramètres (décidé le
-- 2026-11-20).
--
-- Ce qui reste : ses épisodes, photos, reviews, commentaires, idées et votes.
-- Les retirer ferait des trous dans les souvenirs des autres. Supprimer la ligne
-- de membre déclenche les triggers existants : les épisodes qui n'attendaient
-- plus que sa review sont révélés, et ses notifications de l'aventure partent.
--
-- Le propriétaire qui part : même règle que la suppression de compte. La
-- propriété passe à un autre propriétaire s'il y en a un, sinon au participant
-- le plus ancien, sinon à l'observateur le plus ancien (qui devient propriétaire
-- et participant). S'il était seul, l'aventure est supprimée avec tout son
-- contenu ; la fonction renvoie les URL des fichiers et l'app les retire du
-- Storage juste après (Storage refuse les suppressions en SQL).
--
-- Notifications : le ou les propriétaires restants reçoivent le message
-- détaillé (l'héritier apprend en plus que l'aventure est à lui), les autres
-- participants un message court. Les observateurs ne sont pas prévenus.
-- Un membre retiré par le propriétaire (« Retirer ») ne déclenche rien : seule
-- cette fonction notifie.
--
-- Retour arrière : supabase/rollbacks/20261120100000_leave_space.sql

-- 1. Ce qui se passe quand une personne quitte une aventure ----------------------
create or replace function public.leave_space_plan(p_space_id uuid, p_user uuid)
returns table (my_role text, action text, heir uuid, heir_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    me.role::text,
    case
      when me.role::text <> 'owner' then 'leave'
      when h.user_id is null then 'delete'
      when h.role::text = 'owner' then 'leave'
      else 'transfer'
    end,
    case when me.role::text = 'owner' and h.role::text <> 'owner' then h.user_id end,
    case when me.role::text = 'owner' and h.role::text <> 'owner' then p.name end
  from public.space_members me
  left join lateral (
    select m.user_id, m.role
    from public.space_members m
    where m.space_id = me.space_id and m.user_id <> p_user
    order by
      (m.role::text = 'owner') desc,
      (m.role::text = 'member' and coalesce(m.can_create_episodes, false)) desc,
      m.joined_at asc nulls last,
      m.user_id
    limit 1
  ) h on true
  left join public.profiles p on p.id = h.user_id
  where me.space_id = p_space_id and me.user_id = p_user
$$;

revoke all on function public.leave_space_plan(uuid, uuid) from public, anon, authenticated;

-- 2. Ce que montre la confirmation ------------------------------------------------
create or replace function public.leave_space_preview(p_space_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('action', action, 'heir_name', heir_name)
  from public.leave_space_plan(p_space_id, auth.uid())
$$;

revoke all on function public.leave_space_preview(uuid) from public, anon;
grant execute on function public.leave_space_preview(uuid) to authenticated;

-- 3. Le départ lui-même, pour la personne connectée uniquement -------------------
create or replace function public.leave_space(p_space_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_space text;
  v_name text;
  v_plan record;
  v_files text[] := '{}';
  v_url text := '/space-members/' || p_space_id;
  v_user uuid;
begin
  if v_me is null then
    raise exception 'Connecte-toi pour quitter une aventure.' using errcode = '42501';
  end if;

  -- Un départ à la fois par aventure : deux propriétaires qui partent en même
  -- temps se verraient chacun remplacés par l'autre, et l'aventure resterait
  -- sans propriétaire.
  select s.name into v_space from public.spaces s where s.id = p_space_id for update;
  if not found then
    raise exception 'Cette aventure n''existe plus.' using errcode = 'P0002';
  end if;

  select * into v_plan from public.leave_space_plan(p_space_id, v_me);
  if not found then
    raise exception 'Tu ne fais déjà plus partie de cette aventure.' using errcode = 'P0002';
  end if;

  v_name := public.display_name(v_me);

  -- Seul dans l'aventure : elle part avec lui.
  if v_plan.action = 'delete' then
    v_files := v_files
      || coalesce((select array_agg(m.url) from public.episode_media m where m.space_id = p_space_id and m.url is not null), '{}')
      || coalesce((select array_agg(e.cover_url) from public.episodes e where e.space_id = p_space_id and e.cover_url is not null), '{}')
      || coalesce((select array_agg(s.cover_url) from public.spaces s where s.id = p_space_id and s.cover_url is not null), '{}');
    delete from public.spaces where id = p_space_id;
    perform public.log_event('space_left', null, jsonb_build_object('action', 'delete', 'space_name', v_space));
    return jsonb_build_object('action', 'delete', 'heir_name', null, 'files', to_jsonb(v_files));
  end if;

  if v_plan.action = 'transfer' then
    update public.space_members
    set role = 'owner', can_create_episodes = true
    where space_id = p_space_id and user_id = v_plan.heir;
    update public.spaces set created_by = v_plan.heir where id = p_space_id;
    update public.invite_codes set created_by = v_plan.heir
    where space_id = p_space_id and created_by = v_me;
  end if;

  -- Le départ. Les triggers révèlent les épisodes qui n'attendaient plus que
  -- cette personne et effacent ses notifications de l'aventure.
  delete from public.space_members where space_id = p_space_id and user_id = v_me;

  -- Le ou les propriétaires : le message détaillé.
  for v_user in
    select m.user_id from public.space_members m
    where m.space_id = p_space_id and m.role::text = 'owner'
  loop
    perform public.notify_user(
      v_user,
      p_space_id,
      format('🚪 Départ de %s', v_name),
      case
        when v_user = v_plan.heir
          then format('%s a quitté « %s » : l''aventure est maintenant à toi (invitations, réglages, saison).', v_name, coalesce(v_space, 'ton aventure'))
        else format('%s a quitté « %s ». Ses épisodes, photos et reviews restent dans l''aventure.', v_name, coalesce(v_space, 'ton aventure'))
      end,
      v_url
    );
  end loop;

  -- Les autres participants : la nouvelle, en court.
  for v_user in select public.space_participant_ids(p_space_id) loop
    if not exists (
      select 1 from public.space_members m
      where m.space_id = p_space_id and m.user_id = v_user and m.role::text = 'owner'
    ) then
      perform public.notify_user(
        v_user,
        p_space_id,
        format('🚪 Départ de %s', v_name),
        format('%s a quitté « %s ».', v_name, coalesce(v_space, 'votre aventure')),
        v_url
      );
    end if;
  end loop;

  perform public.log_event('space_left', p_space_id, jsonb_build_object('action', v_plan.action, 'role', v_plan.my_role));

  return jsonb_build_object('action', v_plan.action, 'heir_name', v_plan.heir_name, 'files', '[]'::jsonb);
end $$;

revoke all on function public.leave_space(uuid) from public, anon;
grant execute on function public.leave_space(uuid) to authenticated;

-- « Qui était là ? » : an episode no longer waits for people who were not there.
--
-- Before: an episode revealed once EVERY participant of the space had written
-- a review. Someone who missed the outing, or who joined the space after it,
-- was asked for a review anyway and blocked the reveal for everybody.
--
-- Now a participant can be marked absent from one episode:
--   - by the creator, when the episode is created ("Qui était là ?");
--   - by themselves ("Je n'y étais pas"), and back ("En fait, j'y étais");
--   - by the episode's creator or the space owner, for a no-show;
--   - automatically for the episodes still sealed when somebody becomes a
--     participant: they were not in the group when these happened.
-- Absences are stored rather than presences, so every existing episode keeps
-- meaning "everybody was there" with no backfill.
--
-- The reveal, the reminders and the "new episode" notification follow.

-- 1. Table ------------------------------------------------------------------

create table if not exists public.episode_absences (
  episode_id uuid not null references public.episodes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (episode_id, user_id)
);
create index if not exists episode_absences_space_idx on public.episode_absences (space_id);

alter table public.episode_absences enable row level security;

-- Members read them (the cards say "2/3", the episode lists who is absent).
-- Nobody writes directly: set_episode_absence checks who may.
drop policy if exists "episode_absences_select_member" on public.episode_absences;
create policy "episode_absences_select_member" on public.episode_absences
  for select to authenticated
  using (public.my_space_role(space_id) is not null);

revoke all on public.episode_absences from anon, authenticated;
grant select on public.episode_absences to authenticated;

-- 2. Reveal: everybody who was there has written ----------------------------

create or replace function public.reveal_episode_reviews_if_complete(p_episode_id uuid) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_space uuid;
begin
  -- Locking the row makes concurrent last reviews take turns: the second one
  -- waits here, then its next statements see the first one's committed review.
  -- Nothing to do for an unknown episode, or one already revealed: the stamp is
  -- written once and never moves.
  select e.space_id into v_space
  from public.episodes e
  where e.id = p_episode_id and e.reviews_revealed_at is null
  for update;
  if v_space is null then
    return;
  end if;

  -- A space with no participants at all would otherwise "complete" with zero
  -- reviews and reveal an empty episode.
  if not exists (select 1 from public.reviews r where r.episode_id = p_episode_id) then
    return;
  end if;

  if exists (
    select 1
    from public.space_members m
    where m.space_id = v_space
      and (m.role = 'owner' or (m.role = 'member' and coalesce(m.can_create_episodes, false)))
      and not exists (
        select 1
        from public.episode_absences a
        where a.episode_id = p_episode_id
          and a.user_id = m.user_id
      )
      and not exists (
        select 1
        from public.reviews r
        where r.episode_id = p_episode_id
          and r.author_id = m.user_id
      )
  ) then
    return; -- somebody who was there still has to write
  end if;

  update public.episodes
  set reviews_revealed_at = now()
  where id = p_episode_id and reviews_revealed_at is null;
end $$;

-- 3. Marking somebody absent, or present again -------------------------------

create or replace function public.set_episode_absence(p_episode_id uuid, p_user_id uuid, p_absent boolean) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  ep record;
begin
  select e.id, e.space_id, e.created_by, e.reviews_revealed_at into ep
  from public.episodes e where e.id = p_episode_id;
  if not found then
    raise exception 'Épisode introuvable.' using errcode = 'P0002';
  end if;
  if public.my_space_role(ep.space_id) is null then
    raise exception 'Tu ne fais pas partie de cet espace.' using errcode = '42501';
  end if;
  -- For yourself always; for somebody else, the episode's creator or the owner.
  if p_user_id is distinct from auth.uid()
     and ep.created_by is distinct from auth.uid()
     and not public.is_space_owner(ep.space_id) then
    raise exception 'Seuls le créateur de l''épisode et le propriétaire peuvent indiquer qui était là.' using errcode = '42501';
  end if;
  -- Once revealed, who was expected no longer changes anything.
  if ep.reviews_revealed_at is not null then
    return;
  end if;

  if p_absent then
    -- Only participants are ever expected, so only they can be absent.
    if not exists (select 1 from public.space_participant_ids(ep.space_id) as p(id) where p.id = p_user_id) then
      return;
    end if;
    insert into public.episode_absences (episode_id, user_id, space_id)
    values (p_episode_id, p_user_id, ep.space_id)
    on conflict do nothing;
    -- The absent person may have been the last one awaited.
    perform public.reveal_episode_reviews_if_complete(p_episode_id);
  else
    delete from public.episode_absences a
    where a.episode_id = p_episode_id and a.user_id = p_user_id;
  end if;
end $$;

revoke all on function public.set_episode_absence(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_episode_absence(uuid, uuid, boolean) to authenticated;

-- 4. Newcomers are not awaited on what happened before them ------------------

create or replace function public.space_members_after_join_mark_absent() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_now boolean := new.role = 'owner' or (new.role = 'member' and coalesce(new.can_create_episodes, false));
  v_before boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_before := old.role = 'owner' or (old.role = 'member' and coalesce(old.can_create_episodes, false));
  end if;
  if v_now and not v_before then
    insert into public.episode_absences (episode_id, user_id, space_id)
    select e.id, new.user_id, e.space_id
    from public.episodes e
    where e.space_id = new.space_id
      and e.reviews_revealed_at is null
      and not exists (select 1 from public.reviews r where r.episode_id = e.id and r.author_id = new.user_id)
    on conflict do nothing;
  end if;
  return null;
end $$;

drop trigger if exists space_members_mark_absent on public.space_members;
create trigger space_members_mark_absent
  after insert or update of role, can_create_episodes on public.space_members
  for each row execute function public.space_members_after_join_mark_absent();

-- 5. "New episode": true for somebody who was not there too -------------------

create or replace function public.episodes_after_insert_notify() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_space text;
  v_author text;
  v_user uuid;
begin
  select s.name into v_space from public.spaces s where s.id = new.space_id;
  v_author := public.display_name(new.created_by);

  for v_user in select public.space_participant_ids(new.space_id) loop
    -- The person who just pressed "Créer" knows.
    if v_user is distinct from new.created_by then
      perform public.notify_user(
        v_user,
        new.space_id,
        format('Nouvel épisode : « %s »', new.title),
        -- Who was there is recorded right after the insert: this text has to
        -- hold for an absent participant as well.
        format('%s vient de l''ajouter dans « %s ». Si tu y étais, à toi d''écrire ta review.', v_author, coalesce(v_space, 'votre aventure')),
        '/episode/' || new.id
      );
    end if;
  end loop;

  return null;
end $$;

-- 6. Reminders skip the absent -------------------------------------------------
-- send_review_reminders as in 20261029040200, with one more condition on who
-- is still awaited.

create or replace function public.send_review_reminders(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_delay int;
  v_max int;
  v_window int;
  v_quiet_start int;
  v_quiet_end int;
  v_hour int;
  v_awake boolean;
  v_sent int := 0;
  rec record;
  v_due timestamptz;
  v_no int;
  v_names text[];
  v_who text;
  v_last boolean;
begin
  v_delay := public.app_setting_int('review_reminder_delay_minutes', 90, 1, 10080);
  v_max := public.app_setting_int('review_reminder_max', 2, 0, 10);
  v_window := public.app_setting_int('review_reminder_window_hours', 168, 1, 8760);
  v_quiet_start := public.app_setting_int('review_reminder_quiet_start', 22, 0, 23);
  v_quiet_end := public.app_setting_int('review_reminder_quiet_end', 8, 0, 23);

  -- Éteint volontairement.
  if v_max <= 0 then
    return 0;
  end if;

  v_tz := public.notification_timezone();
  v_hour := extract(hour from now() at time zone v_tz)::int;

  -- Deux bornes égales : personne ne dort, tout part à l'heure dite.
  if v_quiet_start = v_quiet_end then
    v_awake := true;
  elsif v_quiet_end < v_quiet_start then
    -- La nuit ordinaire, 22h → 8h : elle enjambe minuit.
    v_awake := v_hour >= v_quiet_end and v_hour < v_quiet_start;
  else
    -- Une pause en plein jour, si quelqu'un y tient.
    v_awake := v_hour >= v_quiet_end or v_hour < v_quiet_start;
  end if;

  if not p_force and not v_awake then
    return 0;
  end if;

  for rec in
    with pending as (
      -- Les participants (même règle que space_participant_ids) qui n'ont pas
      -- encore publié, sur un épisode encore scellé où quelqu'un a déjà répondu.
      select
        e.id as episode_id,
        e.space_id,
        e.title,
        m.user_id
      from public.episodes e
      join public.space_members m
        on m.space_id = e.space_id
       and (
         coalesce(m.role::text, 'observer') = 'owner'
         or (coalesce(m.role::text, 'observer') = 'member' and coalesce(m.can_create_episodes, false))
       )
      where e.reviews_revealed_at is null
        and not exists (
          select 1 from public.episode_absences a
          where a.episode_id = e.id and a.user_id = m.user_id
        )
        and not exists (
          select 1 from public.reviews r
          where r.episode_id = e.id and r.author_id = m.user_id
        )
    )
    select
      p.episode_id,
      p.space_id,
      p.title,
      p.user_id,
      (select max(r.created_at) from public.reviews r where r.episode_id = p.episode_id) as last_review_at,
      (select count(*) from public.review_reminder_log l
        where l.episode_id = p.episode_id and l.user_id = p.user_id) as sent_so_far,
      (select max(l.sent_at) from public.review_reminder_log l
        where l.episode_id = p.episode_id and l.user_id = p.user_id) as last_reminder_at
    from pending p
  loop
    -- Aucune review encore : rien ne s'est passé dont on puisse relancer.
    if rec.last_review_at is null then
      continue;
    end if;

    -- Trop vieux : l'épisode ne se remplira plus, on ne le poursuit pas.
    if rec.last_review_at < now() - make_interval(hours => v_window) then
      continue;
    end if;

    if rec.sent_so_far >= v_max then
      continue;
    end if;

    -- greatest() ignore les NULL : avant la première relance, l'échéance ne
    -- dépend que de la dernière review.
    v_due := greatest(rec.last_review_at, rec.last_reminder_at) + make_interval(mins => v_delay);
    if now() < v_due then
      continue;
    end if;

    v_no := rec.sent_so_far + 1;

    -- La ligne d'abord : c'est elle qui donne le droit d'envoyer. Si une autre
    -- exécution l'a déjà écrite, elle a déjà envoyé.
    insert into public.review_reminder_log (episode_id, user_id, reminder_no)
    values (rec.episode_id, rec.user_id, v_no)
    on conflict do nothing;

    if not found then
      continue;
    end if;

    -- Qui a déjà répondu, dit comme on le dirait à voix haute.
    select array_agg(public.display_name(r.author_id) order by r.created_at)
      into v_names
    from public.reviews r
    where r.episode_id = rec.episode_id;

    v_who := case
      when v_names is null or array_length(v_names, 1) is null then null
      when array_length(v_names, 1) = 1 then format('%s a déjà écrit la sienne.', v_names[1])
      when array_length(v_names, 1) = 2 then format('%s et %s ont déjà écrit la leur.', v_names[1], v_names[2])
      else format('%s, %s et %s autres ont déjà écrit la leur.', v_names[1], v_names[2], array_length(v_names, 1) - 2)
    end;

    v_last := v_no >= v_max;

    perform public.notify_user(
      rec.user_id,
      rec.space_id,
      case
        when v_last then format('Dernier rappel : ta review sur « %s »', rec.title)
        else format('Il manque ta review sur « %s »', rec.title)
      end,
      trim(both ' ' from concat_ws(
        ' ',
        v_who,
        'Personne ne peut lire les autres tant que la tienne manque.',
        case when v_last then 'Promis, on n''en reparle plus.' else null end
      )),
      '/review/' || rec.episode_id
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end $$;


-- Rollback of 20261119130000_short_notification_texts.sql: the texts as they were before.

-- Review publiée (from 20261029110000_reveal_for_everyone.sql)

create or replace function public.reviews_after_insert_notify() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  ep record;
  v_author text;
  v_user uuid;
begin
  select e.id, e.title, e.space_id, e.reviews_revealed_at into ep
  from public.episodes e where e.id = new.episode_id;
  if not found then
    return null;
  end if;

  -- This review revealed the episode (the stamp is this transaction's now()):
  -- "C'est révélé" is already on its way. A late review on an episode revealed
  -- earlier by the owner is still announced.
  if ep.reviews_revealed_at = now() then
    return null;
  end if;

  v_author := public.display_name(new.author_id);

  for v_user in select public.space_participant_ids(ep.space_id) loop
    if v_user is distinct from new.author_id then
      perform public.notify_user(
        v_user,
        ep.space_id,
        format('%s a publié sa review', v_author),
        format('Sur l''épisode « %s ».', ep.title),
        '/episode/' || ep.id
      );
    end if;
  end loop;

  return null;
end $$;

-- Révélation (from 20261029110000_reveal_for_everyone.sql)

create or replace function public.episodes_after_reveal_notify() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_space text;
  v_user uuid;
  v_closer uuid;
begin
  select s.name into v_space from public.spaces s where s.id = new.space_id;

  -- The review inserted in this same transaction is the one that completed the
  -- episode. None when the owner pressed "Révéler maintenant" or a role change
  -- did it: then everybody gets the common text.
  select r.author_id into v_closer
  from public.reviews r
  where r.episode_id = new.id and r.created_at = now()
  limit 1;

  for v_user in select public.space_participant_ids(new.space_id) loop
    perform public.notify_user(
      v_user,
      new.space_id,
      '🔓 C''est révélé !',
      case
        when v_user = v_closer then format('Tu as fermé la marche : tout est révélé sur « %s ».', new.title)
        else format('Les reviews de « %s » sont tombées.', new.title)
      end,
      '/episode/' || new.id
    );
  end loop;

  for v_user in select public.space_observer_ids(new.space_id) loop
    perform public.notify_user(
      v_user,
      new.space_id,
      format('Un nouvel épisode de l''aventure « %s » est disponible', coalesce(v_space, 'votre aventure')),
      format('« %s » — les reviews viennent d''être révélées.', new.title),
      '/episode/' || new.id
    );
  end loop;

  return null;
end $$;

-- Nouvel épisode (from 20261117140000_episode_absences.sql)

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

-- Arrivée dans une aventure (from 20261118100000_invite_preview_and_join_notice.sql)

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

-- Commentaires, réponses, mentions (from 20261029040000_comment_replies_and_mentions.sql)

create or replace function public.episode_comments_after_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ep record;
  v_author text;
  v_excerpt text;
  v_parent_author uuid;
  v_mentioned uuid[] := coalesce(new.mentions, '{}');
  v_user uuid;
  v_url text;
begin
  select e.id, e.title, e.space_id into ep from public.episodes e where e.id = new.episode_id;
  if not found then
    return null;
  end if;

  v_author := public.display_name(new.author_id);
  v_url := '/episode/' || ep.id;

  -- The comment itself, short enough for a notification banner.
  v_excerpt := btrim(coalesce(new.body, ''));
  if length(v_excerpt) > 140 then
    v_excerpt := left(v_excerpt, 139) || '…';
  end if;

  -- 1. The person being answered.
  if new.parent_id is not null then
    select c.author_id into v_parent_author
    from public.episode_comments c
    where c.id = new.parent_id;

    if v_parent_author is not null and v_parent_author is distinct from new.author_id then
      perform public.notify_user(
        v_parent_author,
        ep.space_id,
        format('%s a répondu à ton commentaire', v_author),
        nullif(v_excerpt, ''),
        v_url
      );
    end if;
  end if;

  -- 2. The people named with "@" — whatever their role. `mentions` has already
  --    been reduced to members of the space by the BEFORE trigger.
  foreach v_user in array v_mentioned loop
    if v_user is distinct from new.author_id and v_user is distinct from v_parent_author then
      perform public.notify_user(
        v_user,
        ep.space_id,
        format('%s t''a mentionné', v_author),
        coalesce(nullif(v_excerpt, ''), format('Sur l''épisode « %s ».', ep.title)),
        v_url
      );
    end if;
  end loop;

  -- 3. Everybody else who takes part in the episode.
  for v_user in select public.space_participant_ids(ep.space_id) loop
    if v_user is distinct from new.author_id
       and v_user is distinct from v_parent_author
       and not (v_user = any (v_mentioned))
    then
      perform public.notify_user(
        v_user,
        ep.space_id,
        format('%s a commenté « %s »', v_author, ep.title),
        nullif(v_excerpt, ''),
        v_url
      );
    end if;
  end loop;

  return null;
end $$;

-- Relances de review (from 20261117140000_episode_absences.sql)

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

-- Rappel de 20 h (from 20261029040100_daily_story_prompt.sql)

create or replace function public.send_daily_story_prompt(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_hour int;
  v_local timestamp;
  v_date date;
  v_sent int := 0;
  rec record;
  v_space text;
  v_url text;
  v_space_id uuid;
begin
  v_tz := coalesce(nullif(btrim(public.app_setting('daily_prompt_timezone')), ''), 'Europe/Paris');
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    raise notice 'fuseau « % » inconnu : Europe/Paris utilisé', v_tz;
    v_tz := 'Europe/Paris';
  end if;

  begin
    v_hour := coalesce(nullif(btrim(public.app_setting('daily_prompt_hour')), ''), '20')::int;
  exception
    when others then
      v_hour := 20;
  end;
  if v_hour < 0 or v_hour > 23 then
    v_hour := 20;
  end if;

  v_local := now() at time zone v_tz;
  v_date := v_local::date;

  -- Le reste des heures de la journée s'arrête ici.
  if not p_force and extract(hour from v_local)::int is distinct from v_hour then
    return 0;
  end if;

  for rec in
    -- Les participants, au sens de space_participant_ids (20260802000000), mais
    -- pris dans l'autre sens : les espaces de chaque personne plutôt que les
    -- personnes de chaque espace.
    with participants as (
      select m.user_id, m.space_id
      from public.space_members m
      where coalesce(m.role::text, 'observer') = 'owner'
         or (coalesce(m.role::text, 'observer') = 'member' and coalesce(m.can_create_episodes, false))
    )
    select
      p.user_id,
      count(*) as space_count,
      (array_agg(p.space_id order by p.space_id))[1] as first_space
    from participants p
    where
      -- L'interrupteur du profil. Une personne sans ligne de profil est traitée
      -- comme quelqu'un qui n'a rien coupé : l'absence n'est pas un refus.
      coalesce(
        (select pr.daily_prompt_enabled from public.profiles pr where pr.id = p.user_id),
        true
      )
      and not exists (
        -- Déjà raconté quelque chose aujourd'hui : on ne le lui redemande pas.
        select 1
        from public.episodes e
        where e.created_by = p.user_id
          and (e.created_at at time zone v_tz)::date = v_date
      )
    group by p.user_id
  loop
    -- C'est cette ligne, et elle seule, qui autorise la notification. Si elle
    -- existe déjà, quelqu'un (ou un autre worker) l'a envoyée avant nous.
    insert into public.daily_prompt_log (user_id, prompt_date)
    values (rec.user_id, v_date)
    on conflict do nothing;

    if not found then
      continue;
    end if;

    if rec.space_count = 1 then
      v_space_id := rec.first_space;
      select s.name into v_space from public.spaces s where s.id = v_space_id;
      v_url := '/create-episode/' || v_space_id;
    else
      -- Plusieurs aventures : le choix lui appartient, on le dépose à l'accueil.
      v_space_id := null;
      v_space := null;
      v_url := '/';
    end if;

    perform public.notify_user(
      rec.user_id,
      v_space_id,
      'Quelque chose à raconter aujourd''hui ?',
      case
        when v_space is not null then
          format('Un moment à garder dans « %s » ? Ajoute l''épisode, chacun écrira sa review.', v_space)
        else
          'Un moment à garder ? Ajoute un épisode dans une de tes aventures.'
      end,
      v_url
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end $$;

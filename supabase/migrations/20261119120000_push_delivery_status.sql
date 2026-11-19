-- Push : savoir ce qui est arrivé à chaque push, rattraper ceux qui se perdent,
-- et pouvoir tester depuis l'app.
--
-- Constat (audit du 2026-11-19) : une review a bien créé sa notification in-app,
-- mais le téléphone n'a pas sonné, et rien ne permettait de savoir pourquoi.
-- L'envoi part de la base par pg_net, une seule fois, sans retour : si la
-- fonction send-push démarre à froid et dépasse le délai (déjà vu le 16/11), si
-- elle répond 500, ou si le destinataire n'a aucun appareil enregistré, la
-- notification reste dans la cloche et le push disparaît sans trace (les
-- réponses de pg_net sont effacées au bout de quelques heures).
--
-- 1. notifications reçoit 4 colonnes que send-push remplit après chaque envoi :
--      push_status   'sent' | 'no_device' | 'failed' | 'skipped' (null = pas encore de réponse)
--      push_detail   le détail lisible (« 1/2 appareils », l'erreur du service…)
--      push_attempts nombre de relances faites par la base
--      push_updated_at
-- 2. Toutes les minutes, push_retry() renvoie les push restés sans réponse ou
--    en échec (3 relances max, pendant 2 h). Il ne relance les « sans réponse »
--    que si send-push écrit bien ses statuts (une réponse vue dans les dernières
--    24 h) : avec l'ancienne version de la fonction, chaque push serait renvoyé
--    trois fois.
-- 3. send_test_push() : le bouton « Tester » du profil. Envoie un push à soi-même
--    et rend l'id de la notification, dont l'app lit ensuite le push_status.
--
-- Ordre de déploiement : la fonction send-push d'abord (elle tolère l'absence
-- des colonnes), cette migration ensuite.

-- 1. Statut de livraison ---------------------------------------------------------

alter table public.notifications
  add column if not exists push_status text,
  add column if not exists push_detail text,
  add column if not exists push_attempts int not null default 0,
  add column if not exists push_updated_at timestamptz;

-- Les relances ne lisent que les notifications récentes sans succès.
create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where push_status is null or push_status = 'failed';

-- 2. Un seul endroit qui poste vers send-push ---------------------------------

create or replace function public.push_post(p_record jsonb) returns boolean
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_url text := public.app_setting('push_function_url');
  v_secret text := public.app_setting('push_webhook_secret');
begin
  -- Pas configuré : la notification in-app existe, rien ne part. État normal.
  if v_url is null or v_secret is null then
    return false;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', p_record),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret),
    -- Un démarrage à froid de la fonction peut dépasser 5 s (20261117120000).
    timeout_milliseconds := 20000
  );
  return true;
exception
  when others then
    raise notice 'push non posté : %', sqlerrm;
    return false;
end $$;

create or replace function public.notifications_after_insert_push() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  perform public.push_post(to_jsonb(new));
  return null;
exception
  when others then
    -- Jamais au point d'empêcher la notification in-app.
    raise notice 'push non envoyé pour la notification % : %', new.id, sqlerrm;
    return null;
end $$;

-- 3. Rattrapage -------------------------------------------------------------------

create or replace function public.push_retry() returns integer
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_row public.notifications;
  v_count int := 0;
  -- send-push écrit-il ses statuts ? Sinon, null ne veut pas dire « perdu ».
  v_reports boolean := exists (
    select 1 from public.notifications
    where push_updated_at > now() - interval '24 hours'
  );
begin
  for v_row in
    select * from public.notifications n
    where n.created_at between now() - interval '2 hours' and now() - interval '90 seconds'
      and n.push_attempts < 3
      and (n.push_status = 'failed' or (n.push_status is null and v_reports))
      -- Une minute au moins entre deux tentatives sur la même notification.
      and (n.push_updated_at is null or n.push_updated_at < now() - interval '1 minute')
      -- Inutile de relancer quelqu'un qui n'a aucun appareil.
      and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id)
    order by n.created_at
    limit 50
    for update skip locked
  loop
    update public.notifications
      set push_attempts = push_attempts + 1, push_updated_at = now()
      where id = v_row.id;
    if public.push_post(to_jsonb(v_row)) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

do $$
begin
  perform cron.unschedule('push-retry');
exception
  when others then
    null; -- pas encore programmé, ou pg_cron absent
end $$;

do $$
begin
  perform cron.schedule('push-retry', '* * * * *', $cron$select public.push_retry();$cron$);
exception
  when others then
    raise notice 'relance des push non programmée (%) : active pg_cron', sqlerrm;
end $$;

-- 4. Bouton « Tester » --------------------------------------------------------------

create or replace function public.send_test_push() returns table (notification_id uuid, devices int)
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_devices int;
begin
  if v_user is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.notifications
    where user_id = v_user and url = '/notifications?test=1' and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'Un test vient de partir, attends quelques secondes.' using errcode = 'P0001';
  end if;

  select count(*) into v_devices from public.push_subscriptions where user_id = v_user;

  insert into public.notifications (user_id, space_id, title, body, url)
  values (v_user, null, '🔔 Test de notification', 'Si tu lis ça sur ton écran, les notifications marchent.', '/notifications?test=1')
  returning id into v_id;

  return query select v_id, v_devices;
end $$;

grant execute on function public.send_test_push() to authenticated;

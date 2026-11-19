-- Rollback of 20261119120000_push_delivery_status.sql.
-- Les colonnes de statut restent (send-push les ignore si elles manquent, et
-- les retirer effacerait l'historique) ; seuls la relance et le test partent.

do $$
begin
  perform cron.unschedule('push-retry');
exception
  when others then null;
end $$;

drop function if exists public.send_test_push();
drop function if exists public.push_retry();

create or replace function public.notifications_after_insert_push() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  v_url := public.app_setting('push_function_url');
  v_secret := public.app_setting('push_webhook_secret');
  if v_url is null or v_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new)),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 20000
  );
  return null;
exception
  when others then
    raise notice 'push non envoyé pour la notification % : %', new.id, sqlerrm;
    return null;
end $$;

drop function if exists public.push_post(jsonb);

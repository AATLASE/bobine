-- Rollback of 20261117120000_push_timeout.sql: back to 5 s.

create or replace function public.notifications_after_insert_push() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_url text;
  v_secret text;
begin
  v_url := public.app_setting('push_function_url');
  v_secret := public.app_setting('push_webhook_secret');

  -- Not configured yet: the notification is written, nothing is sent. This is
  -- the state the app ships in, and it is a working state.
  if v_url is null or v_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', to_jsonb(new)
    ),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return null;
exception
  when others then
    -- pg_net missing, function unreachable, anything: the notification stays.
    raise notice 'push non envoyé pour la notification % : %', new.id, sqlerrm;
    return null;
end $$;


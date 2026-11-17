-- Push: give the push function 20 s instead of 5 to answer.
--
-- On 2026-11-16 at 20:00 (Paris) the three evening reminders all timed out at
-- 5 000 ms on the way to send-push, while the function answers in 0.1 to 0.7 s
-- when it is warm (health check and timed POSTs, 2026-11-17). The likely cause
-- is a cold start after a day without calls. pg_net sends in the background
-- after the commit, so waiting longer slows nothing down for the person who
-- wrote; it only stops the database from hanging up on a function that is
-- still booting. Only the timeout changes.

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
    timeout_milliseconds := 20000
  );

  return null;
exception
  when others then
    -- pg_net missing, function unreachable, anything: the notification stays.
    raise notice 'push non envoyé pour la notification % : %', new.id, sqlerrm;
    return null;
end $$;


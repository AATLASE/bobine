-- Diagnostic push : pourquoi une notification in-app n'a pas sonné sur le téléphone.
--
-- Lecture seule. À coller dans Supabase › SQL Editor, puis exécuter bloc par
-- bloc (sélectionne un bloc, Ctrl+Entrée). Chaque bloc répond à une question.
--
-- La chaîne complète :
--   review ─► trigger reviews_say_published ─► ligne dans notifications (la cloche)
--          ─► trigger notifications_send_push ─► pg_net ─► Edge Function send-push
--          ─► service de push (Apple / Google / Mozilla / Expo) ─► appareil

-- 1. Le push est-il configuré côté base ? (les deux lignes doivent sortir, valeur masquée)
select key, case when key = 'push_webhook_secret' then '•••' || right(value, 4) else value end as value
from public.app_settings
where key in ('push_function_url', 'push_webhook_secret');

-- 2. Le trigger d'envoi est-il en place et actif ? (tgenabled = 'O')
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.notifications'::regclass and not tgisinternal;

-- 3. Qui a des appareils enregistrés ? Une personne absente de cette liste ne
--    peut PAS recevoir de push, quoi qu'il arrive : il faut qu'elle active
--    « Notifications push » dans Profil, sur chaque appareil.
select p.name,
       count(*) as appareils,
       count(*) filter (where s.endpoint like 'https://web.push.apple.com%') as iphone_pwa,
       count(*) filter (where s.endpoint like 'https://fcm.googleapis.com%') as chrome_android,
       count(*) filter (where s.endpoint like 'Expo%') as app_native,
       max(s.created_at) as dernier_enregistrement
from public.push_subscriptions s
left join public.profiles p on p.id = s.user_id
group by p.name
order by p.name;

-- 4. Les 20 dernières notifications, avec le résultat du push quand il est
--    connu (colonnes ajoutées par 20261119120000_push_delivery_status.sql ;
--    si elles n'existent pas encore, retire les trois dernières colonnes).
select n.created_at, p.name as destinataire, n.title,
       (select count(*) from public.push_subscriptions s where s.user_id = n.user_id) as appareils_du_destinataire,
       n.push_status, n.push_detail, n.push_attempts
from public.notifications n
left join public.profiles p on p.id = n.user_id
order by n.created_at desc
limit 20;

-- 5. Ce que pg_net a reçu en réponse de send-push (gardé ~6 h seulement).
--    status_code 200 + content {"sent":0,...,"note":"aucun appareil abonné"} = personne à prévenir
--    status_code 200 + content {"sent":0,"total":1} = le service de push a refusé (voir logs de la fonction)
--    status_code 401 = le secret de la base ne correspond pas à PUSH_WEBHOOK_SECRET
--    timed_out = true / error_msg = la fonction n'a pas répondu (démarrage à froid)
select created, status_code, timed_out, error_msg, left(content, 200) as content
from net._http_response
order by created desc
limit 20;

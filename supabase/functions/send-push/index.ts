/**
 * send-push — turns a row of `notifications` into a notification on a device.
 *
 * Called by the database itself: every insert into `notifications` fires the
 * trigger installed by 20260802010000_push_delivery.sql, which POSTs the new row
 * here. The triggers that decide *who* gets notified live in
 * 20260802000000_notify_members_and_observers.sql; this function only carries
 * the message the last mile.
 *
 * Two transports, told apart by the shape of `endpoint`:
 *
 *   • an https:// URL   → Web Push (RFC 8291). This is what the PWA deployed on
 *                         Vercel uses, and it is the only one that works in a
 *                         browser. The payload is encrypted for the endpoint
 *                         with the keys the browser handed out (p256dh/auth) and
 *                         signed with our VAPID key pair.
 *   • ExponentPushToken → a native build registered through Expo.
 *
 * After sending, the outcome is written back on the notification row
 * (push_status / push_detail, 20261119120000_push_delivery_status.sql), so
 * "in-app yes, push no" always has an answer, and the database's push_retry()
 * job knows which pushes to send again.
 *
 * Pushes go out with high priority: at normal priority Android (FCM) and
 * Expo hold them back while the phone sleeps, sometimes for hours.
 *
 * A subscription the push service has retired answers 404 or 410; that endpoint
 * is deleted rather than retried forever. This is the only way the table stays
 * clean — a browser that has forgotten its subscription never tells us.
 *
 * Deployed with --no-verify-jwt, so it authenticates callers itself with a
 * shared secret. Without that check anyone could POST here and push arbitrary
 * text to any user of the app.
 *
 * Environment (supabase secrets set …):
 *   VAPID_PUBLIC_KEY   — same key the web app subscribes with
 *   VAPID_PRIVATE_KEY  — its pair; never leaves the server
 *   VAPID_SUBJECT      — mailto:… or https://… identifying the sender
 *   PUSH_WEBHOOK_SECRET— shared with the database trigger
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 */

import webpush from "npm:web-push@3.6.7";

interface NotificationRow {
  id?: string;
  user_id?: string;
  space_id?: string | null;
  title?: string | null;
  body?: string | null;
  url?: string | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: NotificationRow;
}

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com";
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A browser endpoint is a URL; an Expo token is not. */
const isExpoToken = (endpoint: string): boolean =>
  endpoint.startsWith("ExponentPushToken[") || endpoint.startsWith("ExpoPushToken[");

async function loadSubscriptions(userId: string): Promise<Subscription[]> {
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=id,endpoint,p256dh,auth`;
  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`lecture des abonnements: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as Subscription[];
}

/** Endpoints the push service has retired. Keeping them means retrying forever. */
async function dropSubscriptions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const list = ids.map((id) => `"${id}"`).join(",");
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${list})`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

type Outcome = { result: "sent" | "gone" | "failed"; error?: string };

/** Who delivers for this endpoint, for readable statuses. */
function serviceOf(endpoint: string): string {
  if (isExpoToken(endpoint)) return "expo";
  if (endpoint.includes("push.apple.com")) return "apple";
  if (endpoint.includes("googleapis.com")) return "google";
  if (endpoint.includes("mozilla")) return "mozilla";
  return "web";
}

async function sendWebPush(sub: Subscription, payload: string): Promise<Outcome> {
  if (!sub.p256dh || !sub.auth) return { result: "failed", error: "clés de l'abonnement manquantes" };
  if (!VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY manquant");

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      // "high": delivered right away, even to a phone in standby.
      { TTL: 60 * 60 * 24, urgency: "high" },
    );
    return { result: "sent" };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    const body = (e as { body?: string }).body;
    // 404: the endpoint never existed. 410: the browser dropped it.
    if (status === 404 || status === 410) return { result: "gone" };
    console.error("[send-push] web push refusé:", status, (e as Error).message, body);
    return { result: "failed", error: `${status ?? "?"} ${(body || (e as Error).message || "").slice(0, 120)}`.trim() };
  }
}

async function sendExpoPush(sub: Subscription, row: NotificationRow): Promise<Outcome> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      to: sub.endpoint,
      title: row.title ?? "Bobine",
      body: row.body ?? "",
      sound: "default",
      // Normal priority waits for the phone to wake up on Android.
      priority: "high",
      // The channel created by the app (providers/notifications.tsx).
      channelId: "default",
      data: { url: row.url ?? "/" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[send-push] Expo a répondu", response.status, text);
    return { result: "failed", error: `${response.status} ${text.slice(0, 120)}` };
  }

  const result = (await response.json()) as {
    data?: { status?: string; details?: { error?: string } };
  };
  if (result.data?.status === "error") {
    // The app was uninstalled, or the token belongs to a build that no longer exists.
    if (result.data.details?.error === "DeviceNotRegistered") return { result: "gone" };
    console.error("[send-push] Expo:", JSON.stringify(result.data));
    return { result: "failed", error: result.data.details?.error ?? "erreur Expo" };
  }
  return { result: "sent" };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

async function readCover(table: "episodes" | "spaces", id: string): Promise<string | undefined> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=cover_url`, {
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) return undefined;
  const rows = (await response.json()) as { cover_url?: string | null }[];
  const url = rows[0]?.cover_url ?? undefined;
  // Videos and odd values would leave an empty frame in the notification.
  return url && url.startsWith("https://") && IMAGE_FILE.test(url) ? url : undefined;
}

/**
 * The photo shown large in the notification: the episode's cover when the
 * notification is about an episode (or its review), else the space's cover.
 * Best-effort: no photo is better than no push.
 */
async function coverFor(row: NotificationRow): Promise<string | undefined> {
  try {
    const episode = new RegExp(`^/(?:episode|review)/(${UUID})`, "i").exec(row.url ?? "");
    if (episode) {
      const cover = await readCover("episodes", episode[1]);
      if (cover) return cover;
    }
    if (row.space_id) return await readCover("spaces", row.space_id);
  } catch (e) {
    console.error("[send-push] couverture introuvable:", (e as Error).message);
  }
  return undefined;
}

type PushStatus = "sent" | "no_device" | "failed" | "skipped";

/**
 * Writes what happened on the notification row. Best-effort: before the
 * migration that adds the columns, PostgREST refuses the update and the push
 * itself is not affected.
 */
async function reportStatus(id: string | undefined, status: PushStatus, detail: string): Promise<void> {
  if (!id) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        push_status: status,
        push_detail: detail.slice(0, 500),
        push_updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) console.error("[send-push] statut non enregistré:", response.status, await response.text());
  } catch (e) {
    console.error("[send-push] statut non enregistré:", (e as Error).message);
  }
}

/** Constant-time comparison, so response timing says nothing about the secret. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET) {
    return json(500, { error: "PUSH_WEBHOOK_SECRET n'est pas configuré" });
  }
  // Without this check the function is an open relay for push notifications.
  if (!sameSecret(req.headers.get("x-push-secret") ?? "", WEBHOOK_SECRET)) {
    return json(401, { error: "secret invalide" });
  }

  // A plain GET is a health check: it says whether the keys are in place
  // without sending anything to anybody.
  if (req.method === "GET") {
    return json(200, {
      ok: true,
      vapid: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
      serviceRole: Boolean(SERVICE_ROLE_KEY),
    });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json(400, { error: "corps illisible" });
  }

  const row = payload.record;
  if (!row?.user_id) return json(200, { skipped: "pas de destinataire" });
  if (!row.title && !row.body) {
    await reportStatus(row.id, "skipped", "notification vide");
    return json(200, { skipped: "notification vide" });
  }

  let subscriptions: Subscription[];
  try {
    subscriptions = await loadSubscriptions(row.user_id);
  } catch (e) {
    console.error("[send-push]", (e as Error).message);
    await reportStatus(row.id, "failed", `lecture des abonnements : ${(e as Error).message}`);
    return json(500, { error: (e as Error).message });
  }
  if (subscriptions.length === 0) {
    await reportStatus(row.id, "no_device", "aucun appareil enregistré pour ce compte");
    return json(200, { sent: 0, note: "aucun appareil abonné" });
  }

  const webPayload = JSON.stringify({
    title: row.title ?? "Bobine",
    body: row.body ?? "",
    url: row.url ?? "/",
    tag: row.url ?? undefined,
    image: await coverFor(row),
  });

  const dead: string[] = [];
  const errors: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      const service = serviceOf(sub.endpoint);
      try {
        const outcome = isExpoToken(sub.endpoint)
          ? await sendExpoPush(sub, row)
          : await sendWebPush(sub, webPayload);
        if (outcome.result === "sent") sent += 1;
        if (outcome.result === "gone") {
          dead.push(sub.id);
          errors.push(`${service}: abonnement expiré, supprimé`);
        }
        if (outcome.result === "failed") errors.push(`${service}: ${outcome.error ?? "échec"}`);
      } catch (e) {
        // One broken device must not stop the others.
        console.error("[send-push] envoi impossible:", (e as Error).message);
        errors.push(`${service}: ${(e as Error).message}`);
      }
    }),
  );

  await dropSubscriptions(dead);

  const live = subscriptions.length - dead.length;
  const detail = [`${sent}/${subscriptions.length} appareil(s)`, ...errors].join(" · ");
  // Every device expired: the person has to switch push on again, a retry changes nothing.
  const status: PushStatus = sent > 0 ? "sent" : live === 0 ? "no_device" : "failed";
  await reportStatus(row.id, status, detail);

  return json(200, { sent, removed: dead.length, total: subscriptions.length, status });
});

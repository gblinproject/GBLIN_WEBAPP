/**
 * Farcaster Mini App notification helper.
 *
 * Spec: https://miniapps.farcaster.xyz/docs/specification#notifications
 * After a user adds the Mini App and enables notifications, the host POSTs a
 * { url, token } pair to our webhook. We persist it (TODO: KV) and later push
 * notifications by calling that url.
 *
 * Best practice (Neynar virality guide): only notify on SOCIAL triggers
 * (a friend beat your score, a new weekly crash is live) — never generic timers.
 */

export type NotificationDetails = { url: string; token: string };

export type SendResult = {
  successfulTokens?: string[];
  invalidTokens?: string[];
  rateLimitedTokens?: string[];
  error?: number;
};

/** Push a single notification to one token's host endpoint. */
export async function sendMiniAppNotification(opts: {
  details: NotificationDetails;
  notificationId: string; // <=128 chars, idempotency key with fid
  title: string; // <=32 chars
  body: string; // <=128 chars
  targetUrl: string; // must be same domain as the Mini App
}): Promise<SendResult> {
  try {
    const res = await fetch(opts.details.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationId: opts.notificationId.slice(0, 128),
        title: opts.title.slice(0, 32),
        body: opts.body.slice(0, 128),
        targetUrl: opts.targetUrl,
        tokens: [opts.details.token],
      }),
    });
    if (!res.ok) return { error: res.status };
    return (await res.json()) as SendResult;
  } catch {
    return { error: -1 };
  }
}

/**
 * Persist a notification token for an fid.
 * TODO(production): replace with a real KV store (Vercel KV / Upstash Redis).
 * Serverless functions are stateless, so the in-memory fallback below does NOT
 * survive between invocations — it exists only so the webhook compiles and runs.
 */
const memoryStore = new Map<number, NotificationDetails>();

export async function saveNotificationToken(fid: number, details: NotificationDetails): Promise<void> {
  memoryStore.set(fid, details);
  // eslint-disable-next-line no-console
  console.log("[gblin] saved notif token for fid", fid, details.token.slice(0, 8) + "…");
}

export async function removeNotificationToken(fid: number): Promise<void> {
  memoryStore.delete(fid);
}

export async function getNotificationToken(fid: number): Promise<NotificationDetails | undefined> {
  return memoryStore.get(fid);
}

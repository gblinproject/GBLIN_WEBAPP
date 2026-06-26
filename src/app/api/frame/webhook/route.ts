import { saveNotificationToken, removeNotificationToken } from "@/lib/notify";

/**
 * Farcaster Mini App webhook.
 * Receives server events (miniapp_added / miniapp_removed /
 * notifications_enabled / notifications_disabled) as a JSON Farcaster Signature
 * { header, payload, signature } (base64url).
 *
 * To activate, add to /.well-known/farcaster.json:
 *   "webhookUrl": "https://gblin.digital/api/frame/webhook"
 *
 * Spec: https://miniapps.farcaster.xyz/docs/specification#server-events
 * TODO(production): verify the JFS signature before trusting the payload,
 * and persist tokens in a real KV store (see src/lib/notify.ts).
 */
export const runtime = "nodejs";

type Jfs = { header: string; payload: string; signature: string };

function decode(b64url: string): unknown {
  const json = Buffer.from(b64url, "base64url").toString("utf8");
  return JSON.parse(json);
}

export async function POST(req: Request) {
  let fid = 0;
  try {
    const body = (await req.json()) as Jfs;
    const header = decode(body.header) as { fid?: number };
    fid = header?.fid ?? 0;
    const payload = decode(body.payload) as {
      event: string;
      notificationDetails?: { url: string; token: string };
    };

    switch (payload.event) {
      case "miniapp_added":
      case "notifications_enabled":
        if (payload.notificationDetails?.token && payload.notificationDetails?.url) {
          await saveNotificationToken(fid, payload.notificationDetails);
        }
        break;
      case "miniapp_removed":
      case "notifications_disabled":
        await removeNotificationToken(fid);
        break;
      default:
        break;
    }
  } catch {
    // malformed body — ignore, still return 200 so the host doesn't retry forever
  }

  return Response.json({ ok: true });
}

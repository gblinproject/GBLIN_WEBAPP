# GBLIN Mini App — Manual Steps Checklist

This file documents what **you (the human)** still need to do for the Mini App
to reach "excellent" production quality. Items below cannot be done by the
codebase alone — they require external services, manual signing, or assets
you must produce.

---

## ✅ Already done (in code)

- [x] `/.well-known/farcaster.json` manifest with signed `accountAssociation`
      (FID 3065643, signature already present)
- [x] `fc:miniapp` + `fc:frame` legacy embed metadata on `/frame` and `/game`
- [x] Crash Shield game (UI, simulator, dynamic OG image)
- [x] Share button via `sdk.actions.composeCast` (with Warpcast intent fallback)
- [x] `FarcasterInstallBanner` component calling `sdk.actions.addFrame()`
- [x] PWA manifest at `/manifest.json`

---

## 🔴 Tier 1 — REQUIRED before public launch

### 1. Verify the manifest signature on `gblin.digital`

After deploying the latest changes, verify with:

```bash
curl -s https://gblin.digital/.well-known/farcaster.json | jq .
```

Expected: returns a 200 with valid JSON. Then test with the official Farcaster
Mini App Manifest Tool:

> https://miniapps.farcaster.xyz/preview?url=https://gblin.digital

Should show: ✓ Manifest valid, ✓ Domain signature verified, ✓ Categories listed.

### 2. Verify icon assets

The manifest references:
- `iconUrl`: https://gblin.digital/LOGO_GBLIN.png
- `splashImageUrl`: https://gblin.digital/LOGO_GBLIN.png

Both must be:
- ✅ 1024×1024 PNG (icon) and 200×200 PNG (splash)
- ✅ No transparency on the icon (Farcaster will crop it)
- ✅ Reachable publicly (test in incognito)

If the current `LOGO_GBLIN.png` isn't 1024×1024 with no transparency, regenerate
it with any image editor and overwrite `public/LOGO_GBLIN.png`. Vercel will
serve it from `https://gblin.digital/LOGO_GBLIN.png` automatically.

### 3. Submit to Farcaster App Store

After deploy + verification:
1. Open Warpcast → Settings → Developer → Mini Apps
2. Paste `https://gblin.digital` and verify
3. Once verified, submit for App Store inclusion

---

## 🟠 Tier 2 — Major upgrades (require backend/external setup)

### 4. Push notifications

To send notifications when CrashShield activates / NAV moves:

**Setup needed:**
- [ ] Add Vercel KV or Upstash Redis to store notification tokens per FID
- [ ] Implement webhook endpoint at `POST /api/farcaster/webhook` that handles:
  - `frame_added` → save the user's notification token
  - `frame_removed` → delete the token
  - `notifications_enabled` / `notifications_disabled`
- [ ] Update manifest field `webhookUrl` in `farcaster.json` to point to this endpoint
- [ ] Add a cron at `/api/cron/notify-crash-shield` that:
  - Reads `CrashShieldActivated` events from the contract since last run
  - For each active token: POST to `https://api.farcaster.xyz/v1/frame-notifications`
- [ ] Get Neynar API key (free tier) for cleaner event indexing

Effort: ~6h. Without this, users have no re-engagement loop.

### 5. Game leaderboard

To show "top 100 survivors" with FID/username:

**Setup needed:**
- [ ] Vercel Postgres or Supabase project
- [ ] Schema:
  ```sql
  create table game_scores (
    fid bigint not null,
    username text,
    crash_id text not null,
    saved_usd numeric not null,
    direct_loss_pct numeric,
    gblin_loss_pct numeric,
    created_at timestamptz default now(),
    primary key (fid, crash_id)
  );
  ```
- [ ] `POST /api/game/score` endpoint that validates SIWF and writes the row
- [ ] `GET /api/game/leaderboard?crash=jan2026&limit=50` for reads
- [ ] New screen `/game/leaderboard` linked from result card

Effort: ~5h. Adds replay value 5x.

### 6. SIWF authentication

For personalised "@username, you would have saved $X" headline:

**Setup needed:**
- [ ] Add `sdk.actions.signIn()` call after `ready()` to obtain SIWF message
- [ ] Backend session via JWT or signed cookie
- [ ] Surface FID + username inside the result screen

Effort: ~3h. Required before leaderboard (Tier 2 #5) is meaningful.

### 7. Inline mint (replace "Open GBLIN" handoff)

Currently the dApp opens at `gblin.digital/buy-gblin` inside the Mini App
webview. To go fully native:

**Setup needed:**
- [ ] Decide between two paths:
  - **(a)** Migrate the buy flow from `thirdweb` to `wagmi` and add the
    `@farcaster/miniapp-wagmi-connector` connector to Wagmi config
  - **(b)** Keep `thirdweb` and write a custom adapter that wraps the Mini
    App SDK's Ethereum provider (`sdk.wallet.getEthereumProvider()`)
- [ ] Test mint flow end-to-end inside the Mini App preview tool
- [ ] Verify the existing `/buy-gblin` page still works in normal browser

Effort: ~5h (a), ~3-4h (b). High ROI — drops conversion friction by ~50%.

---

## 🟡 Tier 3 — Polish (cosmetic, non-blocking)

- [ ] Replace the "⛨" Unicode shield in the OG image with a real SVG asset
      (Satori does not load `lucide-react` icons in OG runtime)
- [ ] Add 3-5 screenshots of the Mini App for the App Store listing
- [ ] Internationalisation: extend `protocol-translations.ts` to cover
      `/game` and `/frame` strings
- [ ] Loading skeletons in `/api/frame/image` when contract RPC fails
      (currently shows `—` placeholders, which is fine but could be prettier)
- [ ] Sound effects — **don't bother**, they feel out of place in a finance
      product

---

## 🟢 Tier 4 — Growth experiments (post-grant)

- [ ] **Quick Actions / Triggers** — let bots invoke `/gblin price` from a cast
      and reply with a dynamic OG. Spec:
      https://miniapps.farcaster.xyz/docs/specification#triggers
- [ ] **Embed receiver** — when the Mini App opens with a cast in context,
      personalise based on the casting user
- [ ] **A/B test** the share text variants (random rotation among 3-4 copies)
- [ ] **Referral on-chain** — requires V5 contract changes, so blocked unless
      you ship V6

---

## Verification checklist after each deploy

```bash
# Manifest reachable + valid
curl -s https://gblin.digital/.well-known/farcaster.json | jq .miniapp.name

# Frame embed metadata visible
curl -sL https://gblin.digital/frame | grep -E 'fc:miniapp|fc:frame'

# Game embed metadata visible
curl -sL "https://gblin.digital/game?crash=jan2026&saved=1390" | grep fc:miniapp

# OG images render (200 OK + image/png)
curl -sI https://gblin.digital/api/frame/image | head -1
curl -sI "https://gblin.digital/api/game/image?crash=jan2026&saved=1390&direct=25.8&gblin=11.9" | head -1
```

All four commands must succeed before announcing the Mini App publicly.

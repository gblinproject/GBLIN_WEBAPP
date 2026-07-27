/**
 * GET /api/observatory — GBLIN Agent Economy Observatory (free, public, CORS *)
 *
 * Machine-readable data on how much of the "agent economy" is real:
 *   - live:      probe of the Coinbase x402 Bazaar discovery API (never fabricated;
 *                on any failure the block is null with a short live_error reason)
 *   - snapshot:  hardcoded, dated constants from our 2026-07-27 primary research
 *   - external:  third-party research citations
 *   - gblin:     our own on-chain-verifiable numbers, conflict of interest disclosed
 *   - oacr:      the Organic Agent Commerce Ratio metric definition (v0)
 *
 * Cache: 24h CDN (s-maxage=86400) + in-memory, following the supply routes' style.
 * Human-readable version: https://gblin.digital/observatory
 */

export const runtime = "nodejs";

const DISCOVERY_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const MAX_PAGES = 5;
const PAGE_TIMEOUT_MS = 5_000;
const PROBE_TIMEOUT_MS = 2_500;
const SAMPLE_SIZE = 20;

const CORS_CACHE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface LiveBlock {
  total_listed: number;
  total_listed_source: "pagination_metadata" | "fetched_count";
  fetched: number;
  sampled_reachability: {
    sampled: number;
    reachable: number;
    reachable_pct: number | null;
  };
  price_distribution: {
    priced_listings: number;
    median_usd: number;
    share_under_1_cent_pct: number;
  } | null;
  probed_at: string;
}

interface AgentStatsBlock {
  total_paid_calls: number;
  total_unique_agents: number;
  total_usdc_earned: number;
}

// ─── Live Bazaar probe ───────────────────────────────────────────────────────

/** Extract the resource URL and USD price (if any) from one Bazaar listing. */
function parseListing(item: unknown): { url: string | null; priceUsd: number | null } {
  if (typeof item !== "object" || item === null) return { url: null, priceUsd: null };
  const rec = item as Record<string, unknown>;

  const resource = rec.resource ?? rec.url;
  const url =
    typeof resource === "string" && /^https?:\/\//.test(resource) ? resource : null;

  // x402 `accepts[]` entries carry maxAmountRequired in atomic units of the
  // asset — USDC (6 decimals) in practice on the Bazaar.
  let priceUsd: number | null = null;
  const accepts = rec.accepts;
  if (Array.isArray(accepts) && accepts.length > 0) {
    const first = accepts[0] as Record<string, unknown>;
    const raw = first?.maxAmountRequired ?? first?.price;
    const atomic = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
    if (Number.isFinite(atomic) && atomic > 0) {
      const usd = atomic / 1e6;
      // Sanity bound: discard obviously non-USDC-denominated values.
      if (usd > 0 && usd < 10_000) priceUsd = usd;
    }
  }
  return { url, priceUsd };
}

async function fetchLive(): Promise<LiveBlock> {
  const urls: string[] = [];
  const prices: number[] = [];
  let totalFromMeta: number | null = null;
  let pageToken: string | null = null;
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const u = new URL(DISCOVERY_URL);
    u.searchParams.set("limit", "100");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    else if (page > 0) u.searchParams.set("offset", String(offset));

    const res = await fetch(u.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`discovery HTTP ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;

    const items = (json.items ?? json.resources ?? json.data) as unknown;
    const rows = Array.isArray(items) ? items : [];
    for (const row of rows) {
      const { url, priceUsd } = parseListing(row);
      if (url) urls.push(url);
      if (priceUsd !== null) prices.push(priceUsd);
    }
    offset += rows.length;

    // Pagination metadata: prefer an explicit total, else a next-page token.
    const pagination = json.pagination as Record<string, unknown> | undefined;
    const total = pagination?.total ?? json.total;
    if (typeof total === "number" && Number.isFinite(total)) totalFromMeta = total;
    const next = json.nextPageToken ?? pagination?.nextPageToken;
    pageToken = typeof next === "string" && next.length > 0 ? next : null;

    const exhausted =
      rows.length === 0 ||
      (!pageToken && totalFromMeta !== null && offset >= totalFromMeta) ||
      (!pageToken && pagination === undefined);
    if (exhausted) break;
  }

  if (urls.length === 0) throw new Error("discovery returned no listings");

  // Reachability: GET up to SAMPLE_SIZE random listed URLs; HTTP < 500 counts
  // as reachable (a 402 paywall answer IS the endpoint working).
  const shuffled = [...urls].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, SAMPLE_SIZE);
  const probes = await Promise.allSettled(
    sample.map((target) =>
      fetch(target, {
        method: "GET",
        redirect: "follow",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    )
  );
  const reachable = probes.filter(
    (p) => p.status === "fulfilled" && p.value.status < 500
  ).length;

  let priceDistribution: LiveBlock["price_distribution"] = null;
  if (prices.length > 0) {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const underCent = sorted.filter((p) => p < 0.01).length;
    priceDistribution = {
      priced_listings: prices.length,
      median_usd: Number(median.toFixed(6)),
      share_under_1_cent_pct: Number(((underCent / sorted.length) * 100).toFixed(1)),
    };
  }

  return {
    total_listed: totalFromMeta ?? urls.length,
    total_listed_source: totalFromMeta !== null ? "pagination_metadata" : "fetched_count",
    fetched: urls.length,
    sampled_reachability: {
      sampled: sample.length,
      reachable,
      reachable_pct:
        sample.length > 0 ? Number(((reachable / sample.length) * 100).toFixed(1)) : null,
    },
    price_distribution: priceDistribution,
    probed_at: new Date().toISOString(),
  };
}

// ─── GBLIN's own verified numbers ────────────────────────────────────────────

async function fetchGblinStats(): Promise<AgentStatsBlock> {
  const res = await fetch("https://gblin.digital/api/agent-stats", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`agent-stats HTTP ${res.status}`);
  const json = (await res.json()) as Partial<AgentStatsBlock>;
  return {
    total_paid_calls: Number(json.total_paid_calls ?? 0),
    total_unique_agents: Number(json.total_unique_agents ?? 0),
    total_usdc_earned: Number(json.total_usdc_earned ?? 0),
  };
}

// ─── Static blocks ───────────────────────────────────────────────────────────

const SNAPSHOT_2026_07_27 = {
  services_listed: 14381,
  endpoints_unreachable_pct: 52,
  wallets_ever_paid: 2503,
  top3_endpoints_volume_share_pct: 68,
  weekly_volume_vs_peak_pct: -96,
  median_price_usd: 0.014,
  method: "Full Bazaar catalog download + reachability probe, 2026-07-27",
} as const;

const EXTERNAL_RESEARCH = [
  {
    title:
      "ERC-8004 measurement study: of 10,000 registered agents, 0.67% expose a service endpoint, 6.3% have any feedback, 19 agents are fully operational, and one client generates 65.8% of reputation records",
    source: "arXiv 2606.12128",
    date: "2026-06",
    url: "https://arxiv.org/abs/2606.12128",
  },
  {
    title:
      "x402 daily volume around $28k; roughly 50% of transactions estimated to be self-dealing or wash trading (Artemis analysis)",
    source: "CoinDesk / Artemis",
    date: "2026-03-11",
    url: "https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet",
  },
] as const;

const OACR = {
  name: "Organic Agent Commerce Ratio (OACR)",
  definition:
    "Share of agent-economy activity that is verifiably organic: reachable endpoints x unique external payers x non-self-dealing volume, as a fraction of headline figures",
  status: "v0 — components published separately; composite index planned",
} as const;

const SOURCE = {
  name: "GBLIN Agent Economy Observatory",
  url: "https://gblin.digital/observatory",
  data_endpoint: "https://gblin.digital/api/observatory",
  methodology: "https://gblin.digital/observatory#methodology",
  license: "CC BY 4.0 — cite 'GBLIN Agent Economy Observatory'",
  disclosure:
    "GBLIN operates 11 paid x402 endpoints; own traffic is excluded from organic counts; methodology is public",
} as const;

// ─── In-memory cache (24h ok / 1h on live-probe failure) ─────────────────────

const CACHE_OK_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_ERR_TTL_MS = 60 * 60 * 1_000;
let cache: { body: Record<string, unknown>; fetchedAt: number; ttl: number } | null =
  null;

export async function GET(): Promise<Response> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < cache.ttl) {
    return Response.json(cache.body, { headers: CORS_CACHE_HEADERS });
  }

  // Live probe — NEVER fabricated: null + short reason on any failure.
  let live: LiveBlock | null = null;
  let liveError: string | null = null;
  try {
    live = await fetchLive();
  } catch (err) {
    live = null;
    liveError = err instanceof Error ? err.message.slice(0, 120) : "probe failed";
  }

  // Our own numbers (same data source as /api/agent-stats), COI disclosed.
  let gblinStats: AgentStatsBlock | null = null;
  let gblinError: string | null = null;
  try {
    gblinStats = await fetchGblinStats();
  } catch (err) {
    gblinError = err instanceof Error ? err.message.slice(0, 120) : "fetch failed";
  }

  const body: Record<string, unknown> = {
    live,
    ...(liveError ? { live_error: liveError } : {}),
    snapshot_2026_07_27: SNAPSHOT_2026_07_27,
    external_research: EXTERNAL_RESEARCH,
    gblin_verified: {
      operated_by: "GBLIN — conflict of interest disclosed",
      note: "Our own on-chain-verifiable x402 revenue numbers (USDC transfers to the fee wallet on Base). We publish them under the same scrutiny we apply to the ecosystem.",
      stats: gblinStats,
      ...(gblinError ? { error: gblinError } : {}),
      verify: "https://gblin.digital/api/agent-stats",
    },
    oacr: OACR,
    _source: SOURCE,
  };

  cache = { body, fetchedAt: now, ttl: live ? CACHE_OK_TTL_MS : CACHE_ERR_TTL_MS };
  return Response.json(body, { headers: CORS_CACHE_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

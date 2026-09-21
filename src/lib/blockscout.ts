/**
 * Single place that resolves the Blockscout endpoint used by server-side reads.
 *
 * Keyless Blockscout is intermittent: the same request can answer 200, 500 or 429, and the
 * caller is rate limited for minutes after a few requests in quick succession. An API key
 * raises that ceiling. Two different APIs are consumed — the etherscan-style `/api` and the
 * REST `/api/v2` — so the endpoint cannot be a single hard-coded constant.
 *
 * `BLOCKSCOUT_API_URL` is deliberately permissive: it accepts a bare origin, an origin with
 * `/api`, one with `/api/v2`, and one that already carries the key as a query parameter.
 * Whatever form is configured is normalised here, and the query string (where `apikey`
 * lives) is always preserved.
 *
 * The value may contain a secret: it never reaches a public response or a log.
 */

const DEFAULT_ORIGIN = 'https://base.blockscout.com';

/**
 * Host of the PRO API and the chain path prefix. A PRO API key is NOT valid on the
 * per-instance host `base.blockscout.com`: the PRO API lives on a different host and expects
 * the chain id in the path (Base = 8453). Without a key it answers
 * `402 "Proceed with API key or make a X402 payment to continue"`.
 */
const PRO_ORIGIN = 'https://api.blockscout.com';
const PRO_PREFIX = '/8453';

interface Source {
  origin: string;
  /** Path prefix to keep before `/api` (`/8453` for the PRO API). */
  prefix: string;
  /** Parameters already present in the configured value, typically `apikey`. */
  query: URLSearchParams;
}

const PUBLIC: Source = { origin: DEFAULT_ORIGIN, prefix: '', query: new URLSearchParams() };

function readSource(): Source {
  const raw = (process.env.BLOCKSCOUT_API_URL ?? '').trim();
  const key = (process.env.BLOCKSCOUT_API_KEY ?? '').trim();

  // Key only, no URL: the host it belongs to is known, so it need not be spelled out.
  if (!raw) {
    if (!key) return PUBLIC;
    const query = new URLSearchParams();
    query.set('apikey', key);
    return { origin: PRO_ORIGIN, prefix: PRO_PREFIX, query };
  }

  // The value is the KEY, not a URL. This is an easy mistake to make and it fails silently:
  // without this check `new URL('https://proapi_xxx')` is formally valid, so every request
  // would be sent to a non-existent host instead of surfacing the misconfiguration.
  if (/^proapi_/i.test(raw) || !/[./]/.test(raw)) {
    const query = new URLSearchParams();
    query.set('apikey', raw);
    return { origin: PRO_ORIGIN, prefix: PRO_PREFIX, query };
  }

  try {
    // Without a scheme `new URL` throws: one is added instead of rejecting the value.
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const query = new URLSearchParams(url.search);
    if (key && !query.has('apikey')) query.set('apikey', key);

    // The configured path must be PRESERVED up to `/api`: dropping it would erase the
    // `/8453` of the PRO API and send every request to a route that does not exist.
    let prefix = url.pathname.replace(/\/api(\/v2)?(\/.*)?\/?$/i, '').replace(/\/+$/, '');
    if (prefix === '/') prefix = '';

    // PRO host without a chain id: it is added, otherwise the request is not addressable.
    if (url.origin === PRO_ORIGIN && prefix === '') prefix = PRO_PREFIX;

    // A PRO key pointed at the per-instance host is worthless there and would be ignored
    // silently. It is the easiest misconfiguration to make, so it is corrected here instead
    // of letting it surface later as an unexplained rate limit.
    if (url.origin === DEFAULT_ORIGIN && query.has('apikey')) {
      return { origin: PRO_ORIGIN, prefix: PRO_PREFIX, query };
    }

    return { origin: url.origin, prefix, query };
  } catch {
    // A malformed value must not disable on-chain reads: fall back to the public host.
    return PUBLIC;
  }
}

/**
 * URL for the etherscan-style API (`/api?module=…&action=…`).
 * Parameters passed here take precedence over the configured ones, except `apikey`.
 */
export function blockscoutLegacyUrl(params: Record<string, string>, usePublic = false): string {
  const { origin, prefix, query } = usePublic ? PUBLIC : readSource();
  const url = new URL(`${prefix}/api`, origin);
  for (const [k, v] of query) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * URL for the REST v2 API (`/api/v2/<path>`).
 * `path` is the part after `/api/v2/`, without a leading slash.
 */
export function blockscoutV2Url(
  path: string,
  params: Record<string, string> = {},
  usePublic = false,
): string {
  const { origin, prefix, query } = usePublic ? PUBLIC : readSource();
  const url = new URL(`${prefix}/api/v2/${path.replace(/^\/+/, '')}`, origin);
  for (const [k, v] of query) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** True when a source other than the keyless public endpoint is configured. */
export function blockscoutConfigured(): boolean {
  const { origin, query } = readSource();
  return origin !== DEFAULT_ORIGIN || query.has('apikey');
}

/** Label of the source in use; never reveals the URL or the key. */
export function blockscoutSource(): 'pro' | 'custom' | 'public' {
  const { origin, query } = readSource();
  if (origin === PRO_ORIGIN || query.has('apikey')) return 'pro';
  return origin === DEFAULT_ORIGIN ? 'public' : 'custom';
}

/**
 * Runs the same request against the configured source and — only if that fails, and only if
 * the configured source differs from the public one — retries against public Blockscout.
 *
 * This upholds one invariant: **a wrong environment variable must never degrade the service
 * below what it would be with no variable set at all.** A typo in the URL, an expired key or
 * a dead instance would otherwise surface as a permanent, silent failure, indistinguishable
 * from Blockscout being down.
 *
 * `build` returns the URL for the source being tried.
 */
export async function blockscoutFetch(
  build: (usePublic: boolean) => string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<{ res: Response; usedPublic: boolean }> {
  const hasConfig = blockscoutConfigured();

  if (hasConfig) {
    try {
      const res = await fetch(build(false), init);
      if (res.ok) return { res, usedPublic: false };
    } catch {
      // Network error or unusable URL: fall through to the public host.
    }
  }

  const res = await fetch(build(hasConfig ? true : false), init);
  return { res, usedPublic: hasConfig };
}

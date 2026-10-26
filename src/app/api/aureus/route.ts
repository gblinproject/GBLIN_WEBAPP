import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Public read-only stats for the Aureus agent. The Python agent publishes the
// stats JSON to Upstash under the key "aureus:stats"; this endpoint serves it.
const URL_BASE = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Attribution block — additive, consumed by third parties citing our data.
const SOURCE = {
  name: 'GBLIN Agent Economy Observatory',
  url: 'https://gblin.digital/observatory',
  data_endpoint: 'https://gblin.digital/api/aureus',
  docs: 'https://gblin.digital/llms.txt',
  license: "CC BY 4.0 — cite 'GBLIN Agent Economy Observatory'",
  disclosure:
    'GBLIN operates 11 paid x402 endpoints; own traffic is excluded from organic counts; methodology is public',
} as const;

export async function GET() {
  if (!URL_BASE || !TOKEN) {
    return NextResponse.json({ enabled: false, stats: null, _source: SOURCE });
  }
  try {
    const r = await fetch(`${URL_BASE}/get/aureus:stats`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error('Statistics store unavailable');
    const j = await r.json();
    const raw = j?.result;
    const stats = raw ? JSON.parse(raw) : null;
    let blend = null;
    try {
      const b = await fetch(`${URL_BASE}/get/aureus:blend`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (b.ok) {
        const bj = await b.json();
        blend = bj?.result ? JSON.parse(bj.result) : null;
      }
    } catch {
      blend = null;
    }
    return NextResponse.json({ enabled: true, stats, blend, _source: SOURCE }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ enabled: false, stats: null, _source: SOURCE });
  }
}

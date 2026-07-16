import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Public read-only stats for the Aureus agent. The Python agent publishes the
// stats JSON to Upstash under the key "aureus:stats"; this endpoint serves it.
const URL_BASE = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function GET() {
  if (!URL_BASE || !TOKEN) {
    return NextResponse.json({ enabled: false, stats: null });
  }
  try {
    const r = await fetch(`${URL_BASE}/get/aureus:stats`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    const j = await r.json();
    const raw = j?.result;
    const stats = raw ? JSON.parse(raw) : null;
    return NextResponse.json({ enabled: true, stats }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ enabled: false, stats: null });
  }
}

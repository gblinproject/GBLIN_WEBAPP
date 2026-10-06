import { ProtocolApp } from '@/components/protocol/protocol-app';
import { fetchOnChainData, type OnChainData } from '@/components/protocol/protocol-data';

// The page is regenerated at most once an hour, so its HTML already carries the vault's figures
// for readers that do not run JavaScript (crawlers, link previews, agents). The browser refreshes
// them on load exactly as before.
export const revalidate = 3600;

const SNAPSHOT_TIMEOUT_MS = 8_000;

async function readSnapshot(): Promise<OnChainData | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS));
  const data = await Promise.race([fetchOnChainData().catch(() => null), timeout]);
  // fetchOnChainData answers zeros when a read fails. Zeros are not a figure to publish: the page
  // then renders its placeholders and the browser fills them in.
  if (!data || data.supplyNum <= 0 || data.tvl <= 0 || data.basketData.length === 0) return null;
  return data;
}

export default async function HomePage() {
  const snapshot = await readSnapshot();
  return <ProtocolApp view="home" initialOnChainData={snapshot} />;
}

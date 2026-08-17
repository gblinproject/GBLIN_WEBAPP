import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'A transaction record, not an endorsement: every x402 payment a third-party ERC-8004 agent (id 59895) made to GBLIN for its signed risk attestation, one per day, with the on-chain tx hash for each. Reproducible from public data by anyone.';

export const metadata: Metadata = {
  title: { absolute: 'Receipts — a third-party agent paying GBLIN daily, on-chain' },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/receipts` },
  openGraph: { title: 'Receipts — a third-party agent paying GBLIN daily, on-chain', description: PAGE_DESCRIPTION, url: `${SITE_URL}/receipts`, type: 'article' },
};

// Snapshot generated 2026-08-17 from Base mainnet: USDC Transfer events from the payer wallet to the
// GBLIN fee wallet. Re-derive it yourself with any RPC: filter USDC (0x8335…2913) Transfer logs where
// from = payer and to = 0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B. Static by design: a receipt page
// that quietly refreshes itself is a counter, and counters are the thing this project refuses to inflate.
const PAYER = '0x89cA143c42c22D0B0D24D6d2BFe00050331C6ef8';
const FEE_WALLET = '0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B';
const RECEIPTS = [
  { day: '2026-07-26', utc: '15:17', tx: '0x1c49435343ec63dccdc263e13d1819ba9507e169e66984da8e1ac8a1089e0ee9' },
  { day: '2026-07-27', utc: '15:17', tx: '0xdf2f91bd06151f2cbc335a5169ef23169ed6b1a74b51cd3c13a96cb6384f55ae' },
  { day: '2026-07-28', utc: '15:17', tx: '0x730bf0b2659f11650ddf38e63da3d1455e2f3bd61b52cc111f394221f9ef96cd' },
  { day: '2026-07-29', utc: '15:17', tx: '0x83b6333e77678ff0838889082c331140a211f31a40d8e044559301ae681e18bc' },
  { day: '2026-07-30', utc: '15:17', tx: '0xc1827bbebddd85370f4fbf89696aa6540d34c62225fd03e6a0987d51cde7bb58' },
  { day: '2026-07-31', utc: '15:17', tx: '0x7c45143b59f4c443467d955e9f2ac57b2d413a0c142fb7787eeb790b8a5e894e' },
  { day: '2026-08-01', utc: '15:17', tx: '0xdec3daf7b6b71df5a6daae79071b815a3f4f4e990d9da10bf201398ce86a4a80' },
  { day: '2026-08-02', utc: '15:17', tx: '0xdd3da04461a676575b0e88d48c7a078e41c0da297209263c5dfe3f23af091c1d' },
  { day: '2026-08-04', utc: '15:17', tx: '0x27bfd804e4b3250f298de101423372b12c3967a710308c9282324ea55bb41f71' },
  { day: '2026-08-05', utc: '15:17', tx: '0xbd1ddb83d5fabb1f732022e6ef6137828bbe31a62dcd2b164fbe7f9d0ab8f2cd' },
  { day: '2026-08-06', utc: '15:17', tx: '0x25480eb70f6d47199a1f4af30f4c702a736d576ff98765457dad4d4d3c63fb3a' },
  { day: '2026-08-07', utc: '15:17', tx: '0x6d15420a30b17b2450469c0c50963b9042a83e6f72f01c67675639323b98bd54' },
  { day: '2026-08-08', utc: '15:17', tx: '0x9028807023bf301a01a3e186676cdf625856ac4f0c1033e4a9744baee192b5a6' },
  { day: '2026-08-09', utc: '15:17', tx: '0x5b8c0b5926664e00c0601d16fde30c5892df1df6115d5402e726e01d1d25e6aa' },
  { day: '2026-08-10', utc: '15:17', tx: '0x115393cd3572baab9e511557af9cbc34472d242551ac87d70ee131f1504daf14' },
  { day: '2026-08-11', utc: '15:17', tx: '0x89a51dfe1bd836be5a795a35df844cf4596e52ebf4f51b8895030052e409af8e' },
  { day: '2026-08-12', utc: '15:17', tx: '0xc7dafff49a54167542444045dffe6d01a43694830fd6d6aef79dbf033308d5a7' },
  { day: '2026-08-13', utc: '15:17', tx: '0xd67aa71d14815da40076c71f038d4e003b3fb9904a5817e4a636a55602465beb' },
  { day: '2026-08-14', utc: '15:17', tx: '0xf4dccb7379146dd95719b66130515a89f4ee03c2f021e3d063c07dfcac9ebc24' },
  { day: '2026-08-15', utc: '15:17', tx: '0x5e64e3116aa51ce91596282f9538261a42e9a9330d0884e4f15f58faee993017' },
  { day: '2026-08-16', utc: '15:17', tx: '0xfda12dd92f8a8d34ea92c13ac1c7155603ef6a8a42f534a81d76b87b8701756d' }
];

export default function ReceiptsPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-200">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Receipts</p>
        <h1 className="mt-2 font-serif text-3xl text-white">A third-party agent paying GBLIN daily, on-chain</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          This is a transaction record, not an endorsement. Since late July an ERC-8004 agent registered on Base as{' '}
          <a className="text-amber-300 underline" href="https://8004scan.io/agents?search=59895" rel="noreferrer" target="_blank">id 59895</a>{' '}
          — operated by a different party, whom we have never spoken to — has bought GBLIN&apos;s signed risk attestation
          (<code className="text-xs">/api/x402/attestation</code>, $0.003 USDC via x402) once a day, at the same minute, as an input of a
          decision rule its operator publishes as a hash-pinned file. Below is every settlement, as it sits on Base.
        </p>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Honest scale: this is <strong className="text-zinc-200">one</strong> recurring payer. We publish it not because it is
          large but because it is checkable — anyone can re-derive this table from public data in a minute (method in the page source).
          Payer wallet: <code className="text-xs">{PAYER}</code>. Recipient (GBLIN fee wallet): <code className="text-xs">{FEE_WALLET}</code>.
        </p>
        <table className="mt-8 w-full text-left text-xs">
          <thead><tr className="text-zinc-500"><th className="pb-2 pr-4 font-normal">day (UTC)</th><th className="pb-2 pr-4 font-normal">time</th><th className="pb-2 font-normal">settlement tx on Base</th></tr></thead>
          <tbody>
            {RECEIPTS.map((r) => (
              <tr key={r.tx} className="border-t border-white/[0.06]">
                <td className="py-2 pr-4 font-mono text-zinc-300">{r.day}</td>
                <td className="py-2 pr-4 font-mono text-zinc-500">{r.utc}</td>
                <td className="py-2 font-mono"><a className="text-amber-300/80 hover:text-amber-200" href={`https://basescan.org/tx/${r.tx}`} rel="noreferrer" target="_blank">{r.tx.slice(0, 22)}…</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-8 text-xs leading-6 text-zinc-500">
          Snapshot as of 2026-08-17 ({RECEIPTS.length} settlements on {RECEIPTS.length} distinct days). We do not characterise the
          counterparty&apos;s reasoning beyond what its own public files state; the operator was notified before this page went up
          and can ask for changes at any time. What the attestation is and how any agent can verify one: <a className="text-amber-300 underline" href="/risk-gate">/risk-gate</a>.
          Our own wallets are excluded from every public counter we publish; the payer above is not ours.
        </p>
      </main>
    </PublicShell>
  );
}

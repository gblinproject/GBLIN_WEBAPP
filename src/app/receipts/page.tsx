import type { Metadata } from 'next';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'A transaction record, not an endorsement: every x402 payment a third-party ERC-8004 agent (id 59895) made to GBLIN for its signed risk attestation, with the on-chain tx hash for each and, where it exists, the matching leaf in the payer\'s own transparency log. Reproducible from public data by anyone.';

export const metadata: Metadata = {
  title: { absolute: 'Receipts — a third-party agent that paid GBLIN daily, on-chain' },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/receipts` },
  openGraph: { title: 'Receipts — a third-party agent that paid GBLIN daily, on-chain', description: PAGE_DESCRIPTION, url: `${SITE_URL}/receipts`, type: 'article' },
};

// Snapshot from Base mainnet: USDC Transfer events from the payer wallet to the GBLIN fee wallet.
// Re-derive it yourself with any RPC: filter USDC (0x8335…2913) Transfer logs where from = payer and
// to = 0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B. Static by design: a receipt page that quietly
// refreshes itself is a counter, and counters are the thing this project refuses to inflate.
//
// CORRECTION 2026-08-18: the first snapshot (2026-08-17) listed 21 settlements starting 2026-07-26.
// It had read only the first page of the explorer's results and silently dropped 8 earlier
// settlements (2026-07-18 → 2026-07-25). Both pages are now read; the table below is the complete
// set as of the snapshot date. We are stating this here rather than editing quietly.
//
// `leaf` = index of the matching entry in the payer's own witnessed transparency log
// (log.markovianprotocol.com, C2SP tlog format). Each leaf is an x402-settlement claim naming this
// payer, this payee and the same amount; the match is by time window (authorization validAfter →
// on-chain settlement within 25 minutes). null = no leaf we could match: one of the two 08:22
// settlements on 07-18 shares its window with a single leaf, and 08-09 → 08-12 have no leaf in the
// log at all. Inclusion proof for any leaf: https://log.markovianprotocol.com/proof/<leaf>.
const PAYER = '0x89cA143c42c22D0B0D24D6d2BFe00050331C6ef8';
const FEE_WALLET = '0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B';
const LOG = 'https://log.markovianprotocol.com';
const RECEIPTS: { day: string; utc: string; tx: string; leaf: number | null }[] = [
  { day: '2026-07-18', utc: '08:22', tx: '0x7b29b0cc1e01daa45fd06e61445892c2b02211fee5342b36681d20a41604fa6a', leaf: null },
  { day: '2026-07-18', utc: '08:22', tx: '0x4077f2f26b573a2251799aceca26cc345ba3a8932abd3a0873ae181a41432ffb', leaf: 906 },
  { day: '2026-07-18', utc: '08:34', tx: '0x12800164babf077d2d2e437383097476878f3e7b6a3d7902f685150a411d5ec6', leaf: 907 },
  { day: '2026-07-18', utc: '16:46', tx: '0xc2dc5bdd9ca3fd465f34ee29617620de7c65790bbcd3a681765fd85daa174839', leaf: 1024 },
  { day: '2026-07-22', utc: '15:17', tx: '0x43c149e2e743d7336b739f8046e9be06b6fcb1f10427571c0389e6b5353d1eb3', leaf: 2377 },
  { day: '2026-07-23', utc: '15:17', tx: '0xefed3e4c5a17d2d00b4a259460d369d2f4bb0ec290d68e76b19a911f7be63c54', leaf: 2801 },
  { day: '2026-07-24', utc: '15:17', tx: '0x3284c9312e8ace5cb837ca451d293bd4a92d57a84d37ce3b137d4e8c94b1547e', leaf: 3216 },
  { day: '2026-07-25', utc: '15:17', tx: '0xdcd679b3eb49e81ea041c4c073b1960db672795e5d829a41899c3e065f934f6c', leaf: 3550 },
  { day: '2026-07-26', utc: '15:17', tx: '0x1c49435343ec63dccdc263e13d1819ba9507e169e66984da8e1ac8a1089e0ee9', leaf: 3786 },
  { day: '2026-07-27', utc: '15:17', tx: '0xdf2f91bd06151f2cbc335a5169ef23169ed6b1a74b51cd3c13a96cb6384f55ae', leaf: 4069 },
  { day: '2026-07-28', utc: '15:17', tx: '0x730bf0b2659f11650ddf38e63da3d1455e2f3bd61b52cc111f394221f9ef96cd', leaf: 4409 },
  { day: '2026-07-29', utc: '15:17', tx: '0x83b6333e77678ff0838889082c331140a211f31a40d8e044559301ae681e18bc', leaf: 4754 },
  { day: '2026-07-30', utc: '15:17', tx: '0xc1827bbebddd85370f4fbf89696aa6540d34c62225fd03e6a0987d51cde7bb58', leaf: 5154 },
  { day: '2026-07-31', utc: '15:17', tx: '0x7c45143b59f4c443467d955e9f2ac57b2d413a0c142fb7787eeb790b8a5e894e', leaf: 5446 },
  { day: '2026-08-01', utc: '15:17', tx: '0xdec3daf7b6b71df5a6daae79071b815a3f4f4e990d9da10bf201398ce86a4a80', leaf: 5766 },
  { day: '2026-08-02', utc: '15:17', tx: '0xdd3da04461a676575b0e88d48c7a078e41c0da297209263c5dfe3f23af091c1d', leaf: 6000 },
  { day: '2026-08-04', utc: '15:17', tx: '0x27bfd804e4b3250f298de101423372b12c3967a710308c9282324ea55bb41f71', leaf: 6578 },
  { day: '2026-08-05', utc: '15:17', tx: '0xbd1ddb83d5fabb1f732022e6ef6137828bbe31a62dcd2b164fbe7f9d0ab8f2cd', leaf: 6932 },
  { day: '2026-08-06', utc: '15:17', tx: '0x25480eb70f6d47199a1f4af30f4c702a736d576ff98765457dad4d4d3c63fb3a', leaf: 7123 },
  { day: '2026-08-07', utc: '15:17', tx: '0x6d15420a30b17b2450469c0c50963b9042a83e6f72f01c67675639323b98bd54', leaf: 7195 },
  { day: '2026-08-08', utc: '15:17', tx: '0x9028807023bf301a01a3e186676cdf625856ac4f0c1033e4a9744baee192b5a6', leaf: 7267 },
  { day: '2026-08-09', utc: '15:17', tx: '0x5b8c0b5926664e00c0601d16fde30c5892df1df6115d5402e726e01d1d25e6aa', leaf: 7469 },
  { day: '2026-08-10', utc: '15:17', tx: '0x115393cd3572baab9e511557af9cbc34472d242551ac87d70ee131f1504daf14', leaf: 7470 },
  { day: '2026-08-11', utc: '15:17', tx: '0x89a51dfe1bd836be5a795a35df844cf4596e52ebf4f51b8895030052e409af8e', leaf: 7471 },
  { day: '2026-08-12', utc: '15:17', tx: '0xc7dafff49a54167542444045dffe6d01a43694830fd6d6aef79dbf033308d5a7', leaf: 7472 },
  { day: '2026-08-13', utc: '15:17', tx: '0xd67aa71d14815da40076c71f038d4e003b3fb9904a5817e4a636a55602465beb', leaf: 7313 },
  { day: '2026-08-14', utc: '15:17', tx: '0xf4dccb7379146dd95719b66130515a89f4ee03c2f021e3d063c07dfcac9ebc24', leaf: 7345 },
  { day: '2026-08-15', utc: '15:17', tx: '0x5e64e3116aa51ce91596282f9538261a42e9a9330d0884e4f15f58faee993017', leaf: 7375 },
  { day: '2026-08-16', utc: '15:17', tx: '0xfda12dd92f8a8d34ea92c13ac1c7155603ef6a8a42f534a81d76b87b8701756d', leaf: 7387 },
];

export default function ReceiptsPage() {
  const withLeaf = RECEIPTS.filter((r) => r.leaf !== null).length;
  const days = new Set(RECEIPTS.map((r) => r.day)).size;
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-200">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Receipts</p>
        <h1 className="mt-2 font-serif text-3xl text-white">A third-party agent that paid GBLIN daily, on-chain</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          This is a transaction record, not an endorsement. Since mid-July an ERC-8004 agent registered on Base as{' '}
          <a className="text-amber-300 underline" href="https://8004scan.io/agents?search=59895" rel="noreferrer" target="_blank">id 59895</a>{' '}
          — operated by a different party — has bought GBLIN&apos;s signed risk attestation
          (<code className="text-xs">/api/x402/attestation</code>, $0.003 USDC via x402): a few exploratory calls on 18 July, then once a day at the same minute,
          as an input of a decision rule its operator publishes as a hash-pinned file. Below is every settlement, as it sits on Base.
        </p>
        <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm leading-7 text-amber-100/90">
          <strong className="text-amber-200">Update, 21 August 2026:</strong> the daily purchases stopped. The last settlement is
          16 August at 15:17 UTC. This is not us going quiet about a lost customer: the payer&apos;s own transparency log shows its
          entire x402 settlement step stopped that minute — the same run also stopped paying its own endpoint
          (<code className="text-xs">markovianprotocol.com/signal/latest</code>) — while its signal entries keep flowing, so the agent is
          running and only the payment step is down. We verified our side first (a real paid call on 21 August: 402 challenge,
          EIP-3009 settlement, EIP-712 signature and all five contract fields check out) and told them. The table below stays as it is.
        </p>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Honest scale: this is <strong className="text-zinc-200">one</strong> recurring payer. We publish it not because it is
          large but because it is checkable — anyone can re-derive this table from public data in a minute (method in the page source).
          Payer wallet: <code className="text-xs">{PAYER}</code>. Recipient (GBLIN fee wallet): <code className="text-xs">{FEE_WALLET}</code>.
        </p>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Checkable from both ends: the payer runs a witnessed transparency log and records each purchase in it. Where we could match a
          settlement to a log entry, the <span className="text-zinc-200">leaf</span> column links to that entry&apos;s inclusion proof on{' '}
          <a className="text-amber-300 underline" href={`${LOG}/`} rel="noreferrer" target="_blank">log.markovianprotocol.com</a>. The two records
          are kept by two different operators; they should agree, and where they don&apos;t we say so.
        </p>
        <table className="mt-8 w-full text-left text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="pb-2 pr-4 font-normal">day (UTC)</th>
              <th className="pb-2 pr-4 font-normal">time</th>
              <th className="pb-2 pr-4 font-normal">settlement tx on Base</th>
              <th className="pb-2 font-normal">leaf in payer&apos;s log</th>
            </tr>
          </thead>
          <tbody>
            {RECEIPTS.map((r) => (
              <tr key={r.tx} className="border-t border-white/[0.06]">
                <td className="py-2 pr-4 font-mono text-zinc-300">{r.day}</td>
                <td className="py-2 pr-4 font-mono text-zinc-500">{r.utc}</td>
                <td className="py-2 pr-4 font-mono"><a className="text-amber-300/80 hover:text-amber-200" href={`https://basescan.org/tx/${r.tx}`} rel="noreferrer" target="_blank">{r.tx.slice(0, 22)}…</a></td>
                <td className="py-2 font-mono">
                  {r.leaf !== null
                    ? <a className="text-amber-300/80 hover:text-amber-200" href={`${LOG}/proof/${r.leaf}`} rel="noreferrer" target="_blank">#{r.leaf}</a>
                    : <span className="text-zinc-600">not in log</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-8 text-xs leading-6 text-zinc-500">
          Snapshot as of 2026-08-17, corrected 2026-08-18 and 2026-08-19 ({RECEIPTS.length} settlements on {days} distinct days; {withLeaf} matched to a log leaf,{' '}
          {RECEIPTS.length - withLeaf} without one). <strong className="text-zinc-400">Correction:</strong> the first version of this page listed 21
          settlements starting 26 July; it had read only the first page of explorer results and dropped 8 earlier ones (18–25 July). Fixed here,
          stated here. <strong className="text-zinc-400">Update 2026-08-19:</strong> the four settlements of 9–12 August now have leaves (#7469–#7472).
          The operator found the cause on its side — a retired local copy of its log server was still bound to the port the stamp client
          posts to, and won the race for exactly those four days — and re-submitted the four claims through the real pipeline on 18 August.
          Their leaf content carries the original settlement dates; the log append timestamp is 18 August, because that is genuinely when
          they entered the tree. We verified each leaf&apos;s transaction hash against the on-chain settlement before linking it. One settlement
          still has no leaf: the first of the two 08:22 calls on 18 July (tx 0x7b29…, 08:22:09 UTC) — it was settled by a different sender
          than the payer&apos;s stamp client, so it most likely never reached their pipeline; the operator&apos;s record shows two calls that
          day and ours shows three, and we leave both records as they are. We do not characterise the counterparty&apos;s reasoning beyond what its own
          public files state; the operator was notified before this page went up and can ask for changes at any time. What the attestation is and
          how any agent can verify one: <a className="text-amber-300 underline" href="/risk-gate">/risk-gate</a>.
          Our own wallets are excluded from every public counter we publish; the payer above is not ours.
        </p>
      </main>
    </PublicShell>
  );
}

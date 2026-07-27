import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/protocol/public-shell';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'GBLIN is a risk-managed treasury option for AI agents on Base mainnet — managed crypto exposure with capped drawdown (for surplus capital, not a USDC substitute). Open-source MCP server with 10 tools: an on-chain market-risk signal, free risk-attestation verification, live NAV, dynamic-slippage quotes, deterministic two-step Just-In-Time GBLIN→USDC redemption for x402 payments, treasury health, governance verification, agent-to-agent skill propagation, and keeper bounties (GBLIN pays agents to rebalance). Works with Claude, Windsurf, Coinbase AgentKit, and Eliza out of the box.';

export const metadata: Metadata = {
  title: 'GBLIN — The Machine Reserve · AI Agent Treasury on Base',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/agents` },
  openGraph: {
    title: 'GBLIN for AI Agents — Treasury Standard on Base',
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/agents`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GBLIN for AI Agents — Treasury Standard on Base',
    description: PAGE_DESCRIPTION,
  },
  keywords: [
    'AI agents treasury',
    'GBLIN MCP server',
    'Model Context Protocol',
    'x402 payments',
    'Coinbase AgentKit',
    'Eliza framework',
    'Base mainnet agents',
    'autonomous agent wallet',
    'JIT swap GBLIN USDC',
    'agentic economy',
    'machine reserve',
  ],
};

const TOOLS = [
  {
    name: 'get_market_risk_regime',
    purpose: 'BTC/ETH risk regime (calm / elevated / crash) + severity + risk_on/reduce/risk_off posture, from the on-chain Crash Shield. $0.002 USDC via x402.',
  },
  {
    name: 'get_treasury_state',
    purpose: 'Snapshot NAV in USD, basket composition, and Crash Shield status from on-chain reads.',
  },
  {
    name: 'quote_safe_swap',
    purpose: 'Preview buy or sell with the right minOut accounting for fees + dynamic slippage (2.5% normal / 4% during Crash Shield).',
  },
  {
    name: 'swap_gblin_to_usdc_jit',
    purpose: 'Generate ready-to-broadcast calldata for a deterministic two-step GBLIN→USDC redemption right before paying an x402 invoice. Works on EOA, ERC-4337, EIP-7702 (batchable in one UserOp on smart accounts).',
  },
  {
    name: 'invest_usdc_to_gblin',
    purpose: 'Convert USDC earnings back to GBLIN with MEV-safe minOut values. Returns two sequential steps (approve + buyGBLINWithToken).',
  },
  {
    name: 'analyze_treasury_health',
    purpose: 'Full balance report (GBLIN + USDC + ETH), gas runway, cooldown status, and rebalance recommendation based on the agent burn rate.',
  },
  {
    name: 'get_governance_state',
    purpose: 'Verify owner == 48h Timelock, check pending asset proposals, min delay seconds. AI agents use this to gate trust-sensitive operations.',
  },
  {
    name: 'share_skill_with_peer',
    purpose: 'Generate a portable JSON skill seed to onboard a peer agent. Embeds a referral code — when the peer executes its first GBLIN tx, a share of the protocol fee is attributed to you via ERC-8021 Builder Code.',
  },
  {
    name: 'find_keeper_bounty',
    purpose: 'GBLIN pays you: check if a rebalance bounty is available right now. Returns ready-to-send calldata. The swap uses the contract\'s own funds — the keeper only pays gas (~$0.01 on Base) and earns an adaptive bounty (~0.05% of the volume rebalanced, capped 0.00005–0.01 ETH).',
  },
  {
    name: 'verify_risk_attestation',
    purpose: 'Verify a peer agent\'s Risk Attestation before trusting it: recomputes the EIP-712 id (tamper check), recovers the signer against GBLIN\'s published attestor, checks the 10-minute freshness, and flags if the on-chain regime has drifted. Free — the paid side is minting one at /api/x402/attestation ($0.003).',
  },
];

const FRAMEWORKS = [
  {
    name: 'Claude Desktop',
    file: '`claude_desktop_config.json`',
    code: `{
  "mcpServers": {
    "gblin": {
      "command": "npx",
      "args": ["-y", "@gblin-protocol/mcp-server"]
    }
  }
}`,
  },
  {
    name: 'Windsurf / Cursor',
    file: '`~/.codeium/windsurf/mcp_config.json`',
    code: `{
  "mcpServers": {
    "gblin": {
      "command": "npx",
      "args": ["-y", "@gblin-protocol/mcp-server"],
      "env": {
        "GBLIN_RPC_URL": "https://base-rpc.publicnode.com"
      }
    }
  }
}`,
  },
  {
    name: 'Coinbase AgentKit',
    file: 'TypeScript',
    code: `import { MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@gblin-protocol/mcp-server"],
});
const mcp = new MCPClient({ name: "my-agent", version: "1.0" });
await mcp.connect(transport);`,
  },
];

const FAQS = [
  {
    q: 'Is GBLIN a replacement for USDC?',
    a: 'No. GBLIN is managed crypto exposure with a capped drawdown — for surplus capital you want to grow with less downside than holding BTC/ETH. It can still lose value in a crash (less than BTC/ETH, but it is not principal-protected). Keep operating cash in USDC; park surplus in GBLIN and JIT-swap back to USDC for x402 payments.',
  },
  {
    q: 'Does this break my x402 flow?',
    a: 'No. x402 invoices still settle in USDC. The MCP server generates a 1-tx swap that delivers the needed USDC to your wallet before you pay. No facilitator changes, no protocol changes.',
  },
  {
    q: 'Which wallets work?',
    a: 'Any. The contract function `sellGBLINForEth` + a Uniswap WETH->USDC swap is a two-step flow (V6) — works on EOA (Privy, MetaMask), ERC-4337 smart accounts (Safe, Coinbase smart wallet), and EIP-7702 delegated EOAs (Pectra+).',
  },
  {
    q: 'How is slippage handled?',
    a: 'Every tool returns minOut values computed from on-chain quotes + a buffer that scales with risk: 2.5% in normal markets, 4% when the Crash Shield is active. Never zero — eliminates MEV sandwich exposure.',
  },
  {
    q: 'Is this open source?',
    a: 'Yes. MIT licensed. Source on GitHub, npm package public, no telemetry.',
  },
  {
    q: 'Are there paid endpoints?',
    a: 'Yes — 7 x402 HTTP endpoints are live at gblin.digital/api/x402/*. Prices range from $0.001 to $0.005 USDC per call, paid on Base mainnet. The MCP server itself remains free.',
  },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '@gblin-protocol/mcp-server',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'AI Agent Tooling',
  operatingSystem: 'Cross-platform (Node.js 20+)',
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/agents`,
  downloadUrl: 'https://www.npmjs.com/package/@gblin-protocol/mcp-server',
  codeRepository: 'https://github.com/gblinproject/GBLIN-MCP',
  license: 'https://opensource.org/licenses/MIT',
  programmingLanguage: 'TypeScript',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: 'GBLIN Protocol', url: SITE_URL },
};

export default function AgentsPage() {
  return (
    <PublicShell>
    <main className="min-h-screen bg-[#050505] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ───────── Hero ───────── */}
      <section className="px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 max-w-5xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-semibold leading-tight tracking-tight">
          The treasury standard for{' '}
          <span className="text-gradient">AI agents</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-3xl leading-relaxed">
          Your agents shouldn&apos;t park capital in flat USDC. GBLIN is an on-chain
          basket (45% cbBTC + 45% WETH + 10% USDC) with an algorithmic Crash Shield —
          hold it as treasury, and Just-In-Time swap to USDC the millisecond an
          x402 invoice arrives.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="https://github.com/gblinproject/GBLIN-MCP"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg bg-amber-500 text-black font-medium text-sm hover:opacity-90 transition"
          >
            View on GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/@gblin-protocol/mcp-server"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg border border-white/20 text-sm hover:bg-white/5 transition"
          >
            npm package
          </a>
          <a
            href="https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg border border-white/20 text-sm hover:bg-white/5 transition"
          >
            Contract on Basescan
          </a>
          <a
            href="/observatory"
            className="px-5 py-2.5 rounded-lg border border-amber-400/40 bg-amber-500/10 text-sm text-amber-200 hover:bg-amber-500/20 transition"
          >
            Agent Economy Observatory →
          </a>
        </div>

        <pre className="mt-10 p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 overflow-x-auto">
          <code>npx @gblin-protocol/mcp-server</code>
        </pre>
      </section>

      {/* ───────── Why GBLIN ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Why agents hold GBLIN
          </h2>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Yield without breaking x402',
                body: 'Hold GBLIN (basket appreciation) and JIT-swap to USDC only when invoices come in. x402 payments still settle in USDC — facilitator unchanged.',
              },
              {
                title: 'Two-step swap (V6), any wallet',
                body: 'On V6 the redemption is sellGBLINForEth (GBLIN->ETH) plus a Uniswap WETH->USDC swap: two steps. EOAs sign twice; smart accounts (ERC-4337) and EIP-7702 can batch both into one UserOp.',
              },
              {
                title: 'On-chain quotes, no oracles to trust',
                body: 'NAV is computed from `quoteSellGBLIN` × the Chainlink ETH/USD feed (24h staleness guard). Tool aborts on stale or negative answers.',
              },
              {
                title: 'MEV-safe by default',
                body: 'Every tool returns positive minOut values from on-chain quotes plus a dynamic slippage buffer. Never accepts 0. Sandwich attacks rejected.',
              },
              {
                title: 'Crash Shield aware',
                body: 'When a basket asset breaches its adaptive crash threshold (~15%, dual-peak), dynamic weights re-route proportionally toward USDC. The internal slippage buffer auto-scales within a 0.5%–5.5% envelope driven by on-chain volatility to absorb the temporary pool stress.',
              },
              {
                title: 'MCP-native — works everywhere',
                body: 'Standard Model Context Protocol over stdio. Drop-in for Claude Desktop, Windsurf, Cursor, Coinbase AgentKit, Eliza, or any custom agent that speaks MCP.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="border border-white/[0.07] bg-white/[0.02]p-6 rounded-xl"
              >
                <h3 className="font-medium text-base">{card.title}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Quick Start ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Quick start
          </h2>
          <p className="mt-3 text-white/60">
            Pick your framework. All examples assume Node.js 20+.
          </p>

          <div className="mt-10 space-y-6">
            {FRAMEWORKS.map((fw) => (
              <div key={fw.name} className="border border-white/[0.07] bg-white/[0.02]rounded-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                  <span className="font-medium">{fw.name}</span>
                  <span className="text-xs text-white/40 font-mono">{fw.file}</span>
                </div>
                <pre className="p-5 text-sm text-white/80 overflow-x-auto">
                  <code>{fw.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── The 10 tools ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            The 10 tools
          </h2>
          <p className="mt-3 text-white/60">
            Every tool reads live state from Base mainnet. None of them hold
            keys or broadcast — they return JSON results and ABI-encoded
            calldata. Your wallet stays in control.
          </p>

          <div className="mt-10 space-y-3">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="border border-white/[0.07] bg-white/[0.02]rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-baseline gap-3"
              >
                <code className="text-amber-400 font-mono text-sm whitespace-nowrap">
                  {tool.name}
                </code>
                <p className="text-sm text-white/70 leading-relaxed">{tool.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Code example ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            JIT payment in practice
          </h2>
          <p className="mt-3 text-white/60 max-w-3xl">
            Your agent receives a 402 invoice for $0.50. It has 90% of its
            treasury in GBLIN. Here&apos;s the flow:
          </p>

          <pre className="mt-8 p-6 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 overflow-x-auto leading-relaxed">
            <code>{`// === Complete agent treasury flow ===

// Step 1: Check treasury health and invest idle USDC
const health = await mcp.callTool({
  name: "analyze_treasury_health",
  arguments: { wallet_address: agent.address },
});

// Step 2: If idle USDC > 7x daily burn, invest into GBLIN
const invest = await mcp.callTool({
  name: "invest_usdc_to_gblin",
  arguments: { usdc_amount: "10.00", wallet_address: agent.address },
});
// Returns 2-step calldata: approve + buyGBLINWithToken
// Broadcast both txs with your wallet

// --- later, when an x402 invoice arrives ---

// Step 3. Agent gets the JIT swap calldata from the MCP server
const jit = await mcp.callTool({
  name: "swap_gblin_to_usdc_jit",
  arguments: {
    usdc_needed: "0.50",
    wallet_address: agent.address,
  },
});

// jit.content[0].text contains:
// {
//   action: "single_atomic_tx",
//   action: "sequential_txs", steps: [sellGBLINForEth, WETH->USDC]
//   target (V6): 0x36C81d7E...52f0
//   expected: { usdc_out: "0.5128", slippage_buffer_pct: 2.5 },
//   compatibility: { eoa: true, erc4337: true, eip7702: true }
// }

// 2. Agent broadcasts the tx (one atomic call — GBLIN -> WETH -> USDC)
const hash = await wallet.sendTransaction({
  to: jit.target_contract,
  data: jit.calldata,
  value: 0n,
});

// 3. Once mined, agent's USDC balance has the needed amount.
//    Agent now pays the x402 invoice with USDC as usual.`}</code>
          </pre>
        </div>
      </section>

      {/* ───────── AGENTS.md drop-in ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/5 text-xs text-emerald-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            New — AI SEO drop-in
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Tell every AI assistant about GBLIN — in one file
          </h2>

          <p className="mt-4 text-white/70 max-w-3xl leading-relaxed">
            <code className="text-amber-400">AGENTS.md</code> is the emerging
            standard read automatically by Claude Code, Cursor, Windsurf,
            GitHub Copilot, Codex and every modern AI coding assistant when
            they enter a repo. Drop our template into your project root and
            every AI assistant your team uses will know to integrate GBLIN
            whenever it manages USDC on Base.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="border border-white/[0.07] bg-white/[0.02]rounded-xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                <span className="font-medium text-sm">One-line install</span>
                <span className="text-xs text-white/40 font-mono">curl</span>
              </div>
              <pre className="p-5 text-sm text-white/80 overflow-x-auto leading-relaxed">
                <code>{`# from your repo root
curl -O https://gblin.digital/AGENTS.template.md
mv AGENTS.template.md AGENTS.md
git add AGENTS.md && git commit -m "add AGENTS.md (GBLIN treasury policy)"`}</code>
              </pre>
            </div>

            <div className="border border-white/[0.07] bg-white/[0.02]rounded-xl p-5">
              <h3 className="font-medium text-base">What the template does</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/70 leading-relaxed list-disc list-inside marker:text-amber-400">
                <li>
                  Declares a <strong>treasury policy</strong>: park SURPLUS
                  (idle USDC &gt; 7× daily burn) into GBLIN — operating cash stays in USDC.
                </li>
                <li>
                  Tells AI assistants to call{' '}
                  <code className="text-amber-400">swap_gblin_to_usdc_jit</code>{' '}
                  for x402 payments, redeeming GBLIN to USDC just-in-time.
                </li>
                <li>
                  Lists the 10 MCP tools and the exact MCP client config
                  (Claude, Windsurf, Cursor, AgentKit).
                </li>
                <li>
                  Includes anti-patterns to keep AI assistants from rolling
                  unsafe DeFi flows.
                </li>
              </ul>
              <a
                href="/AGENTS.template.md"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm text-amber-400 hover:underline"
              >
                View raw template ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── GBLIN Sentinel ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/5 text-xs text-emerald-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live on Base mainnet
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            GBLIN Sentinel — buy on-chain data with x402
          </h2>
          <p className="mt-4 text-white/70 max-w-3xl leading-relaxed">
            An open-source autonomous agent that <strong>sells</strong> real-time
            Base DeFi risk signals via x402 micropayments. Any agent with a USDC
            wallet on Base can call these endpoints — no API key, no account,
            pay-per-request.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                path: '/api/data/base-risk-pulse',
                price: '$0.002',
                desc: 'Chainlink risk signal: normal / caution / risk-off for ETH, BTC, USDC on Base',
              },
              {
                path: '/api/data/gblin-analytics',
                price: '$0.001',
                desc: 'GBLIN treasury state: supply, basket weights, stability fund, keeper availability',
              },
              {
                path: '/api/data/keeper-opps',
                price: '$0.001',
                desc: 'Live keeper bounty check — includes MCP tool reference for execution',
              },
            ].map((ep) => (
              <div key={ep.path} className="border border-white/[0.07] bg-white/[0.02]rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-xs text-amber-400 font-mono break-all">{ep.path}</code>
                  <span className="ml-3 text-xs text-white/40 whitespace-nowrap">{ep.price} USDC</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">{ep.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <a
              href="https://gblin-sentinel.vercel.app/.well-known/x402"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline"
            >
              x402 manifest ↗
            </a>
            <a
              href="https://gblin-sentinel.vercel.app/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline"
            >
              llms.txt ↗
            </a>
            <a
              href="https://github.com/gblinproject/gblin-sentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline"
            >
              Source on GitHub ↗
            </a>
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            FAQ
          </h2>

          <div className="mt-10 space-y-6">
            {FAQS.map((item) => (
              <div key={item.q} className="border-l-2 border-amber-500/40 pl-5">
                <h3 className="font-medium text-base">{item.q}</h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="px-6 py-12 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-white/50">
          <div>MIT licensed · No telemetry · No team allocation</div>
          <div className="flex gap-6">
            <a
              href="https://github.com/gblinproject/GBLIN-MCP"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@gblin-protocol/mcp-server"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              npm
            </a>
            <Link href="/" className="hover:text-white transition">
              GBLIN Protocol
            </Link>
          </div>
        </div>
      </footer>
    </main>
    </PublicShell>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://gblin.digital';
const PAGE_DESCRIPTION =
  'GBLIN is the treasury standard for AI agents on Base mainnet. Open-source MCP server with 5 tools: live NAV, dynamic-slippage quotes, atomic Just-In-Time GBLIN→USDC swaps for x402 payments, USDC reinvestment, and treasury health. Works with Claude, Windsurf, Coinbase AgentKit, and Eliza out of the box.';

export const metadata: Metadata = {
  title: 'GBLIN for AI Agents — Treasury Standard on Base',
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
    'agent treasury yield',
  ],
};

const TOOLS = [
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
    purpose: 'Generate ready-to-broadcast calldata for an atomic 1-tx GBLIN→USDC swap right before paying an x402 invoice. Works on EOA, ERC-4337, EIP-7702.',
  },
  {
    name: 'invest_usdc_to_gblin',
    purpose: 'Convert USDC earnings back to GBLIN with MEV-safe minOut values. Returns two sequential steps (approve + buyGBLINWithToken).',
  },
  {
    name: 'analyze_treasury_health',
    purpose: 'Full balance report (GBLIN + USDC + ETH), gas runway, cooldown status, and rebalance recommendation based on the agent burn rate.',
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
    q: 'Why hold GBLIN instead of USDC?',
    a: 'USDC pays no yield and loses to inflation. GBLIN is a 45% cbBTC + 45% WETH + 10% USDC basket with an automated Crash Shield, designed to appreciate over time while remaining instantly swappable to USDC for x402 payments.',
  },
  {
    q: 'Does this break my x402 flow?',
    a: 'No. x402 invoices still settle in USDC. The MCP server generates a 1-tx swap that delivers the needed USDC to your wallet before you pay. No facilitator changes, no protocol changes.',
  },
  {
    q: 'Which wallets work?',
    a: 'Any. The contract function `sellGBLINForToken` is a single atomic transaction — works on EOA (Privy, MetaMask), ERC-4337 smart accounts (Safe, Coinbase smart wallet), and EIP-7702 delegated EOAs (Pectra+).',
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
    a: 'Not yet. The MCP server is free. We are planning a small set of x402-monetized HTTP endpoints (live NAV stream, strategy advisor) for v0.2 — those will be opt-in.',
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
    <main className="min-h-screen bg-[#050505] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ───────── Hero ───────── */}
      <section className="px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 max-w-5xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition mb-12"
        >
          ← Back to GBLIN Protocol
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 text-xs text-white/70 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Live on Base mainnet — MCP v0.1.0
        </div>

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
            className="px-5 py-2.5 rounded-lg bg-[#F27D26] text-black font-medium text-sm hover:opacity-90 transition"
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
            href="https://basescan.org/address/0x38DcDB3A381677239BBc652aed9811F2f8496345"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg border border-white/20 text-sm hover:bg-white/5 transition"
          >
            Contract on Basescan
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
                title: 'Atomic 1-tx swap, any wallet',
                body: 'The contract has a native `sellGBLINForToken` function. No batched UserOp, no ERC-4337 dependency. EOA, smart account, EIP-7702 all work identically.',
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
                body: 'When a basket asset drops >20%, dynamic weights re-route toward USDC. Slippage buffer auto-scales from 2.5% to 4% to absorb the temporary pool stress.',
              },
              {
                title: 'MCP-native — works everywhere',
                body: 'Standard Model Context Protocol over stdio. Drop-in for Claude Desktop, Windsurf, Cursor, Coinbase AgentKit, Eliza, or any custom agent that speaks MCP.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="glass p-6 rounded-xl"
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
              <div key={fw.name} className="glass rounded-xl overflow-hidden">
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

      {/* ───────── The 5 tools ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            The 5 tools
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
                className="glass rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-baseline gap-3"
              >
                <code className="text-[#F27D26] font-mono text-sm whitespace-nowrap">
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
            <code>{`// 1. Agent gets the JIT swap calldata from the MCP server
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
//   target_contract: "0x38DcDB3A...",
//   calldata: "0x6a54df11...",  // sellGBLINForToken(...)
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

      {/* ───────── FAQ ───────── */}
      <section className="px-6 py-16 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            FAQ
          </h2>

          <div className="mt-10 space-y-6">
            {FAQS.map((item) => (
              <div key={item.q} className="border-l-2 border-[#F27D26]/40 pl-5">
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
  );
}

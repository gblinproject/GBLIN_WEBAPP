/**
 * Turns a revert of the ETH exit (or of a mint) into a sentence for the visitor. The selectors are those of
 * the vault, the Zap and the swap adapter in service; anything else falls back to the raw message.
 */
const REASONS: Record<string, string> = {
  '0x6a9907a3': 'The pool price is moving away from its 5-minute average, and the swap adapter refuses to trade until it settles (its guard against manipulation). Retry in a minute, or redeem in basket tokens, which needs no swap.',
  '0xcb08be81': 'A price feed is older than the vault allows for a trade (30 minutes). Retry after the next feed update, or redeem in basket tokens, which needs no price.',
  '0x8199f5f3': 'The output fell below your minimum. Raise the slippage tolerance or retry in a moment.',
  '0x4d01231d': 'One basket leg could not be sold at the required price, so the exit was refused as a whole. Retry, or redeem in basket tokens.',
  '0x032b3d00': 'Base sequencer unavailable. Try again later.',
  '0xaa9a98df': 'Cooldown active: wait 20 seconds after your last deposit.',
  '0x1c26714c': 'The transaction was sent with too little gas. Retry: the page sets the limit itself.',
  '0xf4d678b8': 'Amount exceeds your GBLIN balance.',
  '0x13be252b': 'The Zap is not allowed to pull that many shares. Retry: the page asks for the approval first.',
  '0xf591b277': 'No pool found for one of the basket legs.',
  '0xf2ce93c5': 'The pool delivered nothing for one of the basket legs.',
  '0x90654b60': 'The receiver refused the ETH.',
};

/** The 4-byte selector carried by a revert, wherever the library put it. */
export function revertSelector(error: unknown): string | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [error];
  while (stack.length) {
    const e = stack.pop();
    if (!e || typeof e !== 'object' || seen.has(e)) continue;
    seen.add(e);
    const o = e as Record<string, unknown>;
    for (const key of ['data', 'error', 'info', 'cause', 'body', 'payload', 'walk']) {
      const v = o[key];
      if (typeof v === 'string') {
        const m = v.match(/0x[0-9a-fA-F]{8}/);
        if (m && /^0x[0-9a-fA-F]{8}/.test(v)) return m[0].toLowerCase();
      } else if (v && typeof v === 'object') stack.push(v);
    }
    if (typeof o.message === 'string') {
      const m = o.message.match(/(?:data|reverted)[^0-9a-fx]*(0x[0-9a-fA-F]{8})/);
      if (m) return m[1].toLowerCase();
    }
  }
  return null;
}

/** A sentence for the visitor, or null when the revert is not one the page knows. */
export function exitRevertReason(error: unknown): string | null {
  const sel = revertSelector(error);
  return sel ? REASONS[sel] ?? null : null;
}

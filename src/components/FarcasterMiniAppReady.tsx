"use client";

import { useEffect } from "react";

/**
 * Calls sdk.actions.ready() when running inside a Farcaster Mini App host.
 * This hides the splash screen and reveals the actual app content.
 * Outside of a Farcaster client this is a no-op.
 *
 * Reference: https://miniapps.farcaster.xyz/docs/getting-started
 */
export default function FarcasterMiniAppReady() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;
        await sdk.actions.ready();
      } catch (err) {
        // Not running inside a Farcaster host — silently ignore.
        // eslint-disable-next-line no-console
        console.debug("[farcaster] miniapp ready skipped:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

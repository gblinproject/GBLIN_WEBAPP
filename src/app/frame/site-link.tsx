"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Links from the mini app to the website.
 *
 * Inside a Farcaster or Base App host a plain `target="_blank"` link is not reliable, so the host is
 * asked to open the page (`sdk.actions.openUrl`). Outside a host the anchor behaves normally. The
 * href is always the real address, so the link can be read, copied and opened by hand.
 */

export const SITE_URL = "https://gblin.digital";

let insidePromise: Promise<boolean> | null = null;

/** Whether the page runs inside a mini app host. Resolved once per page load. */
export function detectMiniApp(): Promise<boolean> {
  if (!insidePromise) {
    insidePromise = import("@farcaster/miniapp-sdk")
      .then(({ sdk }) => sdk.isInMiniApp())
      .catch(() => false);
  }
  return insidePromise;
}

/** Opens a page of the site (a path such as "/about") or a full URL, through the host when there is one. */
export async function openSite(pathOrUrl: string): Promise<void> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
  if (await detectMiniApp()) {
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.openUrl(url);
      return;
    } catch {
      /* fall through to the browser */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function SiteLink({
  path,
  children,
  style,
}: {
  path: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [inside, setInside] = useState(false);
  useEffect(() => {
    let cancelled = false;
    detectMiniApp().then((v) => {
      if (!cancelled) setInside(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const href = path.startsWith("http") ? path : `${SITE_URL}${path}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!inside) return;
        e.preventDefault();
        void openSite(href);
      }}
      style={style}
    >
      {children}
    </a>
  );
}

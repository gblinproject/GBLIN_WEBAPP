"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Offers to add GBLIN to the viewer's mini apps through the host's own dialog
 * (`sdk.actions.addMiniApp`). It renders only inside a mini app host, and only while the app has
 * not been added. A refusal leaves the button in place, so the viewer can change their mind.
 */

type Status = "hidden" | "idle" | "adding" | "added";

export default function AddMiniApp() {
  const [status, setStatus] = useState<Status>("hidden");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (!(await sdk.isInMiniApp())) return;
        const context = await sdk.context;
        if (!cancelled && !context.client.added) setStatus("idle");
      } catch {
        /* Without a readable host context the button stays hidden. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAdd = async () => {
    setStatus("adding");
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.addMiniApp();
      setStatus("added");
    } catch {
      setStatus("idle");
    }
  };

  if (status === "hidden") return null;

  if (status === "added") {
    return (
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          padding: "11px",
          borderRadius: 12,
          color: "#a7f3d0",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        <Check size={15} /> Added to your apps
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      disabled={status === "adding"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "13px",
        borderRadius: 13,
        border: "1px solid rgba(251,191,36,0.5)",
        background: "rgba(251,191,36,0.12)",
        color: "#fde68a",
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      <Plus size={16} /> {status === "adding" ? "Opening…" : "Add GBLIN to your apps"}
    </button>
  );
}

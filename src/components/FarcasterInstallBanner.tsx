"use client";

import { useEffect, useState } from "react";
import { X, BellRing, Download } from "lucide-react";

interface FarcasterSdk {
  actions: {
    ready: () => Promise<void>;
    addFrame: () => Promise<{ added: boolean }>;
    subscribeToNotifications: () => Promise<{ subscribed: boolean }>;
  };
}

export default function FarcasterInstallBanner() {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [sdk, setSdk] = useState<FarcasterSdk | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { sdk: farcasterSdk } = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;

        setSdk(farcasterSdk as FarcasterSdk);
        setIsFarcaster(true);

        // Chiama ready() per nascondere lo splash screen
        await farcasterSdk.actions.ready();

        // Mostra il banner dopo 1 secondo
        setTimeout(() => {
          if (!cancelled) setShowBanner(true);
        }, 1000);
      } catch {
        // Non siamo in Farcaster
        setIsFarcaster(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddFrame = async () => {
    if (!sdk) return;
    try {
      const result = await sdk.actions.addFrame();
      if (result.added) {
        setIsInstalled(true);
      }
    } catch (err) {
      console.error("[farcaster] addFrame failed:", err);
    }
  };

  const handleSubscribe = async () => {
    if (!sdk) return;
    try {
      const result = await sdk.actions.subscribeToNotifications();
      if (result.subscribed) {
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error("[farcaster] subscribe failed:", err);
    }
  };

  const handleClose = () => {
    setShowBanner(false);
  };

  if (!isFarcaster || !showBanner) return null;

  // Se tutto è già fatto, non mostrare nulla
  if (isInstalled && isSubscribed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold text-sm">GBLIN Mini App</h3>
            <p className="text-zinc-400 text-xs mt-0.5">
              Installa nel tuo profilo per accesso immediato
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2">
          {!isInstalled && (
            <button
              onClick={handleAddFrame}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <Download size={16} />
              Installa nel Profilo
            </button>
          )}

          {!isSubscribed && (
            <button
              onClick={handleSubscribe}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors border border-zinc-600"
            >
              <BellRing size={16} />
              Attiva Notifiche
            </button>
          )}
        </div>

        {isInstalled && (
          <p className="text-green-400 text-xs mt-2 text-center">
            ✓ Installato nel profilo
          </p>
        )}
        {isSubscribed && (
          <p className="text-green-400 text-xs mt-2 text-center">
            ✓ Notifiche attive
          </p>
        )}
      </div>
    </div>
  );
}

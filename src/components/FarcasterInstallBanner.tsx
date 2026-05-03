"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

type FarcasterSdk = import("@farcaster/miniapp-sdk").sdk;

export default function FarcasterInstallBanner() {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [sdkRef, setSdkRef] = useState<typeof FarcasterSdk | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;

        const farcasterSdk = mod.sdk;
        const inApp = await farcasterSdk.isInMiniApp();
        if (!inApp) return;

        setSdkRef(farcasterSdk);
        setIsFarcaster(true);

        // Nascondi splash screen
        await farcasterSdk.actions.ready();

        // Ascolta evento notifiche abilitate
        farcasterSdk.on("notificationsEnabled", () => {
          setIsNotifEnabled(true);
        });
        farcasterSdk.on("miniAppAdded", () => {
          setIsInstalled(true);
        });

        // Mostra banner dopo 1 secondo
        setTimeout(() => {
          if (!cancelled) setShowBanner(true);
        }, 1000);
      } catch {
        // Non siamo in Farcaster
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddFrame = async () => {
    if (!sdkRef) return;
    try {
      await sdkRef.actions.addFrame();
    } catch (err) {
      console.error("[farcaster] addFrame failed:", err);
    }
  };

  const handleClose = () => {
    setShowBanner(false);
  };

  if (!isFarcaster || !showBanner) return null;

  if (isInstalled) return null;

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

        <button
          onClick={handleAddFrame}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          <Download size={16} />
          Installa nel Profilo
        </button>

        {isNotifEnabled && (
          <p className="text-green-400 text-xs mt-2 text-center">
            ✓ Notifiche attive
          </p>
        )}
      </div>
    </div>
  );
}

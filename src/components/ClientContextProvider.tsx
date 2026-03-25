"use client";

import dynamic from "next/dynamic";

export const ClientContextProvider = dynamic(() => import("@/context").then(mod => mod.ContextProvider), {
  ssr: false,
});

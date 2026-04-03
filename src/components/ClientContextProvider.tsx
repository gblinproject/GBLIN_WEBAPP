"use client";

import type { ReactNode } from "react";
import { ContextProvider } from "@/context";

export function ClientContextProvider({ children, cookies }: { children: ReactNode; cookies?: string | null }) {
  return <ContextProvider cookies={cookies}>{children}</ContextProvider>;
}

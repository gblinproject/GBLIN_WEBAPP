"use client";

import type { ReactNode } from "react";
import { ContextProvider } from "@/context";

export function ClientContextProvider({ children }: { children: ReactNode }) {
  return <ContextProvider>{children}</ContextProvider>;
}

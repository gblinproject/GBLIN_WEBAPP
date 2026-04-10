"use client";

import { ThirdwebProvider } from "thirdweb/react";
import React from 'react';

export function ContextProvider({ children, cookies }: { children: React.ReactNode; cookies?: string | null }) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </TooltipProvider>
      </AuthProvider>
    </NextThemesProvider>
  );
}

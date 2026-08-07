"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen w-full overflow-x-hidden">
          <AppSidebar />
          <SidebarInset className="min-w-0 overflow-x-hidden">
            <AppHeader />
            <main className="min-w-0 flex-1 overflow-x-hidden bg-muted/20">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}

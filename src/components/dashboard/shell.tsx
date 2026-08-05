import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/dashboard/topbar";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-transparent">
          <SetupBanner />
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


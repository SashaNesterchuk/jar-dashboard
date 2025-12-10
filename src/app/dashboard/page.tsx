import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import data from "./data.json";
import { Onboarding } from "@/components/onboarding";
import { PracticeTable } from "@/components/practice-table";
import { UsersTable } from "@/components/users-table";
import { Checkin } from "@/components/checkin";

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <h2 className="text-2xl font-bold px-4 lg:px-6">Onboarding</h2>
              <Onboarding />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Practices</h2>
              <PracticeTable />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Users</h2>
              <UsersTable />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Checkin</h2>
              <Checkin />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

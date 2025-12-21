import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { ChartHoursInteractive } from "@/components/chart-hours-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import data from "./data.json";
import { Onboarding } from "@/components/onboarding";
import { PracticeTable } from "@/components/practice-table";
import { UsersTable } from "@/components/users-table";
import { Checkin } from "@/components/checkin";
import { Retention } from "@/components/retention";
import { Engagement } from "@/components/engagement";
import { RevenueErrors } from "@/components/revenue-errors";

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
              <Tabs defaultValue="visitors" className="w-full flex-col gap-6">
                <div className="flex items-center justify-between px-4 lg:px-6">
                  <Label htmlFor="chart-selector" className="sr-only">
                    Chart
                  </Label>
                  <Select defaultValue="visitors">
                    <SelectTrigger
                      className="flex w-fit @4xl/main:hidden"
                      size="sm"
                      id="chart-selector"
                    >
                      <SelectValue placeholder="Select a chart" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visitors">Daily Visitors</SelectItem>
                      <SelectItem value="hours">Activity by Hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <TabsList className="hidden @4xl/main:flex">
                    <TabsTrigger value="visitors">Daily Visitors</TabsTrigger>
                    <TabsTrigger value="hours">Activity by Hour</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="visitors" className="px-4 lg:px-6">
                  <ChartAreaInteractive />
                </TabsContent>
                <TabsContent value="hours" className="px-4 lg:px-6">
                  <ChartHoursInteractive />
                </TabsContent>
              </Tabs>
              <h2 className="text-2xl font-bold px-4 lg:px-6">Onboarding</h2>
              <Onboarding />
              {/* <h2 className="text-2xl font-bold px-4 lg:px-6">
                Habits & Engagement
              </h2>
              <Engagement />
              <h2 className="text-2xl font-bold px-4 lg:px-6">
                Retention & Cohorts
              </h2>
              <Retention /> */}
              <h2 className="text-2xl font-bold px-4 lg:px-6">Practices</h2>
              <PracticeTable />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Users</h2>
              <UsersTable />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Checkin</h2>
              <Checkin />
              <h2 className="text-2xl font-bold px-4 lg:px-6">
                Revenue Errors
              </h2>
              <RevenueErrors />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

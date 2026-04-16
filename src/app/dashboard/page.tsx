 "use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { ChartHoursInteractive } from "@/components/chart-hours-interactive";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { Onboarding } from "@/components/onboarding";
import { PracticeTable } from "@/components/practice-table";
import { UsersTable } from "@/components/users-table";
import { Checkin } from "@/components/checkin";
import { RevenueErrors } from "@/components/revenue-errors";
import { Reflections } from "@/components/reflections";
import { DashboardV2 } from "@/components/dashboard-v2";

export default function Page() {
  const [analyticsVersion, setAnalyticsVersion] = React.useState<"v1" | "v2">(
    "v2"
  );
  const [isExportingLogs, setIsExportingLogs] = React.useState(false);

  const handleExportLogs = React.useCallback(async () => {
    try {
      setIsExportingLogs(true);

      const response = await fetch("/api/analytics-v2-logs/export", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const contentDisposition = response.headers.get("Content-Disposition");
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      link.download = match?.[1] || "analytics-v2-logs.txt";
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export analytics v2 logs:", error);
    } finally {
      setIsExportingLogs(false);
    }
  }, []);

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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="analytics-version-selector">
                      Analytics Version
                    </Label>
                    <Select
                      value={analyticsVersion}
                      onValueChange={(value) =>
                        setAnalyticsVersion(value as "v1" | "v2")
                      }
                    >
                      <SelectTrigger
                        id="analytics-version-selector"
                        className="w-28"
                        size="sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="v2">v2</SelectItem>
                        <SelectItem value="v1">v1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportLogs}
                    disabled={isExportingLogs}
                  >
                    {isExportingLogs ? "Exporting..." : "Export logs"}
                  </Button>
                </div>
              </div>
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
              <Onboarding analyticsVersion={analyticsVersion} />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Dashboard</h2>
              <DashboardV2 analyticsVersion={analyticsVersion} />
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
              <Checkin analyticsVersion={analyticsVersion} />
              <h2 className="text-2xl font-bold px-4 lg:px-6">Reflections</h2>
              <Reflections analyticsVersion={analyticsVersion} />
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

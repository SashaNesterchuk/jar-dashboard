"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import { CardBlock } from "./custom/card-block";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Metric = {
  value: number;
  previous: number;
  delta: number;
  change: string;
};

type DashboardV2Data = {
  viewed: Metric;
  elementPressed: Metric;
  streakPressed: Metric;
  eventPressed: Metric;
  moodSelectedDashboard: Metric;
  premiumGetPremium: Metric;
  premiumDismissed: Metric;
  addPracticePressed: Metric;
  addPracticeSheetOpened: Metric;
  practiceTypeSelected: Metric;
  practiceTemplateSelected: Metric;
  elementTypes: Array<{ elementType: string; count: number }>;
  practiceTypes: Array<{ practiceType: string; count: number }>;
};

function emptyMetric(): Metric {
  return { value: 0, previous: 0, delta: 0, change: "+0.0%" };
}

function getPeriodText(range: string): string {
  switch (range) {
    case "7d":
      return "vs Previous 7 days";
    case "30d":
      return "vs Previous 30 days";
    case "90d":
      return "vs Previous 3 months";
    default:
      return "vs Previous period";
  }
}

export function DashboardV2({
  analyticsVersion = "v2",
}: {
  analyticsVersion?: "v1" | "v2";
}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [data, setData] = React.useState<DashboardV2Data | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchData = React.useCallback(
    async (range: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/dashboard-v2?timeRange=${range}&analyticsVersion=${analyticsVersion}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard v2 data");
        }
        const json = (await response.json()) as DashboardV2Data;
        setData(json);
      } catch (error) {
        console.error("Error fetching dashboard v2 data:", error);
        setData({
          viewed: emptyMetric(),
          elementPressed: emptyMetric(),
          streakPressed: emptyMetric(),
          eventPressed: emptyMetric(),
          moodSelectedDashboard: emptyMetric(),
          premiumGetPremium: emptyMetric(),
          premiumDismissed: emptyMetric(),
          addPracticePressed: emptyMetric(),
          addPracticeSheetOpened: emptyMetric(),
          practiceTypeSelected: emptyMetric(),
          practiceTemplateSelected: emptyMetric(),
          elementTypes: [],
          practiceTypes: [],
        });
      } finally {
        setIsLoading(false);
      }
    },
    [analyticsVersion]
  );

  React.useEffect(() => {
    fetchData(timeRange);
  }, [timeRange, fetchData]);

  const resolved = data ?? {
    viewed: emptyMetric(),
    elementPressed: emptyMetric(),
    streakPressed: emptyMetric(),
    eventPressed: emptyMetric(),
    moodSelectedDashboard: emptyMetric(),
    premiumGetPremium: emptyMetric(),
    premiumDismissed: emptyMetric(),
    addPracticePressed: emptyMetric(),
    addPracticeSheetOpened: emptyMetric(),
    practiceTypeSelected: emptyMetric(),
    practiceTemplateSelected: emptyMetric(),
    elementTypes: [],
    practiceTypes: [],
  };

  return (
    <div className="space-y-4 px-4 lg:px-6">
      <div className="flex items-center justify-end">
        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={(value) => value && setTimeRange(value)}
          className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
        >
          <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
          <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
          <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
        </ToggleGroup>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
            size="sm"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <CardBlock
          title="Dashboard Viewed"
          value={isLoading ? 0 : resolved.viewed.value}
          delta={resolved.viewed.delta}
          previous={resolved.viewed.previous}
          period={getPeriodText(timeRange)}
        />
        <CardBlock
          title="Element Pressed"
          value={isLoading ? 0 : resolved.elementPressed.value}
          delta={resolved.elementPressed.delta}
          previous={resolved.elementPressed.previous}
          period={getPeriodText(timeRange)}
        />
        <CardBlock
          title="Streak Pressed"
          value={isLoading ? 0 : resolved.streakPressed.value}
          delta={resolved.streakPressed.delta}
          previous={resolved.streakPressed.previous}
          period={getPeriodText(timeRange)}
        />
        <CardBlock
          title="Practice Card Pressed"
          value={isLoading ? 0 : resolved.eventPressed.value}
          delta={resolved.eventPressed.delta}
          previous={resolved.eventPressed.previous}
          period={getPeriodText(timeRange)}
        />
        <CardBlock
          title="Mood Selected (Dashboard)"
          value={isLoading ? 0 : resolved.moodSelectedDashboard.value}
          delta={resolved.moodSelectedDashboard.delta}
          previous={resolved.moodSelectedDashboard.previous}
          period={getPeriodText(timeRange)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                <TableHead>Premium Banner / Add Practice Funnel</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Prev</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>premium_banner_get_premium</TableCell>
                <TableCell className="text-right">
                  {resolved.premiumGetPremium.value.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.premiumGetPremium.previous.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.premiumGetPremium.change}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>premium_banner_dismissed</TableCell>
                <TableCell className="text-right">
                  {resolved.premiumDismissed.value.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.premiumDismissed.previous.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.premiumDismissed.change}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>add_practice_pressed</TableCell>
                <TableCell className="text-right">
                  {resolved.addPracticePressed.value.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.addPracticePressed.previous.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.addPracticePressed.change}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>add_practice_sheet_opened</TableCell>
                <TableCell className="text-right">
                  {resolved.addPracticeSheetOpened.value.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.addPracticeSheetOpened.previous.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.addPracticeSheetOpened.change}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>practice_type_selected</TableCell>
                <TableCell className="text-right">
                  {resolved.practiceTypeSelected.value.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.practiceTypeSelected.previous.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.practiceTypeSelected.change}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>practice_template_selected</TableCell>
                <TableCell className="text-right">
                  {resolved.practiceTemplateSelected.value.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.practiceTemplateSelected.previous.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {resolved.practiceTemplateSelected.change}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                <TableHead>dashboard_element_pressed breakdown</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolved.elementTypes.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    No data
                  </TableCell>
                  <TableCell className="text-right">0</TableCell>
                </TableRow>
              ) : (
                resolved.elementTypes.map((row) => (
                  <TableRow key={row.elementType}>
                    <TableCell>{row.elementType}</TableCell>
                    <TableCell className="text-right">
                      {row.count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              <TableHead>practice_type_selected breakdown</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolved.practiceTypes.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground">No data</TableCell>
                <TableCell className="text-right">0</TableCell>
              </TableRow>
            ) : (
              resolved.practiceTypes.map((row) => (
                <TableRow key={row.practiceType}>
                  <TableCell>{row.practiceType}</TableCell>
                  <TableCell className="text-right">
                    {row.count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

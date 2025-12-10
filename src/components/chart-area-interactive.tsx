"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const description = "An interactive area chart";

interface VisitorsData {
  date: string;
  allUsers: number;
  newUsers: number;
}

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  allUsers: {
    label: "All Users",
    color: "var(--chart-3)",
  },
  newUsers: {
    label: "New Users",
    color: "var(--color-green-400)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("7d");
  const [visitorsData, setVisitorsData] = React.useState<VisitorsData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const fetchVisitorsData = React.useCallback(async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/visitors?timeRange=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch visitors data");
      }

      const data = await response.json();
      // Transform data to match chart format (allUsers and newUsers)
      const transformedData = data.map((item: VisitorsData) => ({
        date: item.date,
        allUsers: item.allUsers,
        newUsers: item.newUsers,
      }));
      setVisitorsData(transformedData);
    } catch (error) {
      console.error("Error fetching visitors data:", error);
      setVisitorsData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchVisitorsData(timeRange);
  }, [timeRange, fetchVisitorsData]);

  console.log(visitorsData);

  const getPeriodDescription = (range: string): string => {
    switch (range) {
      case "7d":
        return "Last 7 days";
      case "30d":
        return "Last 30 days";
      case "90d":
        return "Last 3 months";
      default:
        return "Last 3 months";
    }
  };

  const filteredData = visitorsData;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Visitors</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {isLoading
              ? "Loading..."
              : `Total for ${getPeriodDescription(timeRange)}`}
          </span>
          <span className="@[540px]/card:hidden">
            {isLoading ? "Loading..." : getPeriodDescription(timeRange)}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
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
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={isLoading ? [] : filteredData}>
            <defs>
              <linearGradient id="fillAllUsers" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-allUsers)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-allUsers)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillNewUsers" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-newUsers)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-newUsers)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="allUsers"
              type="natural"
              fill="url(#fillAllUsers)"
              stroke="var(--color-allUsers)"
            />
            <Area
              dataKey="newUsers"
              type="natural"
              fill="url(#fillNewUsers)"
              stroke="var(--color-newUsers)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

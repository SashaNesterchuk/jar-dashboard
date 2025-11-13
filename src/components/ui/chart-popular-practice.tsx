"use client";

import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "A step area chart";

// const chartData = [
//   { month: "January", desktop: 186 },
//   { month: "February", desktop: 305 },
//   { month: "March", desktop: 237 },
//   { month: "April", desktop: 73 },
//   { month: "May", desktop: 209 },
//   { month: "June", desktop: 214 },
// ];

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
    icon: Activity,
  },
} satisfies ChartConfig;

interface ChartPopularPracticeProps {
  title: string;
  pages: string[];
  pageData?: Record<string, number>;
  timeRange?: string;
}

function getPeriodDescription(timeRange?: string): string {
  switch (timeRange) {
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 3 months";
    default:
      return "Last 6 months";
  }
}

export function ChartPopularPractice({
  title,
  pages,
  pageData,
  timeRange,
}: ChartPopularPracticeProps) {
  // Check if we're showing practice types (not onboarding pages)
  const isPracticeTypes =
    pages.includes("breathing") ||
    pages.includes("meditation") ||
    pages.includes("journaling") ||
    pages.includes("self-discovery") ||
    pages.includes("checkin");

  // Build chart data from pages array and pageData
  const chartData = pages.map((page, index) => {
    // For "1.2" page, use the value from "1" if available
    let count = 0;
    if (pageData) {
      if (page === "1.2") {
        count = pageData["1"] || 0;
      } else {
        count = pageData[page] || 0;
      }
    }
    return {
      page,
      count,
    };
  });

  // For practice types, show completion counts; for onboarding, show drop-off percentages
  const chartDataForDisplay = isPracticeTypes
    ? chartData.map((item) => ({
        ...item,
        value: item.count,
      }))
    : (() => {
        // Get the first page count as baseline (100%)
        const firstPageCount = chartData.length > 0 ? chartData[0].count : 0;

        // Calculate drop-off percentage (percentage of people who left from first page)
        return chartData.map((item, index) => {
          if (index === 0) {
            // First page always 0% drop-off (baseline at bottom)
            return {
              ...item,
              dropOffPercentage: 0,
            };
          } else {
            // Calculate drop-off percentage from first page
            const dropOffPercentage =
              firstPageCount > 0
                ? ((firstPageCount - item.count) / firstPageCount) * 100
                : 0;
            return {
              ...item,
              dropOffPercentage: Math.round(dropOffPercentage * 10) / 10, // Round to 1 decimal
            };
          }
        });
      })();

  // Find most popular practice type (highest count)
  let mostPopularPracticeType = pages[0];
  let maxCount = 0;

  if (pageData && chartData.length > 0) {
    chartData.forEach((item) => {
      if (item.count > maxCount) {
        maxCount = item.count;
        mostPopularPracticeType = item.page;
      }
    });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Showing popular practices for {getPeriodDescription(timeRange)}
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full px-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartDataForDisplay}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="page"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                isPracticeTypes ? value : value.slice(0, 3)
              }
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
              formatter={(value: number) =>
                isPracticeTypes
                  ? [`${value}`, "Completions"]
                  : [`${value}%`, "Drop-off"]
              }
            />
            <Area
              dataKey={isPracticeTypes ? "value" : "dropOffPercentage"}
              type="step"
              fill="var(--color-desktop)"
              fillOpacity={0.4}
              stroke="var(--color-desktop)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            {mostPopularPracticeType ? (
              <div className="flex items-center gap-2 leading-none font-medium">
                Most popular practice type: {mostPopularPracticeType}
                <TrendingUp className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex items-center gap-2 leading-none font-medium text-muted-foreground">
                No popular practice type data available
              </div>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

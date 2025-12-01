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

interface ChartAreaStepProps {
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

export function ChartAreaStep({
  title,
  pages,
  pageData,
  timeRange,
}: ChartAreaStepProps) {
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

  // Calculate drop-off percentage relative to the previous step
  // First page is always 0% (no drop-off yet), subsequent pages show drop-off vs previous page
  const chartDataWithPercentages = chartData.map((item, index) => {
    if (index === 0) {
      // First page always 0% drop-off (baseline at bottom)
      return {
        ...item,
        dropOffPercentage: 0,
      };
    } else {
      const previousCount = chartData[index - 1]?.count ?? 0;
      const dropOffPercentage =
        previousCount > 0
          ? Math.max(((previousCount - item.count) / previousCount) * 100, 0)
          : 0;
      return {
        ...item,
        dropOffPercentage: Math.round(dropOffPercentage * 10) / 10, // Round to 1 decimal
      };
    }
  });

  // Calculate drop-off rates and find worst page
  let worstPage = pages[0];
  let maxDropOff = 0;

  if (pageData && chartData.length > 1) {
    for (let i = 1; i < chartData.length; i++) {
      const currentCount = chartData[i].count;
      const previousCount = chartData[i - 1].count;

      if (previousCount > 0) {
        const dropOff = ((previousCount - currentCount) / previousCount) * 100;
        if (dropOff > maxDropOff) {
          maxDropOff = dropOff;
          worstPage = chartData[i].page;
        }
      }
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Showing drop-off percentage from the previous step for{" "}
          {getPeriodDescription(timeRange)}
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full px-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartDataWithPercentages}
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
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
              formatter={(value: number) => [`${value}%`, "Drop-off"]}
            />
            <Area
              dataKey="dropOffPercentage"
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
            {maxDropOff > 0 ? (
              <div className="flex items-center gap-2 leading-none font-medium">
                Highest drop-off: {worstPage} ({maxDropOff.toFixed(1)}%)
                <TrendingDown className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex items-center gap-2 leading-none font-medium text-muted-foreground">
                No drop-off data available
              </div>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

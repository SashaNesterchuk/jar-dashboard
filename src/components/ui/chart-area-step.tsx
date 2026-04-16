"use client";

import * as React from "react";
import { Activity, TrendingDown } from "lucide-react";
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
  /** When true, loads `/screens/<page>.png` under each step (see public/screens/README.md). */
  stepScreens?: boolean;
  /** Base path for step images (no trailing slash). Default: `/screens`. */
  stepScreensBasePath?: string;
}

function stepScreenSrc(
  page: string,
  basePath: string
): string {
  const name = encodeURIComponent(page);
  return `${basePath}/${name}.png`;
}

function StepScreenPreview({
  page,
  src,
}: {
  page: string;
  src: string;
}) {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <span className="max-w-[140px] truncate text-center text-xs font-medium text-muted-foreground">
        {page}
      </span>
      <div className="flex h-[200px] w-full max-w-[160px] items-center justify-center overflow-hidden rounded-md border bg-muted/40">
        {failed ? (
          <span className="px-2 text-center text-[10px] leading-tight text-muted-foreground">
            No preview
            <br />
            <code className="text-[9px] opacity-80">{page}.png</code>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- local static screenshots, variable aspect ratio
          <img
            src={src}
            alt={`Screen: ${page}`}
            className="max-h-[200px] w-full object-contain object-top"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
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
  stepScreens = false,
  stepScreensBasePath = "/screens",
}: ChartAreaStepProps) {
  // Build chart data from pages array and pageData
  const chartData = pages.map((page) => {
    // For "1.2" page, use the value from "1" if available
    let count = 0;
    if (pageData) {
      if (page === "1.2") {
        count =
          Object.prototype.hasOwnProperty.call(pageData, "1.2") &&
          pageData["1.2"] !== undefined
            ? Number(pageData["1.2"]) || 0
            : pageData["1"] || 0;
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

  /** Enough width per category so labels are not crushed; narrow viewports scroll horizontally. */
  const chartMinWidthPx = Math.max(pages.length * 80, 360);

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
        <p className="mb-2 px-6 text-xs text-muted-foreground md:hidden">
          Swipe horizontally to see all steps
        </p>
        <div className="w-full overflow-x-auto overflow-y-visible">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[280px] w-full min-w-0 [&_.recharts-surface]:overflow-visible"
            style={{ minWidth: chartMinWidthPx, width: "100%" }}
          >
          <AreaChart
            accessibilityLayer
            data={chartDataWithPercentages}
            margin={{
              left: 8,
              right: 12,
              top: 8,
              bottom: 4,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="page"
              type="category"
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={10}
              height={84}
              tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
              angle={-40}
              textAnchor="end"
              tickFormatter={(value) => String(value)}
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
        </div>
        {stepScreens ? (
          <div className="mt-6 w-full border-t pt-4">
            <p className="mb-3 px-6 text-xs text-muted-foreground">
              Step previews (PNG in{" "}
              <code className="rounded bg-muted px-1 py-0.5">public/screens</code>
              )
            </p>
            <div className="flex gap-3 overflow-x-auto px-6 pb-2">
              {pages.map((page) => (
                <div
                  key={page}
                  className="flex shrink-0 flex-col"
                  style={{ minWidth: "140px" }}
                >
                  <StepScreenPreview
                    page={page}
                    src={stepScreenSrc(page, stepScreensBasePath)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
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

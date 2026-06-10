"use client";

import * as React from "react";
import { Activity, TrendingDown, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
    label: "Users",
    color: "var(--chart-1)",
    icon: Activity,
  },
} satisfies ChartConfig;

interface ChartAreaStepProps {
  title: string;
  pages: string[];
  pageData?: Record<string, number>;
  /** Human-readable labels for chart axis and previews (key = page id). */
  pageLabels?: Record<string, string>;
  timeRange?: string;
  /** When true, loads `/screens/<page>.png` under each step (see public/screens/README.md). */
  stepScreens?: boolean;
  /** Base path for step images (no trailing slash). Default: `/screens`. */
  stepScreensBasePath?: string;
  /** Extra context under step preview (e.g. practice exits from Tasks). */
  stepAnnotations?: Record<string, string>;
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
  label,
  src,
  annotation,
}: {
  page: string;
  label: string;
  src: string;
  annotation?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <span className="max-w-[140px] truncate text-center text-xs font-medium text-muted-foreground">
        {label}
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
      {annotation ? (
        <pre className="mt-1 max-w-[160px] whitespace-pre-wrap rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-950 dark:text-amber-100">
          {annotation}
        </pre>
      ) : null}
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
  pageLabels,
  timeRange,
  stepScreens = false,
  stepScreensBasePath = "/screens",
  stepAnnotations,
}: ChartAreaStepProps) {
  const labelFor = (page: string) => pageLabels?.[page] ?? page;
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
      pageLabel: labelFor(page),
      count,
    };
  });

  // Find worst drop-off step (still useful for the footer summary)
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

  const peakCount = chartData.reduce(
    (max, item) => (item.count > max ? item.count : max),
    0
  );

  /** Enough width per category so labels are not crushed; narrow viewports scroll horizontally. */
  const chartMinWidthPx = Math.max(pages.length * 80, 360);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Showing number of users who viewed each step for{" "}
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
            data={chartData}
            margin={{
              left: 8,
              right: 12,
              top: 8,
              bottom: 4,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="pageLabel"
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
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
              tickFormatter={(value: number) => value.toLocaleString()}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
              formatter={(value: number) => [
                value.toLocaleString(),
                "Users",
              ]}
            />
            <Area
              dataKey="count"
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
                    label={labelFor(page)}
                    src={stepScreenSrc(page, stepScreensBasePath)}
                    annotation={stepAnnotations?.[page]}
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
            {peakCount > 0 ? (
              <div className="flex items-center gap-2 leading-none font-medium">
                Peak users: {peakCount.toLocaleString()}
                <Users className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex items-center gap-2 leading-none font-medium text-muted-foreground">
                No view data available
              </div>
            )}
            {maxDropOff > 0 ? (
              <div className="flex items-center gap-2 leading-none text-muted-foreground">
                Highest drop-off: {labelFor(worstPage)} ({maxDropOff.toFixed(1)}%)
                <TrendingDown className="h-4 w-4" />
              </div>
            ) : null}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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

export const description =
  "An interactive bar chart showing user activity by hour";

interface HourlyData {
  hour: number;
  users: number;
}

interface SessionData {
  sessionStart: string;
  userId: string;
  timezone: string;
}

const chartConfig = {
  users: {
    label: "Active Users",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function ChartHoursInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");
  const [hourlyData, setHourlyData] = React.useState<HourlyData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const fetchHourlyData = React.useCallback(async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/visitors/hours?timeRange=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch hourly data");
      }

      const sessions: SessionData[] = await response.json();

      // Debug: log first few sessions to see the data structure
      console.log("Total sessions received:", sessions.length);
      if (sessions.length > 0) {
        console.log("Sample sessions (first 5):", sessions.slice(0, 5));

        // Test timezone conversion for first session
        const testSession = sessions[0];
        const testDate = new Date(testSession.sessionStart);
        console.log("Test session conversion:", {
          sessionStart: testSession.sessionStart,
          timezone: testSession.timezone,
          utcDate: testDate.toISOString(),
          utcHour: testDate.getUTCHours(),
        });

        // Test conversion
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: testSession.timezone || "UTC",
          hour: "2-digit",
          hour12: false,
        });
        const parts = formatter.formatToParts(testDate);
        const hourPart = parts.find((part) => part.type === "hour");
        console.log("Conversion result:", {
          timezone: testSession.timezone,
          hourPart: hourPart?.value,
          allParts: parts,
        });
      }

      // Group sessions by hour using user's local timezone
      const hourUserCount = new Map<number, Set<string>>(); // hour -> Set of userIds

      sessions.forEach((session) => {
        try {
          // Parse UTC timestamp
          const utcDate = new Date(session.sessionStart);

          if (isNaN(utcDate.getTime())) {
            console.error("Invalid sessionStart:", session.sessionStart);
            return;
          }

          // Get timezone (use session timezone or fallback to UTC)
          // If timezone is empty, null, undefined, or "UTC", use UTC
          let timezone = "UTC";
          if (
            session.timezone &&
            session.timezone.trim() !== "" &&
            session.timezone !== "UTC"
          ) {
            timezone = session.timezone.trim();
          }

          // Convert to user's local timezone
          // Use a more reliable method: format the date in the target timezone and extract hour
          let hour: number;

          if (timezone === "UTC") {
            // Simple case: use UTC hour directly
            hour = utcDate.getUTCHours();
          } else {
            // Convert to target timezone
            // Create a date string in the target timezone and parse the hour
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
              hour: "2-digit",
              hour12: false,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });

            const parts = formatter.formatToParts(utcDate);
            const hourPart = parts.find((part) => part.type === "hour");

            if (!hourPart) {
              console.error(
                "Could not extract hour from session:",
                session,
                "timezone:",
                timezone
              );
              // Fallback to UTC hour
              hour = utcDate.getUTCHours();
            } else {
              hour = parseInt(hourPart.value, 10);
            }
          }

          // Debug first few sessions
          if (sessions.indexOf(session) < 3) {
            console.log("Processing session:", {
              sessionStart: session.sessionStart,
              originalTimezone: session.timezone,
              usingTimezone: timezone,
              utcHour: utcDate.getUTCHours(),
              localHour: hour,
            });
          }
          const userId = session.userId;

          if (isNaN(hour) || hour < 0 || hour > 23) {
            console.error("Invalid hour:", hour, "for session:", session);
            return;
          }

          // Track unique users per hour
          if (!hourUserCount.has(hour)) {
            hourUserCount.set(hour, new Set());
          }
          hourUserCount.get(hour)!.add(userId);
        } catch (error) {
          console.error("Error processing session:", error, session);
        }
      });

      // Convert to array format and fill missing hours
      const hourlyData: HourlyData[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const users = hourUserCount.get(hour)?.size || 0;
        hourlyData.push({ hour, users });
      }

      // Debug: log hour distribution
      console.log(
        "Hour distribution:",
        hourlyData.filter((h) => h.users > 0)
      );
      console.log(
        "Total unique users:",
        new Set(sessions.map((s) => s.userId)).size
      );

      setHourlyData(hourlyData);
    } catch (error) {
      console.error("Error fetching hourly data:", error);
      setHourlyData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHourlyData(timeRange);
  }, [timeRange, fetchHourlyData]);

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

  const formatHour = (hour: number): string => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Active Users by Hour</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {isLoading
              ? "Loading..."
              : `User activity distribution for ${getPeriodDescription(
                  timeRange
                )}`}
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
          <BarChart data={isLoading ? [] : hourlyData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatHour}
              interval={isMobile ? 3 : 0}
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
                    const hour =
                      typeof value === "number" ? value : Number(value);
                    return formatHour(hour);
                  }}
                  indicator="dot"
                />
              }
            />
            <Bar
              dataKey="users"
              fill="var(--color-users)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

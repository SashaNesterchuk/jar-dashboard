"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardBlock } from "./custom/card-block";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface EngagementMetric {
  value: number;
  previous: number;
  delta: number;
}

interface UserDistribution {
  bucket: string;
  count: number;
  percentage: number;
}

interface EngagementData {
  sessionsPerDAU: EngagementMetric;
  engagedSessionsRate: EngagementMetric;
  avgSessionDuration: EngagementMetric;
  userDistribution: {
    practices: UserDistribution[];
  };
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0s";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  } else if (remainingSeconds === 0) {
    return `${minutes}m`;
  } else {
    return `${minutes}m ${remainingSeconds}s`;
  }
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

export function Engagement() {
  const [timeRange, setTimeRange] = React.useState("30d");
  const [data, setData] = React.useState<EngagementData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/engagement/summary?timeRange=${timeRange}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Error fetching engagement data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  return (
    <div className="space-y-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Engagement Summary</h3>
          <p className="text-sm text-muted-foreground">
            Track user engagement and activity depth
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="engagement-time-range" className="text-sm">
            Period:
          </Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger id="engagement-time-range" className="w-[120px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading engagement data...</p>
        </div>
      ) : data ? (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
            <CardBlock
              title="Sessions per DAU"
              value={data.sessionsPerDAU.value.toFixed(2)}
              change={
                data.sessionsPerDAU.delta >= 0
                  ? `+${data.sessionsPerDAU.delta.toFixed(1)}%`
                  : `${data.sessionsPerDAU.delta.toFixed(1)}%`
              }
              period={`vs previous ${timeRange}`}
              delta={data.sessionsPerDAU.delta}
              previous={data.sessionsPerDAU.previous}
            />
            <CardBlock
              title="Engaged Sessions Rate"
              value={`${(data.engagedSessionsRate.value * 100).toFixed(1)}%`}
              change={
                data.engagedSessionsRate.delta >= 0
                  ? `+${data.engagedSessionsRate.delta.toFixed(1)}%`
                  : `${data.engagedSessionsRate.delta.toFixed(1)}%`
              }
              period={`vs previous ${timeRange}`}
              delta={data.engagedSessionsRate.delta}
              previous={data.engagedSessionsRate.previous * 100}
            />
            <CardBlock
              title="Avg Session Duration"
              value={formatDuration(data.avgSessionDuration.value)}
              change={
                data.avgSessionDuration.delta >= 0
                  ? `+${data.avgSessionDuration.delta.toFixed(1)}%`
                  : `${data.avgSessionDuration.delta.toFixed(1)}%`
              }
              period={`vs previous ${timeRange}`}
              delta={data.avgSessionDuration.delta}
              previous={data.avgSessionDuration.previous}
            />
          </div>

          {/* User Distribution Chart */}
          {data.userDistribution.practices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Completed Practices</CardTitle>
                <CardDescription>
                  How users are distributed by the number of practices they
                  complete
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.userDistribution.practices}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="bucket"
                      label={{
                        value: "Completed Practices",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      label={{
                        value: "Number of Users",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <RechartsTooltip
                      formatter={(value: any, name: string) => {
                        if (name === "count") {
                          return [value, "Users"];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Practices: ${label}`}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {data.userDistribution.practices.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Summary Statistics */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {data.userDistribution.practices.map((item) => (
                    <div
                      key={item.bucket}
                      className="flex flex-col items-center p-3 border rounded-lg"
                    >
                      <div className="text-2xl font-bold">{item.count}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.bucket} practices
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No engagement data available</p>
        </div>
      )}
    </div>
  );
}

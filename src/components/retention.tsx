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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardBlock } from "./custom/card-block";
import { CohortHeatmap } from "./cohort-heatmap";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RetentionMetric {
  rate: number;
  previous: number;
  delta: number;
  trend: Array<{ date: string; value: number }>;
}

interface SegmentData {
  segment: string;
  d1: number;
  d7: number;
  d30: number;
}

interface RetentionSummaryData {
  d1: RetentionMetric;
  d7: RetentionMetric;
  d30: RetentionMetric;
  segments: {
    platform: SegmentData[];
    country: SegmentData[];
    premium: SegmentData[];
  };
}

interface CohortData {
  cohortDate: string;
  cohortSize: number;
  retention: {
    day0: number;
    day1: number;
    day7: number;
    day14: number;
    day30: number;
    day60?: number;
    day90?: number;
  };
}

interface CohortResponse {
  cohorts: CohortData[];
  metadata: {
    bucket: string;
    timeRange: string;
    filters: {
      platform: string;
      country: string;
      premium: string;
    };
  };
}

export function Retention() {
  const [timeRange, setTimeRange] = React.useState("90d");
  const [summaryData, setSummaryData] =
    React.useState<RetentionSummaryData | null>(null);
  const [cohortData, setCohortData] = React.useState<CohortResponse | null>(
    null
  );
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(true);
  const [isLoadingCohorts, setIsLoadingCohorts] = React.useState(true);
  const [bucket, setBucket] = React.useState<"weekly" | "monthly">("weekly");
  const [cohortTimeRange, setCohortTimeRange] = React.useState("90d");

  // Fetch summary data
  React.useEffect(() => {
    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      try {
        const response = await fetch(
          `/api/retention/summary?timeRange=${timeRange}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          setSummaryData(data);
        }
      } catch (error) {
        console.error("Error fetching retention summary:", error);
      } finally {
        setIsLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [timeRange]);

  // Fetch cohort data
  React.useEffect(() => {
    const fetchCohorts = async () => {
      setIsLoadingCohorts(true);
      try {
        const response = await fetch(
          `/api/retention/cohorts?timeRange=${cohortTimeRange}&bucket=${bucket}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          setCohortData(data);
        }
      } catch (error) {
        console.error("Error fetching cohort data:", error);
      } finally {
        setIsLoadingCohorts(false);
      }
    };

    fetchCohorts();
  }, [cohortTimeRange, bucket]);

  return (
    <div className="space-y-4 px-4 lg:px-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Retention Overview</h3>
              <p className="text-sm text-muted-foreground">
                Track how many users return after signing up
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="overview-time-range" className="text-sm">
                Period:
              </Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="overview-time-range" className="w-[120px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="180d">180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Retention Metrics Cards */}
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
            <CardBlock
              title="D1 Retention"
              value={
                summaryData
                  ? `${(summaryData.d1.rate * 100).toFixed(1)}%`
                  : "0.0%"
              }
              change={
                summaryData
                  ? `${
                      summaryData.d1.delta >= 0 ? "+" : ""
                    }${summaryData.d1.delta.toFixed(1)}%`
                  : "+0.0%"
              }
              period={`vs previous ${timeRange}`}
              delta={summaryData?.d1.delta}
              previous={summaryData ? summaryData.d1.previous * 100 : 0}
            />
            <CardBlock
              title="D7 Retention"
              value={
                summaryData
                  ? `${(summaryData.d7.rate * 100).toFixed(1)}%`
                  : "0.0%"
              }
              change={
                summaryData
                  ? `${
                      summaryData.d7.delta >= 0 ? "+" : ""
                    }${summaryData.d7.delta.toFixed(1)}%`
                  : "+0.0%"
              }
              period={`vs previous ${timeRange}`}
              delta={summaryData?.d7.delta}
              previous={summaryData ? summaryData.d7.previous * 100 : 0}
            />
            <CardBlock
              title="D30 Retention"
              value={
                summaryData
                  ? `${(summaryData.d30.rate * 100).toFixed(1)}%`
                  : "0.0%"
              }
              change={
                summaryData
                  ? `${
                      summaryData.d30.delta >= 0 ? "+" : ""
                    }${summaryData.d30.delta.toFixed(1)}%`
                  : "+0.0%"
              }
              period={`vs previous ${timeRange}`}
              delta={summaryData?.d30.delta}
              previous={summaryData ? summaryData.d30.previous * 100 : 0}
            />
          </div>

          {/* Retention Trends Chart */}
          {summaryData && summaryData.d7.trend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Retention Trends</CardTitle>
                <CardDescription>
                  Daily cohort retention rates over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={summaryData.d7.trend.map((item, idx) => ({
                      date: item.date,
                      d1: (summaryData.d1.trend[idx]?.value || 0) * 100,
                      d7: (summaryData.d7.trend[idx]?.value || 0) * 100,
                      d30: (summaryData.d30.trend[idx]?.value || 0) * 100,
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                      labelFormatter={(label) => {
                        const date = new Date(label);
                        return date.toLocaleDateString();
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="d1"
                      stroke="#10b981"
                      name="D1"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="d7"
                      stroke="#3b82f6"
                      name="D7"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="d30"
                      stroke="#8b5cf6"
                      name="D30"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cohorts Tab */}
        <TabsContent value="cohorts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Cohort Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Retention rates by signup cohort
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="cohort-bucket" className="text-sm">
                  Bucket:
                </Label>
                <Select
                  value={bucket}
                  onValueChange={(value) =>
                    setBucket(value as "weekly" | "monthly")
                  }
                >
                  <SelectTrigger id="cohort-bucket" className="w-[120px]">
                    <SelectValue placeholder="Select bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="cohort-time-range" className="text-sm">
                  Period:
                </Label>
                <Select
                  value={cohortTimeRange}
                  onValueChange={setCohortTimeRange}
                >
                  <SelectTrigger id="cohort-time-range" className="w-[120px]">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                    <SelectItem value="180d">180 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isLoadingCohorts ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading cohort data...</p>
            </div>
          ) : cohortData && cohortData.cohorts.length > 0 ? (
            <CohortHeatmap
              cohorts={cohortData.cohorts}
              showExtendedDays={cohortTimeRange === "180d"}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">
                No cohort data available for the selected period
              </p>
            </div>
          )}
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Segment Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Compare retention rates across different user segments
            </p>
          </div>

          {isLoadingSummary ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading segment data...</p>
            </div>
          ) : summaryData ? (
            <div className="space-y-6">
              {/* Platform Segments */}
              {summaryData.segments.platform.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>By Platform</CardTitle>
                    <CardDescription>
                      Retention rates by iOS vs Android
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Platform</TableHead>
                          <TableHead className="text-right">D1</TableHead>
                          <TableHead className="text-right">D7</TableHead>
                          <TableHead className="text-right">D30</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.segments.platform.map((segment) => (
                          <TableRow key={segment.segment}>
                            <TableCell className="font-medium capitalize">
                              {segment.segment}
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d1 * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d7 * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d30 * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Country Segments */}
              {summaryData.segments.country.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>By Country</CardTitle>
                    <CardDescription>
                      Top countries by retention rate
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Country</TableHead>
                          <TableHead className="text-right">D1</TableHead>
                          <TableHead className="text-right">D7</TableHead>
                          <TableHead className="text-right">D30</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.segments.country.map((segment) => (
                          <TableRow key={segment.segment}>
                            <TableCell className="font-medium uppercase">
                              {segment.segment}
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d1 * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d7 * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d30 * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Premium Segments */}
              {summaryData.segments.premium.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>By Premium Status</CardTitle>
                    <CardDescription>
                      Premium vs non-premium users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">D1</TableHead>
                          <TableHead className="text-right">D7</TableHead>
                          <TableHead className="text-right">D30</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.segments.premium.map((segment) => (
                          <TableRow key={segment.segment}>
                            <TableCell className="font-medium">
                              {segment.segment === "true" ? "Premium" : "Free"}
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d1 * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d7 * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(segment.d30 * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No segment data available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

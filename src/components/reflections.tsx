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
import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MetricBlock {
  value: number;
  previous: number;
  delta: number;
  change: string;
}

interface ReflectionsData {
  startedDirect: MetricBlock;
  startedFromPractices: MetricBlock;
  completed: MetricBlock;
  cancelled: MetricBlock;
  totalMessages: MetricBlock;
  sourcePractices: Array<{ name: string; count: number }>;
  trial: {
    paywallViews: MetricBlock;
    trialsStarted: MetricBlock;
    monthly: MetricBlock;
    annual: MetricBlock;
    total: MetricBlock;
  };
}

const emptyMetric: MetricBlock = {
  value: 0,
  previous: 0,
  delta: 0,
  change: "+0.0%",
};

export function Reflections({
  analyticsVersion = "v2",
}: {
  analyticsVersion?: "v1" | "v2";
}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [data, setData] = React.useState<ReflectionsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchData = React.useCallback(
    async (range: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/reflections?timeRange=${range}&analyticsVersion=${analyticsVersion}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Failed to fetch reflections data");
        setData(await response.json());
      } catch (error) {
        console.error("Error fetching reflections data:", error);
        setData({
          startedDirect: emptyMetric,
          startedFromPractices: emptyMetric,
          completed: emptyMetric,
          cancelled: emptyMetric,
          totalMessages: emptyMetric,
          sourcePractices: [],
          trial: {
            paywallViews: emptyMetric,
            trialsStarted: emptyMetric,
            monthly: emptyMetric,
            annual: emptyMetric,
            total: emptyMetric,
          },
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

  const getPeriodText = (range: string): string => {
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
  };

  const period = getPeriodText(timeRange);

  return (
    <Tabs defaultValue="basic" className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="reflections-view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="basic">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="reflections-view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="sources">Sources</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="trial">Trial</TabsTrigger>
        </TabsList>
        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={setTimeRange}
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

      {/* Basic tab */}
      <TabsContent
        value="basic"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
          {isLoading || !data ? (
            <>
              <CardBlock title="Started Direct" value={0} change="" period={period} />
              <CardBlock title="From Practices" value={0} change="" period={period} />
              <CardBlock title="Completed" value={0} change="" period={period} />
              <CardBlock title="Cancelled" value={0} change="" period={period} />
              <CardBlock title="Total Messages" value={0} change="" period={period} />
            </>
          ) : (
            <>
              <CardBlock
                title="Started Direct"
                value={data.startedDirect.value}
                change={data.startedDirect.change}
                delta={data.startedDirect.delta}
                previous={data.startedDirect.previous}
                period={period}
              />
              <CardBlock
                title="From Practices"
                value={data.startedFromPractices.value}
                change={data.startedFromPractices.change}
                delta={data.startedFromPractices.delta}
                previous={data.startedFromPractices.previous}
                period={period}
              />
              <CardBlock
                title="Completed"
                value={data.completed.value}
                change={data.completed.change}
                delta={data.completed.delta}
                previous={data.completed.previous}
                period={period}
              />
              <CardBlock
                title="Cancelled"
                value={data.cancelled.value}
                change={data.cancelled.change}
                delta={data.cancelled.delta}
                previous={data.cancelled.previous}
                period={period}
              />
              <CardBlock
                title="Total Messages"
                value={data.totalMessages.value}
                change={data.totalMessages.change}
                delta={data.totalMessages.delta}
                previous={data.totalMessages.previous}
                period={period}
              />
            </>
          )}
        </div>
      </TabsContent>

      {/* Sources tab */}
      <TabsContent value="sources" className="flex flex-col px-4 lg:px-6">
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead>Source Practice</TableHead>
                  <TableHead className="w-32 text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || !data ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground py-8"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data.sourcePractices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground py-8"
                    >
                      No data for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  data.sourcePractices.map((sp) => (
                    <TableRow key={sp.name}>
                      <TableCell className="font-medium">{sp.name}</TableCell>
                      <TableCell className="text-right">
                        {sp.count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      {/* Trial tab */}
      <TabsContent value="trial" className="flex flex-col px-4 lg:px-6">
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-32">Paywall</TableHead>
                  <TableHead className="w-32 text-right">Views</TableHead>
                  <TableHead className="w-40 text-right">
                    Trials Started
                  </TableHead>
                  <TableHead className="w-32 text-right">Monthly</TableHead>
                  <TableHead className="w-32 text-right">Annual</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Reflection</TableCell>
                  <TableCell className="text-right">
                    {isLoading || !data?.trial
                      ? "0"
                      : data.trial.paywallViews.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isLoading || !data?.trial
                      ? "0"
                      : data.trial.trialsStarted.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isLoading || !data?.trial
                      ? "0"
                      : data.trial.monthly.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isLoading || !data?.trial
                      ? "0"
                      : data.trial.annual.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isLoading || !data?.trial
                      ? "0"
                      : data.trial.total.value.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

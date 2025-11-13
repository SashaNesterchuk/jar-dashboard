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
import { ChartAreaStep } from "./ui/chart-area-step";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CheckinData {
  usersStarted: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  startedTotal: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  completed: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  abandoned: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  avgDuration: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  pages?: Record<string, number>;
  trial?: {
    paywallViews: {
      value: number;
      previous: number;
      delta: number;
      change: string;
    };
    trialsStarted: {
      value: number;
      previous: number;
      delta: number;
      change: string;
    };
    monthly: {
      value: number;
      previous: number;
      delta: number;
      change: string;
    };
    annual: {
      value: number;
      previous: number;
      delta: number;
      change: string;
    };
    total: {
      value: number;
      previous: number;
      delta: number;
      change: string;
    };
  };
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0 s";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${remainingSeconds} s`;
  } else if (remainingSeconds === 0) {
    return `${minutes} min`;
  } else {
    return `${minutes} m ${remainingSeconds} s`;
  }
}

export function Checkin({}: {}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [checkinData, setCheckinData] = React.useState<CheckinData | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchCheckinData = React.useCallback(async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/checkin?timeRange=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch checkin data");
      }

      const data = await response.json();
      setCheckinData(data);
    } catch (error) {
      console.error("Error fetching checkin data:", error);
      setCheckinData({
        usersStarted: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        startedTotal: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        completed: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        abandoned: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        avgDuration: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCheckinData(timeRange);
  }, [timeRange, fetchCheckinData]);

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

  const pages = [
    "mood",
    "emotions",
    "context",
    "reflection",
    "summary",
    "paywall",
  ];

  return (
    <Tabs defaultValue="basic" className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="basic">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pages">Pages</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
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
      <TabsContent
        value="basic"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {isLoading ? (
            <>
              <CardBlock
                title="Started Check-in"
                value={0}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Unique Users"
                value={0}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Completed Check-in"
                value={0}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Abandoned Check-in"
                value={0}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Average Duration"
                value={0}
                change=""
                period={getPeriodText(timeRange)}
              />
            </>
          ) : checkinData ? (
            <>
              <CardBlock
                title="Started Check-in"
                value={checkinData.startedTotal.value}
                change={checkinData.startedTotal.change}
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Unique Users"
                value={checkinData.usersStarted.value}
                change={checkinData.usersStarted.change}
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Completed Check-in"
                value={checkinData.completed.value}
                change={checkinData.completed.change}
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Abandoned Check-in"
                value={checkinData.abandoned.value}
                change={checkinData.abandoned.change}
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Average Duration"
                value={formatDuration(checkinData.avgDuration.value)}
                change={checkinData.avgDuration.change}
                period={getPeriodText(timeRange)}
              />
            </>
          ) : null}
        </div>
      </TabsContent>
      <TabsContent value="pages" className="flex flex-col px-4 lg:px-6">
        <div className="grid w-full grid-cols-1 gap-4">
          <ChartAreaStep
            title="Check-in Flow"
            pages={pages}
            pageData={checkinData?.pages}
            timeRange={timeRange}
          />
        </div>
      </TabsContent>
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
                  <TableCell className="font-medium">Paywall</TableCell>
                  <TableCell className="text-right">
                    {isLoading || !checkinData?.trial
                      ? "0"
                      : checkinData.trial.paywallViews.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isLoading || !checkinData?.trial
                      ? "0"
                      : checkinData.trial.trialsStarted.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isLoading || !checkinData?.trial
                      ? "0"
                      : checkinData.trial.monthly.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isLoading || !checkinData?.trial
                      ? "0"
                      : checkinData.trial.annual.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isLoading || !checkinData?.trial
                      ? "0"
                      : checkinData.trial.total.value.toLocaleString()}
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

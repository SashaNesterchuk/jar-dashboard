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
import { IconLoader } from "@tabler/icons-react";

interface OnboardingData {
  started: {
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
  avgDuration: {
    value: number;
    previous: number;
    delta: number;
    change: string;
  };
  pages?: {
    noPremium: Record<string, number>;
    premium: Record<string, number>;
  };
  trials?: {
    ps1: {
      views: number;
      trialsStarted: { monthly: number; annual: number; total: number };
      purchases: { monthly: number; annual: number; total: number };
    };
    ps2: {
      views: number;
      trialsStarted: { monthly: number; annual: number; total: number };
      purchases: { monthly: number; annual: number; total: number };
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

export function Onboarding({}: {}) {
  const [timeRange, setTimeRange] = React.useState("7d");
  const [onboardingData, setOnboardingData] =
    React.useState<OnboardingData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchOnboardingData = React.useCallback(async (range: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/onboarding?timeRange=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch onboarding data");
      }

      const data = await response.json();
      setOnboardingData(data);
    } catch (error) {
      console.error("Error fetching onboarding data:", error);
      // Set default values on error
      setOnboardingData({
        started: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        completed: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        avgDuration: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOnboardingData(timeRange);
  }, [timeRange, fetchOnboardingData]);

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

  const pages = {
    noPremium: [
      "hello",
      "1",
      "1.2",
      "2",
      "3",
      "ps1",
      "noPremium1",
      "noPremium2",
      "practice", // breathing, diary, questions
      "notification",
      "ps2",
    ],
    premium: [
      "hello",
      "1",
      "1.2",
      "2",
      "3",
      "ps1",
      "premium1",
      "premium2",
      "premium3",
      "summary",
      "noPremium1",
      "notification",
    ],
  };

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
                title="Started Onboarding"
                value={0}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Completed Onboarding"
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
          ) : onboardingData ? (
            <>
              <CardBlock
                title="Started Onboarding"
                value={onboardingData.started.value}
                change={onboardingData.started.change}
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Completed Onboarding"
                value={onboardingData.completed.value}
                change={onboardingData.completed.change}
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Average Duration"
                value={formatDuration(onboardingData.avgDuration.value)}
                change={onboardingData.avgDuration.change}
                period={getPeriodText(timeRange)}
              />
            </>
          ) : null}
        </div>
      </TabsContent>
      <TabsContent value="pages" className="flex flex-col px-4 lg:px-6">
        <div className="grid w-full grid-cols-1 gap-4 @xl/main:grid-cols-2">
          <ChartAreaStep
            title="No premium flow"
            pages={pages.noPremium}
            pageData={onboardingData?.pages?.noPremium}
            timeRange={timeRange}
          />
          <ChartAreaStep
            title="Premium flow"
            pages={pages.premium}
            pageData={onboardingData?.pages?.premium}
            timeRange={timeRange}
          />
        </div>
      </TabsContent>
      <TabsContent value="trial" className="flex flex-col px-4 lg:px-6">
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader className="h-4 w-4 animate-spin" />
                  Loading trial data...
                </div>
              </div>
            ) : onboardingData?.trials ? (
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
                    <TableHead className="w-40 text-right">Purchases</TableHead>
                    <TableHead className="w-32 text-right">Monthly</TableHead>
                    <TableHead className="w-32 text-right">Annual</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">PS1</TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps1.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps1.trialsStarted.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps1.trialsStarted.monthly.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps1.trialsStarted.annual.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps1.trialsStarted.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps1.purchases.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps1.purchases.monthly.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps1.purchases.annual.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps1.purchases.total.toLocaleString()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">PS2</TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps2.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps2.trialsStarted.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps2.trialsStarted.monthly.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps2.trialsStarted.annual.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps2.trialsStarted.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps2.purchases.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps2.purchases.monthly.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingData.trials.ps2.purchases.annual.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {onboardingData.trials.ps2.purchases.total.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-sm text-muted-foreground">
                  No trial data available for this range.
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

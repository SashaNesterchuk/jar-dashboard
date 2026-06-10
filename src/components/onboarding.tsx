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
import {
  ONBOARDING_V1_PAGES,
  ONBOARDING_V2_PAGE_LABELS,
  ONBOARDING_V2_PAGE_ORDER,
  formatTaskPracticeOpensNote,
  type OnboardingFlowVersion,
  type TaskPracticeOpens,
} from "@/lib/onboarding-analytics";

type PaywallTrialStats = {
  views: number;
  trialsStarted: { monthly: number; annual: number; total: number };
  purchases: { monthly: number; annual: number; total: number };
};

interface OnboardingData {
  onboardingFlowVersion?: OnboardingFlowVersion;
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
    noPremium?: Record<string, number>;
    premium?: Record<string, number>;
    flow?: Record<string, number>;
  };
  trials?: {
    ps1: PaywallTrialStats;
    ps2: PaywallTrialStats;
    ps3?: PaywallTrialStats;
  };
  taskPracticeOpens?: TaskPracticeOpens | null;
  review?: {
    modalShown: number;
    rateTapped: number;
    dismissedNotNow: number;
    dismissedSwipe: number;
    ratings: Record<string, number>;
    completedRated: number;
    completedNotNow: number;
    completedSwipe: number;
  } | null;
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

function PaywallTrialRow({
  label,
  stats,
}: {
  label: string;
  stats: PaywallTrialStats;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right">
        {stats.views.toLocaleString()}
      </TableCell>
      <TableCell className="text-right font-medium">
        {stats.trialsStarted.total.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        {stats.trialsStarted.monthly.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        {stats.trialsStarted.annual.toLocaleString()}
      </TableCell>
      <TableCell className="text-right font-medium">
        {stats.trialsStarted.total.toLocaleString()}
      </TableCell>
      <TableCell className="text-right font-medium">
        {stats.purchases.total.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        {stats.purchases.monthly.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        {stats.purchases.annual.toLocaleString()}
      </TableCell>
      <TableCell className="text-right font-medium">
        {stats.purchases.total.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

export function Onboarding() {
  const [onboardingFlowVersion, setOnboardingFlowVersion] =
    React.useState<OnboardingFlowVersion>("v2");
  const [timeRange, setTimeRange] = React.useState("7d");
  const [onboardingData, setOnboardingData] =
    React.useState<OnboardingData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchOnboardingData = React.useCallback(
    async (range: string, flowVersion: OnboardingFlowVersion) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/onboarding?timeRange=${range}&onboardingFlowVersion=${flowVersion}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch onboarding data");
        }

        const data = await response.json();
        setOnboardingData(data);
      } catch (error) {
        console.error("Error fetching onboarding data:", error);
        setOnboardingData({
          started: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
          completed: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
          avgDuration: { value: 0, previous: 0, delta: 0, change: "+0.0%" },
        });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    fetchOnboardingData(timeRange, onboardingFlowVersion);
  }, [timeRange, onboardingFlowVersion, fetchOnboardingData]);

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

  const v2Pages = [...ONBOARDING_V2_PAGE_ORDER];

  const taskPracticeNote = formatTaskPracticeOpensNote(
    onboardingData?.taskPracticeOpens
  );
  const taskPracticeStepAnnotations = React.useMemo(() => {
    if (!taskPracticeNote) return undefined;
    return {
      tasks: taskPracticeNote,
      notification: taskPracticeNote,
      ps3: taskPracticeNote,
    };
  }, [taskPracticeNote]);

  return (
    <Tabs defaultValue="basic" className="w-full flex-col justify-start gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="onboarding-flow-version" className="text-sm">
            Onboarding flow
          </Label>
          <Select
            value={onboardingFlowVersion}
            onValueChange={(value) =>
              setOnboardingFlowVersion(value as OnboardingFlowVersion)
            }
          >
            <SelectTrigger id="onboarding-flow-version" className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="v2">v2</SelectItem>
              <SelectItem value="v1">v1</SelectItem>
            </SelectContent>
          </Select>
          {onboardingFlowVersion === "v2" && (
            <span className="text-xs text-muted-foreground">
              Filter: <code className="text-[11px]">onboarding_version=v2</code>
            </span>
          )}
        </div>
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
            <SelectItem value="review">Review</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="trial">Trial</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>
        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={(value) => value && setTimeRange(value)}
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
              <CardBlock title="Started Onboarding" value={0} change="" period={getPeriodText(timeRange)} />
              <CardBlock title="Completed Onboarding" value={0} change="" period={getPeriodText(timeRange)} />
              <CardBlock title="Average Duration" value={0} change="" period={getPeriodText(timeRange)} />
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
      <TabsContent value="pages" className="flex flex-col gap-4 px-4 lg:px-6">
        {onboardingFlowVersion === "v2" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Step order matches the app ({v2Pages.length} screens). Drop after
              Tasks → Notifications is often users opening a practice, not churn.
            </p>
            <ChartAreaStep
              title="Onboarding flow (v2)"
              pages={v2Pages}
              pageLabels={ONBOARDING_V2_PAGE_LABELS}
              pageData={onboardingData?.pages?.flow}
              timeRange={timeRange}
              stepScreens
              stepAnnotations={taskPracticeStepAnnotations}
            />
          </>
        ) : (
          <div className="grid w-full grid-cols-1 gap-4 @xl/main:grid-cols-2">
            <ChartAreaStep
              title="No premium flow"
              pages={[...ONBOARDING_V1_PAGES.noPremium]}
              pageData={onboardingData?.pages?.noPremium}
              timeRange={timeRange}
              stepScreens
            />
            <ChartAreaStep
              title="Premium flow"
              pages={[...ONBOARDING_V1_PAGES.premium]}
              pageData={onboardingData?.pages?.premium}
              timeRange={timeRange}
              stepScreens
            />
          </div>
        )}
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
                    <TableHead className="w-40 text-right">Trials Started</TableHead>
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
                  {onboardingFlowVersion === "v2" && onboardingData.trials.ps3 ? (
                    <PaywallTrialRow label="PS3 (price3)" stats={onboardingData.trials.ps3} />
                  ) : (
                    <>
                      <PaywallTrialRow label="PS1" stats={onboardingData.trials.ps1} />
                      <PaywallTrialRow label="PS2" stats={onboardingData.trials.ps2} />
                    </>
                  )}
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
      <TabsContent value="review" className="flex flex-col gap-4 px-4 lg:px-6">
        {onboardingFlowVersion !== "v2" ? (
          <p className="text-sm text-muted-foreground">
            In-app review modal is only in onboarding v2.
          </p>
        ) : isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader className="h-4 w-4 animate-spin" />
              Loading review data...
            </div>
          </div>
        ) : onboardingData?.review ? (
          <>
            <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
              <CardBlock
                title="Modal shown"
                value={onboardingData.review.modalShown}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Rate tapped"
                value={onboardingData.review.rateTapped}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Not now"
                value={onboardingData.review.dismissedNotNow}
                change=""
                period={getPeriodText(timeRange)}
              />
              <CardBlock
                title="Swipe / backdrop close"
                value={onboardingData.review.dismissedSwipe}
                change=""
                period={getPeriodText(timeRange)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Stars selected (on Rate tap)</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["5", "4", "3", "2", "1"] as const).map((stars) => {
                      const count = onboardingData.review!.ratings[stars] ?? 0;
                      const total = onboardingData.review!.rateTapped || 1;
                      const share =
                        onboardingData.review!.rateTapped > 0
                          ? `${((count / total) * 100).toFixed(1)}%`
                          : "—";
                      return (
                        <TableRow key={stars}>
                          <TableCell className="font-medium">
                            {stars} star{stars === "1" ? "" : "s"}
                          </TableCell>
                          <TableCell className="text-right">
                            {count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {share}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>How users left the modal</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        Tapped Rate (→ App Store review on iOS)
                      </TableCell>
                      <TableCell className="text-right">
                        {onboardingData.review.completedRated.toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Not now</TableCell>
                      <TableCell className="text-right">
                        {onboardingData.review.completedNotNow.toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        Swipe / backdrop dismiss
                      </TableCell>
                      <TableCell className="text-right">
                        {onboardingData.review.completedSwipe.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No review data for this period.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
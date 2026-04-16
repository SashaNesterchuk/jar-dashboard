import { NextRequest, NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;

if (!POSTHOG_API_KEY) {
  console.error("POSTHOG_API_KEY is not set");
}

interface PostHogQueryResponse {
  results?: Array<Array<number | string>>;
  responseData?: {
    results?: Array<Array<number | string>>;
  };
}

function getVersionFilter(analyticsVersion: "v1" | "v2"): string {
  if (analyticsVersion === "v2") {
    return `JSONExtractString(properties,'analytics_version') = 'v2'`;
  }
  return `(JSONExtractString(properties,'analytics_version') != 'v2' OR JSONExtractString(properties,'analytics_version') = '')`;
}

async function queryPostHogArray(
  query: string
): Promise<Array<Array<number | string>>> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  // Trim any whitespace from API key
  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: {
      kind: "HogQLQuery",
      query,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
  }

  const data: PostHogQueryResponse = await response.json();
  const results = data.results || data.responseData?.results;

  if (!results || results.length === 0) {
    return [];
  }

  return results;
}

async function queryPostHog(query: string): Promise<number> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  // Trim any whitespace from API key
  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: {
      kind: "HogQLQuery",
      query,
    },
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
  }

  const data: PostHogQueryResponse = await response.json();
  const results = data.results || data.responseData?.results;

  if (!results || results.length === 0) {
    return 0;
  }

  // Extract value from results array
  const value = results[0]?.[0];
  return typeof value === "number" ? value : Number(value) || 0;
}

function getTimeWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let end: Date;
  let start: Date;

  switch (timeRange) {
    case "7d": {
      // Last 7 days (including today)
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      break;
    }
    case "30d": {
      // Last 30 days (including today)
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      break;
    }
    case "90d": {
      // Last 90 days (including today)
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      break;
    }
    default: {
      // Default to 7d
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
    }
  }

  // Adjust for Warsaw timezone - start at midnight
  const year = start.getFullYear();
  const month = start.getMonth();
  const date = start.getDate();
  const startAdjusted = new Date(Date.UTC(year, month, date, 0, 0, 0));
  startAdjusted.setHours(startAdjusted.getHours() - 1); // Adjust for Warsaw offset (UTC+1)

  // End is exclusive (start of next day) to match analytics route pattern
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  const endDate = end.getDate();
  const endAdjusted = new Date(Date.UTC(endYear, endMonth, endDate, 0, 0, 0));
  endAdjusted.setDate(endAdjusted.getDate() + 1); // Next day (exclusive)
  endAdjusted.setHours(endAdjusted.getHours() - 1); // Adjust for Warsaw offset (UTC+1)

  return { start: startAdjusted, end: endAdjusted };
}

function getComparisonWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let end: Date;
  let start: Date;

  switch (timeRange) {
    case "7d": {
      // Previous 7 days
      end = new Date(now);
      end.setDate(end.getDate() - 7);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      break;
    }
    case "30d": {
      // Previous 30 days
      end = new Date(now);
      end.setDate(end.getDate() - 30);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      break;
    }
    case "90d": {
      // Previous 90 days
      end = new Date(now);
      end.setDate(end.getDate() - 90);
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      break;
    }
    default: {
      // Default to previous 7 days
      end = new Date(now);
      end.setDate(end.getDate() - 7);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
    }
  }

  // Adjust for Warsaw timezone - start at midnight
  const year = start.getFullYear();
  const month = start.getMonth();
  const date = start.getDate();
  const startAdjusted = new Date(Date.UTC(year, month, date, 0, 0, 0));
  startAdjusted.setHours(startAdjusted.getHours() - 1); // Adjust for Warsaw offset (UTC+1)

  // End is exclusive (start of next day) to match analytics route pattern
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  const endDate = end.getDate();
  const endAdjusted = new Date(Date.UTC(endYear, endMonth, endDate, 0, 0, 0));
  endAdjusted.setDate(endAdjusted.getDate() + 1); // Next day (exclusive)
  endAdjusted.setHours(endAdjusted.getHours() - 1); // Adjust for Warsaw offset (UTC+1)

  return { start: startAdjusted, end: endAdjusted };
}

function buildOnboardingQuery(
  startIso: string,
  endIso: string,
  action: "started" | "completed",
  environment: string = "production",
  analyticsVersion: "v1" | "v2" = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getVersionFilter(
    analyticsVersion
  )}`;

  if (action === "started") {
    return `SELECT count() AS value FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'action') = 'started' AND ${baseFilters}`;
  } else {
    // completed
    return `SELECT count() AS value FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'action') = 'completed' AND ${baseFilters}`;
  }
}

function buildDurationQuery(
  startIso: string,
  endIso: string,
  environment: string = "production",
  analyticsVersion: "v1" | "v2" = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getVersionFilter(
    analyticsVersion
  )}`;
  return `SELECT avg(toFloatOrDefault(JSONExtractString(properties,'total_duration_seconds'), 0.0)) AS value FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'action') = 'completed' AND ${baseFilters}`;
}

function buildPageViewQuery(
  startIso: string,
  endIso: string,
  pageName: string,
  premiumActive?: boolean,
  environment: string = "production",
  analyticsVersion: "v1" | "v2" = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getVersionFilter(
    analyticsVersion
  )}`;

  let premiumFilter = "";
  if (premiumActive !== undefined) {
    // In PostHog, premium_active is stored as boolean (true/false)
    // JSONExtractBool returns 1 for true, 0 for false
    // JSONExtractString returns 'true' or 'false' as string
    // We check both to handle all cases
    const boolValue = premiumActive ? 1 : 0;
    const boolStr = String(premiumActive);
    premiumFilter = ` AND (JSONExtractBool(properties,'premium_active') = ${boolValue} OR JSONExtractString(properties,'premium_active') = '${boolStr}')`;
  }

  // Include both 'viewed' and 'completed' actions for page views
  // Some pages might only have 'completed' action (like notification at the end)
  return `SELECT uniqExact(JSONExtractString(properties,'session_id')) AS value FROM events WHERE event = 'onboarding_step' AND (JSONExtractString(properties,'action') = 'viewed' OR JSONExtractString(properties,'action') = 'completed') AND JSONExtractString(properties,'page_name') = '${pageName}' AND ${baseFilters}${premiumFilter}`;
}

/**
 * Order matches `pagesSteps` in jar/components/common/v2/Onboarding/Onboarding.tsx
 * (second `ps2` step omitted — same page_name as first).
 */
const ONBOARDING_V2_PAGE_ORDER = [
  "hello",
  "name",
  "1",
  "2",
  "summaryConclusion",
  "summaryConclusionQuestion",
  "summaryAI",
  "ps2",
  "1.2",
  "ps1",
  "noPremium1",
  "notification",
  "tasks",
] as const;

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";
    const analyticsVersionParam = searchParams.get("analyticsVersion") || "v2";
    const analyticsVersion: "v1" | "v2" =
      analyticsVersionParam === "v1" ? "v1" : "v2";

    // Validate timeRange
    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    // Get time windows
    const currentWindow = getTimeWindow(timeRange);
    const comparisonWindow = getComparisonWindow(timeRange);

    // Build queries for current period
    const startedQuery = buildOnboardingQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "started",
      environment,
      analyticsVersion
    );
    const completedQuery = buildOnboardingQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "completed",
      environment,
      analyticsVersion
    );
    const durationQuery = buildDurationQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      environment,
      analyticsVersion
    );

    // Build queries for comparison period
    const startedComparisonQuery = buildOnboardingQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      "started",
      environment,
      analyticsVersion
    );
    const completedComparisonQuery = buildOnboardingQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      "completed",
      environment,
      analyticsVersion
    );
    const durationComparisonQuery = buildDurationQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      environment,
      analyticsVersion
    );

    // Build trial data queries (shared v1 / v2)
    const baseFiltersForTrials = `timestamp >= toDateTime('${currentWindow.start.toISOString()}','Europe/Warsaw') AND timestamp < toDateTime('${currentWindow.end.toISOString()}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getVersionFilter(
      analyticsVersion
    )}`;

    const paywall1ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price1' AND ${baseFiltersForTrials}`;
    const paywall2ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price2' AND ${baseFiltersForTrials}`;

    const trialStartedQuery = `
      SELECT
        JSONExtractString(properties,'variant') AS variant,
        coalesce(JSONExtractString(properties,'selected_period'), '') AS period,
        count() AS count
      FROM events
      WHERE event = 'onboarding_paywall_action'
        AND JSONExtractString(properties,'action') = 'trial_started'
        AND ${baseFiltersForTrials}
        AND JSONExtractString(properties,'variant') IN ('price1', 'price2')
        AND JSONExtractString(properties,'variant') IS NOT NULL
        AND JSONExtractString(properties,'variant') != ''
      GROUP BY variant, period
      ORDER BY variant, period
    `;

    const purchaseSuccessQuery = `
      SELECT
        JSONExtractString(properties,'variant') AS variant,
        coalesce(JSONExtractString(properties,'selected_period'), '') AS period,
        count() AS count
      FROM events
      WHERE event = 'onboarding_paywall_action'
        AND JSONExtractString(properties,'action') = 'purchase_success'
        AND ${baseFiltersForTrials}
        AND JSONExtractString(properties,'variant') IN ('price1', 'price2')
        AND JSONExtractString(properties,'variant') IS NOT NULL
        AND JSONExtractString(properties,'variant') != ''
      GROUP BY variant, period
      ORDER BY variant, period
    `;

    const curStart = currentWindow.start.toISOString();
    const curEnd = currentWindow.end.toISOString();

    let started: number;
    let startedComparison: number;
    let completed: number;
    let completedComparison: number;
    let avgDuration: number;
    let avgDurationComparison: number;
    let paywall1Views: number;
    let paywall2Views: number;
    let trialStartedResults: Array<Array<number | string>>;
    let purchaseSuccessResults: Array<Array<number | string>>;

    let pagesData: {
      noPremium?: Record<string, number>;
      premium?: Record<string, number>;
      flow?: Record<string, number>;
    };

    if (analyticsVersion === "v2") {
      const v2PageQueries = ONBOARDING_V2_PAGE_ORDER.map((pageName) =>
        buildPageViewQuery(
          curStart,
          curEnd,
          pageName,
          undefined,
          environment,
          analyticsVersion
        )
      );

      const combined = await Promise.all([
        queryPostHog(startedQuery),
        queryPostHog(startedComparisonQuery),
        queryPostHog(completedQuery),
        queryPostHog(completedComparisonQuery),
        queryPostHog(durationQuery),
        queryPostHog(durationComparisonQuery),
        ...v2PageQueries.map((q) => queryPostHog(q)),
        queryPostHog(paywall1ViewsQuery),
        queryPostHog(paywall2ViewsQuery),
        queryPostHogArray(trialStartedQuery),
        queryPostHogArray(purchaseSuccessQuery),
      ]);

      started = combined[0] as number;
      startedComparison = combined[1] as number;
      completed = combined[2] as number;
      completedComparison = combined[3] as number;
      avgDuration = combined[4] as number;
      avgDurationComparison = combined[5] as number;

      const nPages = ONBOARDING_V2_PAGE_ORDER.length;
      const pageSlice = combined.slice(6, 6 + nPages);
      paywall1Views = combined[6 + nPages] as number;
      paywall2Views = combined[7 + nPages] as number;
      trialStartedResults = combined[8 + nPages] as Array<
        Array<number | string>
      >;
      purchaseSuccessResults = combined[9 + nPages] as Array<
        Array<number | string>
      >;

      pagesData = {
        flow: Object.fromEntries(
          ONBOARDING_V2_PAGE_ORDER.map((p, i) => [
            p,
            Math.round(Number(pageSlice[i]) || 0),
          ])
        ),
      };
    } else {
      const viewedHelloQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "hello",
        undefined,
        environment,
        analyticsVersion
      );
      const viewed1Query = buildPageViewQuery(
        curStart,
        curEnd,
        "1",
        undefined,
        environment,
        analyticsVersion
      );
      const viewed2Query = buildPageViewQuery(
        curStart,
        curEnd,
        "2",
        undefined,
        environment,
        analyticsVersion
      );
      const viewed3Query = buildPageViewQuery(
        curStart,
        curEnd,
        "3",
        undefined,
        environment,
        analyticsVersion
      );
      const viewedPs1Query = buildPageViewQuery(
        curStart,
        curEnd,
        "ps1",
        undefined,
        environment,
        analyticsVersion
      );

      const viewedNoPremium1_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "noPremium1",
        false,
        environment,
        analyticsVersion
      );
      const viewedNoPremium2_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "noPremium2",
        false,
        environment,
        analyticsVersion
      );
      const viewedBreathing_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "breathing",
        false,
        environment,
        analyticsVersion
      );
      const viewedDiary1_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "diary1",
        false,
        environment,
        analyticsVersion
      );
      const viewedQuestions1_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "questions1",
        false,
        environment,
        analyticsVersion
      );
      const viewedNotification_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "notification",
        undefined,
        environment,
        analyticsVersion
      );
      const viewedPs2_noPremiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "ps2",
        false,
        environment,
        analyticsVersion
      );

      const viewedPremium1Query = buildPageViewQuery(
        curStart,
        curEnd,
        "premium1",
        true,
        environment,
        analyticsVersion
      );
      const viewedPremium2Query = buildPageViewQuery(
        curStart,
        curEnd,
        "premium2",
        true,
        environment,
        analyticsVersion
      );
      const viewedPremium3Query = buildPageViewQuery(
        curStart,
        curEnd,
        "premium3",
        true,
        environment,
        analyticsVersion
      );
      const viewedSummaryQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "summary",
        true,
        environment,
        analyticsVersion
      );
      const viewedNoPremium1_premiumQuery = buildPageViewQuery(
        curStart,
        curEnd,
        "noPremium1",
        true,
        environment,
        analyticsVersion
      );

      const [
        v1Started,
        v1StartedComparison,
        v1Completed,
        v1CompletedComparison,
        v1AvgDuration,
        v1AvgDurationComparison,
        viewedHello,
        viewed1,
        viewed2,
        viewed3,
        viewedPs1,
        viewedNoPremium1_noPremium,
        viewedNoPremium2_noPremium,
        viewedBreathing_noPremium,
        viewedDiary1_noPremium,
        viewedQuestions1_noPremium,
        viewedNotification_noPremium,
        viewedPs2_noPremium,
        viewedPremium1,
        viewedPremium2,
        viewedPremium3,
        viewedSummary,
        viewedNoPremium1_premium,
        v1Paywall1Views,
        v1Paywall2Views,
        v1TrialStartedResults,
        v1PurchaseSuccessResults,
      ] = await Promise.all([
        queryPostHog(startedQuery),
        queryPostHog(startedComparisonQuery),
        queryPostHog(completedQuery),
        queryPostHog(completedComparisonQuery),
        queryPostHog(durationQuery),
        queryPostHog(durationComparisonQuery),
        queryPostHog(viewedHelloQuery),
        queryPostHog(viewed1Query),
        queryPostHog(viewed2Query),
        queryPostHog(viewed3Query),
        queryPostHog(viewedPs1Query),
        queryPostHog(viewedNoPremium1_noPremiumQuery),
        queryPostHog(viewedNoPremium2_noPremiumQuery),
        queryPostHog(viewedBreathing_noPremiumQuery),
        queryPostHog(viewedDiary1_noPremiumQuery),
        queryPostHog(viewedQuestions1_noPremiumQuery),
        queryPostHog(viewedNotification_noPremiumQuery),
        queryPostHog(viewedPs2_noPremiumQuery),
        queryPostHog(viewedPremium1Query),
        queryPostHog(viewedPremium2Query),
        queryPostHog(viewedPremium3Query),
        queryPostHog(viewedSummaryQuery),
        queryPostHog(viewedNoPremium1_premiumQuery),
        queryPostHog(paywall1ViewsQuery),
        queryPostHog(paywall2ViewsQuery),
        queryPostHogArray(trialStartedQuery),
        queryPostHogArray(purchaseSuccessQuery),
      ]);

      started = v1Started;
      startedComparison = v1StartedComparison;
      completed = v1Completed;
      completedComparison = v1CompletedComparison;
      avgDuration = v1AvgDuration;
      avgDurationComparison = v1AvgDurationComparison;
      paywall1Views = v1Paywall1Views;
      paywall2Views = v1Paywall2Views;
      trialStartedResults = v1TrialStartedResults;
      purchaseSuccessResults = v1PurchaseSuccessResults;

      const practiceTotal = Math.round(
        viewedBreathing_noPremium +
          viewedDiary1_noPremium +
          viewedQuestions1_noPremium
      );

      pagesData = {
        noPremium: {
          hello: Math.round(viewedHello),
          "1": Math.round(viewed1),
          "1.2": Math.round(viewed1),
          "2": Math.round(viewed2),
          "3": Math.round(viewed3),
          ps1: Math.round(viewedPs1),
          noPremium1: Math.round(viewedNoPremium1_noPremium),
          noPremium2: Math.round(viewedNoPremium2_noPremium),
          practice: practiceTotal,
          notification: Math.round(viewedNotification_noPremium),
          ps2: Math.round(viewedPs2_noPremium),
        },
        premium: {
          hello: Math.round(viewedHello),
          "1": Math.round(viewed1),
          "1.2": Math.round(viewed1),
          "2": Math.round(viewed2),
          "3": Math.round(viewed3),
          ps1: Math.round(viewedPs1),
          premium1: Math.round(viewedPremium1),
          premium2: Math.round(viewedPremium2),
          premium3: Math.round(viewedPremium3),
          summary: Math.round(viewedSummary),
          noPremium1: Math.round(viewedNoPremium1_premium),
          notification: Math.round(viewedNotification_noPremium),
        },
      };
    }

    function calculateDelta(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    }

    const startedDelta = calculateDelta(started, startedComparison);
    const completedDelta = calculateDelta(completed, completedComparison);
    const durationDelta = calculateDelta(avgDuration, avgDurationComparison);

    // Process trial data
    // Initialize trial data structure
    const trialsData: {
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
    } = {
      ps1: {
        views: Math.round(paywall1Views),
        trialsStarted: { monthly: 0, annual: 0, total: 0 },
        purchases: { monthly: 0, annual: 0, total: 0 },
      },
      ps2: {
        views: Math.round(paywall2Views),
        trialsStarted: { monthly: 0, annual: 0, total: 0 },
        purchases: { monthly: 0, annual: 0, total: 0 },
      },
    };

    // Process trial started results
    trialStartedResults.forEach((row) => {
      const variant = String(row[0] || "");
      const periodRaw = String(row[1] || "");
      const countValue =
        typeof row[2] === "number" ? row[2] : Number(row[2]) || 0;

      const period =
        periodRaw === ""
          ? "unknown"
          : periodRaw.toLowerCase() === "yearly"
          ? "annual"
          : periodRaw.toLowerCase();

      if (variant === "price1") {
        if (period === "monthly") {
          trialsData.ps1.trialsStarted.monthly += countValue;
        } else if (period === "annual") {
          trialsData.ps1.trialsStarted.annual += countValue;
        }
        trialsData.ps1.trialsStarted.total += countValue;
      } else if (variant === "price2") {
        if (period === "monthly") {
          trialsData.ps2.trialsStarted.monthly += countValue;
        } else if (period === "annual") {
          trialsData.ps2.trialsStarted.annual += countValue;
        }
        trialsData.ps2.trialsStarted.total += countValue;
      }
    });

    // Process purchase success results
    purchaseSuccessResults.forEach((row) => {
      const variant = String(row[0] || "");
      const periodRaw = String(row[1] || "");
      const countValue =
        typeof row[2] === "number" ? row[2] : Number(row[2]) || 0;

      const period =
        periodRaw === ""
          ? "unknown"
          : periodRaw.toLowerCase() === "yearly"
          ? "annual"
          : periodRaw.toLowerCase();

      if (variant === "price1") {
        if (period === "monthly") {
          trialsData.ps1.purchases.monthly += countValue;
        } else if (period === "annual") {
          trialsData.ps1.purchases.annual += countValue;
        }
        trialsData.ps1.purchases.total += countValue;
      } else if (variant === "price2") {
        if (period === "monthly") {
          trialsData.ps2.purchases.monthly += countValue;
        } else if (period === "annual") {
          trialsData.ps2.purchases.annual += countValue;
        }
        trialsData.ps2.purchases.total += countValue;
      }
    });

    return NextResponse.json({
      started: {
        value: Math.round(started),
        previous: Math.round(startedComparison),
        delta: startedDelta,
        change: `${startedDelta >= 0 ? "+" : ""}${startedDelta.toFixed(1)}%`,
      },
      completed: {
        value: Math.round(completed),
        previous: Math.round(completedComparison),
        delta: completedDelta,
        change: `${completedDelta >= 0 ? "+" : ""}${completedDelta.toFixed(
          1
        )}%`,
      },
      avgDuration: {
        value: avgDuration,
        previous: avgDurationComparison,
        delta: durationDelta,
        change: `${durationDelta >= 0 ? "+" : ""}${durationDelta.toFixed(1)}%`,
      },
      pages: pagesData,
      trials: trialsData,
    });
  } catch (error) {
    console.error("Onboarding API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch onboarding data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

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
  environment: string = "production"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;

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
  environment: string = "production"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;
  return `SELECT avg(toFloatOrDefault(JSONExtractString(properties,'total_duration_seconds'), 0.0)) AS value FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'action') = 'completed' AND ${baseFilters}`;
}

function buildPageViewQuery(
  startIso: string,
  endIso: string,
  pageName: string,
  premiumActive?: boolean,
  environment: string = "production"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;

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

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";

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
      environment
    );
    const completedQuery = buildOnboardingQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "completed",
      environment
    );
    const durationQuery = buildDurationQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      environment
    );

    // Build queries for comparison period
    const startedComparisonQuery = buildOnboardingQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      "started",
      environment
    );
    const completedComparisonQuery = buildOnboardingQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      "completed",
      environment
    );
    const durationComparisonQuery = buildDurationQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      environment
    );

    // Build page view queries for current period
    const baseFilters = `timestamp >= toDateTime('${currentWindow.start.toISOString()}','Europe/Warsaw') AND timestamp < toDateTime('${currentWindow.end.toISOString()}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;

    // Common pages (for both flows)
    const viewedHelloQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "hello",
      undefined,
      environment
    );
    const viewed1Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "1",
      undefined,
      environment
    );
    const viewed2Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "2",
      undefined,
      environment
    );
    const viewed3Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "3",
      undefined,
      environment
    );
    const viewedPs1Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "ps1",
      undefined,
      environment
    );

    // NO PREMIUM FLOW pages (premium_active = false)
    const viewedNoPremium1_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "noPremium1",
      false,
      environment
    );
    const viewedNoPremium2_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "noPremium2",
      false,
      environment
    );
    const viewedBreathing_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "breathing",
      false,
      environment
    );
    const viewedDiary1_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "diary1",
      false,
      environment
    );
    const viewedQuestions1_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "questions1",
      false,
      environment
    );
    // Notification is common for both flows, so no premium filter
    const viewedNotification_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "notification",
      undefined,
      environment
    );
    const viewedPs2_noPremiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "ps2",
      false,
      environment
    );

    // PREMIUM FLOW pages (premium_active = true)
    const viewedPremium1Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "premium1",
      true,
      environment
    );
    const viewedPremium2Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "premium2",
      true,
      environment
    );
    const viewedPremium3Query = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "premium3",
      true,
      environment
    );
    const viewedSummaryQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "summary",
      true,
      environment
    );
    const viewedNoPremium1_premiumQuery = buildPageViewQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "noPremium1",
      true,
      environment
    );
    // Notification is common for both flows, use the same query (already defined above)
    const viewedNotification_premiumQuery = viewedNotification_noPremiumQuery;

    // Build trial data queries
    const baseFiltersForTrials = `timestamp >= toDateTime('${currentWindow.start.toISOString()}','Europe/Warsaw') AND timestamp < toDateTime('${currentWindow.end.toISOString()}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;

    // Query for paywall views
    const paywall1ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price1' AND ${baseFiltersForTrials}`;
    const paywall2ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price2' AND ${baseFiltersForTrials}`;

    // Query for trial started by variant and period
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

    // Query for purchase success by variant and period
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

    // Execute all queries in parallel
    const [
      started,
      startedComparison,
      completed,
      completedComparison,
      avgDuration,
      avgDurationComparison,
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
      paywall1Views,
      paywall2Views,
      trialStartedResults,
      purchaseSuccessResults,
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

    // Calculate percentage changes
    function calculateDelta(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    }

    const startedDelta = calculateDelta(started, startedComparison);
    const completedDelta = calculateDelta(completed, completedComparison);
    const durationDelta = calculateDelta(avgDuration, avgDurationComparison);

    // Calculate practice total for noPremium flow (sum of breathing + diary + questions)
    const practiceTotal = Math.round(
      viewedBreathing_noPremium +
        viewedDiary1_noPremium +
        viewedQuestions1_noPremium
    );

    // Build pages data structure
    const pagesData = {
      noPremium: {
        hello: Math.round(viewedHello),
        "1": Math.round(viewed1),
        "1.2": Math.round(viewed1), // Not tracked separately, use value from "1"
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
        "1.2": Math.round(viewed1), // Not tracked separately, use value from "1"
        "2": Math.round(viewed2),
        "3": Math.round(viewed3),
        ps1: Math.round(viewedPs1),
        premium1: Math.round(viewedPremium1),
        premium2: Math.round(viewedPremium2),
        premium3: Math.round(viewedPremium3),
        summary: Math.round(viewedSummary),
        noPremium1: Math.round(viewedNoPremium1_premium),
        notification: Math.round(viewedNotification_noPremium), // Use the same value for both flows since notification is common
      },
    };

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

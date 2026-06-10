import { NextRequest, NextResponse } from "next/server";
import {
  getOnboardingFlowFilter,
  ONBOARDING_V2_PAGE_ORDER,
  parseOnboardingFlowVersion,
  type OnboardingFlowVersion,
} from "@/lib/onboarding-analytics";

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

function getFlowFilter(onboardingFlowVersion: OnboardingFlowVersion): string {
  return getOnboardingFlowFilter(onboardingFlowVersion);
}

// In-memory response cache to avoid hammering PostHog on tab switches / rerenders.
// PostHog free tier is rate-limited (HTTP 429), so we serve a fresh response only
// every CACHE_TTL_MS while still allowing manual cache busting via a redeploy.
const CACHE_TTL_MS = 60_000;
type CacheEntry = { value: unknown; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();

function getCachedResponse(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedResponse(key: string, value: unknown): void {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function parseRetryAfterMs(
  errorText: string,
  retryAfterHeader: string | null
): number {
  // Honour `Retry-After` header (seconds) if present.
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000 + 500, 30_000);
    }
  }
  // Fall back to parsing PostHog throttle detail string, e.g.
  // "Request was throttled. Expected available in 27 seconds."
  try {
    const json = JSON.parse(errorText) as { detail?: string };
    const match = json.detail?.match(/(\d+)\s*seconds?/i);
    if (match) {
      const seconds = Number(match[1]);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(seconds * 1000 + 500, 30_000);
      }
    }
  } catch {
    // ignore parse errors
  }
  return 2_000;
}

async function fetchPostHogRaw(
  query: string
): Promise<Array<Array<number | string>>> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: {
      kind: "HogQLQuery",
      query,
    },
  });

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      const errorText = await response.text();
      const waitMs = parseRetryAfterMs(
        errorText,
        response.headers.get("Retry-After")
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
    }

    const data: PostHogQueryResponse = await response.json();
    const results = data.results || data.responseData?.results;
    return results ?? [];
  }

  throw new Error("PostHog API error: exhausted retries");
}

async function queryPostHogArray(
  query: string
): Promise<Array<Array<number | string>>> {
  return fetchPostHogRaw(query);
}

async function queryPostHog(query: string): Promise<number> {
  const results = await fetchPostHogRaw(query);
  if (results.length === 0) return 0;
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
  onboardingFlowVersion: OnboardingFlowVersion = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getFlowFilter(
    onboardingFlowVersion
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
  onboardingFlowVersion: OnboardingFlowVersion = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getFlowFilter(
    onboardingFlowVersion
  )}`;
  return `SELECT avg(toFloatOrDefault(JSONExtractString(properties,'total_duration_seconds'), 0.0)) AS value FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'action') = 'completed' AND ${baseFilters}`;
}

function buildPageViewQuery(
  startIso: string,
  endIso: string,
  pageName: string,
  premiumActive?: boolean,
  environment: string = "production",
  onboardingFlowVersion: OnboardingFlowVersion = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getFlowFilter(
    onboardingFlowVersion
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
 * Single grouped query returning per-page (and per-premium-state) view counts.
 * Replaces N separate `buildPageViewQuery` calls to avoid PostHog 429 throttling.
 */
function buildGroupedPageViewQuery(
  startIso: string,
  endIso: string,
  environment: string = "production",
  onboardingFlowVersion: OnboardingFlowVersion = "v2"
): string {
  const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getFlowFilter(
    onboardingFlowVersion
  )}`;

  // Normalise `premium_active` so we treat both bool (JSONExtractBool=1) and
  // stringified ("true") representations the same way (matches the per-page
  // queries in `buildPageViewQuery`).
  const premiumExpr = `(JSONExtractBool(properties,'premium_active') = 1 OR JSONExtractString(properties,'premium_active') = 'true')`;

  return `SELECT JSONExtractString(properties,'page_name') AS page_name, ${premiumExpr} AS is_premium, uniqExact(JSONExtractString(properties,'session_id')) AS value FROM events WHERE event = 'onboarding_step' AND (JSONExtractString(properties,'action') = 'viewed' OR JSONExtractString(properties,'action') = 'completed') AND ${baseFilters} GROUP BY page_name, is_premium`;
}

type ReviewAnalytics = {
  modalShown: number;
  rateTapped: number;
  dismissedNotNow: number;
  dismissedSwipe: number;
  ratings: Record<string, number>;
  completedRated: number;
  completedNotNow: number;
  completedSwipe: number;
};

function reviewBaseFilters(
  startIso: string,
  endIso: string,
  environment: string,
  onboardingFlowVersion: OnboardingFlowVersion
): string {
  return `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getFlowFilter(
    onboardingFlowVersion
  )}`;
}

async function fetchTaskPracticeOpens(
  startIso: string,
  endIso: string,
  environment: string,
  onboardingFlowVersion: OnboardingFlowVersion
): Promise<{ totalSessions: number; byType: Record<string, number> }> {
  const base = reviewBaseFilters(
    startIso,
    endIso,
    environment,
    onboardingFlowVersion
  );

  const totalQuery = `SELECT uniqExact(JSONExtractString(properties,'session_id')) AS value FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'page_name') = 'tasks' AND (JSONExtractString(properties,'action') = 'task_practice_opened' OR (JSONExtractString(properties,'action') = 'element_pressed' AND JSONExtractString(properties,'element_type') = 'practice_card')) AND ${base}`;

  const byTypeQuery = `
    SELECT
      coalesce(
        nullIf(JSONExtractString(properties,'practice_type'), ''),
        arrayElement(splitByChar('|', JSONExtractString(properties,'element_value')), 2)
      ) AS practice_type,
      uniqExact(JSONExtractString(properties,'session_id')) AS count
    FROM events
    WHERE event = 'onboarding_step'
      AND JSONExtractString(properties,'page_name') = 'tasks'
      AND (
        JSONExtractString(properties,'action') = 'task_practice_opened'
        OR (
          JSONExtractString(properties,'action') = 'element_pressed'
          AND JSONExtractString(properties,'element_type') = 'practice_card'
        )
      )
      AND ${base}
    GROUP BY practice_type
    HAVING practice_type != ''
    ORDER BY count DESC
  `;

  const [totalSessions, typeRows] = await Promise.all([
    queryPostHog(totalQuery),
    queryPostHogArray(byTypeQuery),
  ]);

  const byType: Record<string, number> = {};
  for (const row of typeRows) {
    const type = String(row[0] ?? "").trim();
    if (!type) continue;
    byType[type] = Number(row[1]) || 0;
  }

  return {
    totalSessions: Math.round(totalSessions),
    byType,
  };
}

async function fetchReviewAnalytics(
  startIso: string,
  endIso: string,
  environment: string,
  onboardingFlowVersion: OnboardingFlowVersion
): Promise<ReviewAnalytics> {
  const base = reviewBaseFilters(
    startIso,
    endIso,
    environment,
    onboardingFlowVersion
  );

  const modalShownQuery = `SELECT uniqExact(JSONExtractString(properties,'session_id')) AS value FROM events WHERE event = 'onboarding_review_modal_shown' AND ${base}`;
  const rateTappedQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_review_rate_tapped' AND ${base}`;
  const ratingsQuery = `SELECT JSONExtractString(properties,'rating') AS rating, count() AS count FROM events WHERE event = 'onboarding_review_rate_tapped' AND ${base} GROUP BY rating ORDER BY rating`;
  const dismissedQuery = `SELECT JSONExtractString(properties,'reason') AS reason, count() AS count FROM events WHERE event = 'onboarding_review_dismissed' AND ${base} GROUP BY reason`;
  const completedQuery = `SELECT JSONExtractString(properties,'element_type') AS element_type, count() AS count FROM events WHERE event = 'onboarding_step' AND JSONExtractString(properties,'page_name') = 'review' AND JSONExtractString(properties,'action') = 'completed' AND ${base} GROUP BY element_type`;

  const [
    modalShown,
    rateTapped,
    ratingRows,
    dismissedRows,
    completedRows,
  ] = await Promise.all([
    queryPostHog(modalShownQuery),
    queryPostHog(rateTappedQuery),
    queryPostHogArray(ratingsQuery),
    queryPostHogArray(dismissedQuery),
    queryPostHogArray(completedQuery),
  ]);

  const ratings: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  for (const row of ratingRows) {
    const key = String(row[0] ?? "").trim();
    if (key in ratings) {
      ratings[key] = Number(row[1]) || 0;
    }
  }

  let dismissedNotNow = 0;
  let dismissedSwipe = 0;
  for (const row of dismissedRows) {
    const reason = String(row[0] ?? "");
    const count = Number(row[1]) || 0;
    if (reason === "not_now") dismissedNotNow += count;
    else if (reason === "swipe") dismissedSwipe += count;
  }

  let completedRated = 0;
  let completedNotNow = 0;
  let completedSwipe = 0;
  for (const row of completedRows) {
    const elementType = String(row[0] ?? "");
    const count = Number(row[1]) || 0;
    if (elementType === "review_rated") completedRated += count;
    else if (elementType === "review_not_now") completedNotNow += count;
    else if (elementType === "review_swipe") completedSwipe += count;
  }

  return {
    modalShown: Math.round(modalShown),
    rateTapped: Math.round(rateTapped),
    dismissedNotNow,
    dismissedSwipe,
    ratings,
    completedRated,
    completedNotNow,
    completedSwipe,
  };
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";
    const onboardingFlowVersion = parseOnboardingFlowVersion(
      searchParams.get("onboardingFlowVersion") ??
        searchParams.get("analyticsVersion")
    );

    // Validate timeRange
    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    const cacheKey = `onboarding:${onboardingFlowVersion}:${timeRange}:${environment}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
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
      onboardingFlowVersion
    );
    const completedQuery = buildOnboardingQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      "completed",
      environment,
      onboardingFlowVersion
    );
    const durationQuery = buildDurationQuery(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      environment,
      onboardingFlowVersion
    );

    // Build queries for comparison period
    const startedComparisonQuery = buildOnboardingQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      "started",
      environment,
      onboardingFlowVersion
    );
    const completedComparisonQuery = buildOnboardingQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      "completed",
      environment,
      onboardingFlowVersion
    );
    const durationComparisonQuery = buildDurationQuery(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      environment,
      onboardingFlowVersion
    );

    const baseFiltersForTrials = `timestamp >= toDateTime('${currentWindow.start.toISOString()}','Europe/Warsaw') AND timestamp < toDateTime('${currentWindow.end.toISOString()}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getFlowFilter(
      onboardingFlowVersion
    )}`;

    const paywall1ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price1' AND ${baseFiltersForTrials}`;
    const paywall2ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price2' AND ${baseFiltersForTrials}`;
    const paywall3ViewsQuery = `SELECT count() AS value FROM events WHERE event = 'onboarding_paywall_action' AND JSONExtractString(properties,'action') = 'viewed' AND JSONExtractString(properties,'variant') = 'price3' AND ${baseFiltersForTrials}`;

    const paywallVariants =
      onboardingFlowVersion === "v2"
        ? "('price3')"
        : "('price1', 'price2')";

    const trialStartedQuery = `
      SELECT
        JSONExtractString(properties,'variant') AS variant,
        coalesce(JSONExtractString(properties,'selected_period'), '') AS period,
        count() AS count
      FROM events
      WHERE event = 'onboarding_paywall_action'
        AND JSONExtractString(properties,'action') = 'trial_started'
        AND ${baseFiltersForTrials}
        AND JSONExtractString(properties,'variant') IN ${paywallVariants}
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
        AND JSONExtractString(properties,'variant') IN ${paywallVariants}
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
    let paywall3Views: number;
    let trialStartedResults: Array<Array<number | string>>;
    let purchaseSuccessResults: Array<Array<number | string>>;

    let pagesData: {
      noPremium?: Record<string, number>;
      premium?: Record<string, number>;
      flow?: Record<string, number>;
    };
    let reviewData: ReviewAnalytics | null = null;
    let taskPracticeOpens: { totalSessions: number; byType: Record<string, number> } | null =
      null;

    if (onboardingFlowVersion === "v2") {
      const groupedPageQuery = buildGroupedPageViewQuery(
        curStart,
        curEnd,
        environment,
        onboardingFlowVersion
      );
      const [
        v2Started,
        v2StartedComparison,
        v2Completed,
        v2CompletedComparison,
        v2AvgDuration,
        v2AvgDurationComparison,
        groupedPageRows,
        v2Paywall3Views,
        v2TrialStartedResults,
        v2PurchaseSuccessResults,
        v2ReviewData,
        v2TaskPracticeOpens,
      ] = await Promise.all([
        queryPostHog(startedQuery),
        queryPostHog(startedComparisonQuery),
        queryPostHog(completedQuery),
        queryPostHog(completedComparisonQuery),
        queryPostHog(durationQuery),
        queryPostHog(durationComparisonQuery),
        queryPostHogArray(groupedPageQuery),
        queryPostHog(paywall3ViewsQuery),
        queryPostHogArray(trialStartedQuery),
        queryPostHogArray(purchaseSuccessQuery),
        fetchReviewAnalytics(curStart, curEnd, environment, onboardingFlowVersion),
        fetchTaskPracticeOpens(curStart, curEnd, environment, onboardingFlowVersion),
      ]);

      started = v2Started;
      startedComparison = v2StartedComparison;
      completed = v2Completed;
      completedComparison = v2CompletedComparison;
      avgDuration = v2AvgDuration;
      avgDurationComparison = v2AvgDurationComparison;
      paywall1Views = 0;
      paywall2Views = 0;
      paywall3Views = v2Paywall3Views;
      trialStartedResults = v2TrialStartedResults;
      purchaseSuccessResults = v2PurchaseSuccessResults;
      reviewData = v2ReviewData;
      taskPracticeOpens = v2TaskPracticeOpens;

      // Aggregate per page across premium / non-premium states for v2 funnel.
      const pageCountByName = new Map<string, number>();
      for (const row of groupedPageRows) {
        const pageName = String(row[0] ?? "");
        const count = Number(row[2]) || 0;
        if (!pageName) continue;
        pageCountByName.set(
          pageName,
          (pageCountByName.get(pageName) ?? 0) + count
        );
      }

      pagesData = {
        flow: Object.fromEntries(
          ONBOARDING_V2_PAGE_ORDER.map((p) => [
            p,
            Math.round(pageCountByName.get(p) ?? 0),
          ])
        ),
      };
    } else {
      // Single grouped query covering all v1 onboarding pages, split by
      // `premium_active` so we can reconstruct the premium / no-premium funnels.
      const groupedPageQuery = buildGroupedPageViewQuery(
        curStart,
        curEnd,
        environment,
        onboardingFlowVersion
      );

      const [
        v1Started,
        v1StartedComparison,
        v1Completed,
        v1CompletedComparison,
        v1AvgDuration,
        v1AvgDurationComparison,
        groupedPageRows,
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
        queryPostHogArray(groupedPageQuery),
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
      paywall3Views = 0;
      trialStartedResults = v1TrialStartedResults;
      purchaseSuccessResults = v1PurchaseSuccessResults;

      // Build lookup: page_name -> { premium, noPremium, any }.
      const byPage = new Map<
        string,
        { premium: number; noPremium: number; any: number }
      >();
      for (const row of groupedPageRows) {
        const pageName = String(row[0] ?? "");
        if (!pageName) continue;
        // `is_premium` is a boolean expression in HogQL that comes back as 0/1
        // (or rarely the string "1"/"0"); normalise to a boolean.
        const isPremium = Number(row[1]) === 1;
        const count = Number(row[2]) || 0;
        const entry =
          byPage.get(pageName) ?? { premium: 0, noPremium: 0, any: 0 };
        if (isPremium) entry.premium += count;
        else entry.noPremium += count;
        entry.any += count;
        byPage.set(pageName, entry);
      }

      const any = (page: string): number => byPage.get(page)?.any ?? 0;
      const premium = (page: string): number =>
        byPage.get(page)?.premium ?? 0;
      const noPremium = (page: string): number =>
        byPage.get(page)?.noPremium ?? 0;

      const practiceTotal = Math.round(
        noPremium("breathing") +
          noPremium("diary1") +
          noPremium("questions1")
      );

      pagesData = {
        noPremium: {
          hello: Math.round(any("hello")),
          "1": Math.round(any("1")),
          "1.2": Math.round(any("1")),
          "2": Math.round(any("2")),
          "3": Math.round(any("3")),
          ps1: Math.round(any("ps1")),
          noPremium1: Math.round(noPremium("noPremium1")),
          noPremium2: Math.round(noPremium("noPremium2")),
          practice: practiceTotal,
          notification: Math.round(any("notification")),
          ps2: Math.round(noPremium("ps2")),
        },
        premium: {
          hello: Math.round(any("hello")),
          "1": Math.round(any("1")),
          "1.2": Math.round(any("1")),
          "2": Math.round(any("2")),
          "3": Math.round(any("3")),
          ps1: Math.round(any("ps1")),
          premium1: Math.round(premium("premium1")),
          premium2: Math.round(premium("premium2")),
          premium3: Math.round(premium("premium3")),
          summary: Math.round(premium("summary")),
          noPremium1: Math.round(premium("noPremium1")),
          notification: Math.round(any("notification")),
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

    type PaywallTrialStats = {
      views: number;
      trialsStarted: { monthly: number; annual: number; total: number };
      purchases: { monthly: number; annual: number; total: number };
    };

    const emptyPaywallStats = (): PaywallTrialStats => ({
      views: 0,
      trialsStarted: { monthly: 0, annual: 0, total: 0 },
      purchases: { monthly: 0, annual: 0, total: 0 },
    });

    const trialsData: {
      ps1: PaywallTrialStats;
      ps2: PaywallTrialStats;
      ps3?: PaywallTrialStats;
    } = {
      ps1: { ...emptyPaywallStats(), views: Math.round(paywall1Views) },
      ps2: { ...emptyPaywallStats(), views: Math.round(paywall2Views) },
    };

    if (onboardingFlowVersion === "v2") {
      trialsData.ps3 = {
        ...emptyPaywallStats(),
        views: Math.round(paywall3Views),
      };
    }

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
      } else if (variant === "price3" && trialsData.ps3) {
        if (period === "monthly") {
          trialsData.ps3.trialsStarted.monthly += countValue;
        } else if (period === "annual") {
          trialsData.ps3.trialsStarted.annual += countValue;
        }
        trialsData.ps3.trialsStarted.total += countValue;
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
      } else if (variant === "price3" && trialsData.ps3) {
        if (period === "monthly") {
          trialsData.ps3.purchases.monthly += countValue;
        } else if (period === "annual") {
          trialsData.ps3.purchases.annual += countValue;
        }
        trialsData.ps3.purchases.total += countValue;
      }
    });

    const responseBody = {
      onboardingFlowVersion,
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
      review: reviewData,
      taskPracticeOpens,
    };

    setCachedResponse(cacheKey, responseBody);
    return NextResponse.json(responseBody);
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

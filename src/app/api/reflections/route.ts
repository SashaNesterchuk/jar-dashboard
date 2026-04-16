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

  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: { kind: "HogQLQuery", query },
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
  return results && results.length > 0 ? results : [];
}

async function queryPostHog(query: string): Promise<number> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  const apiKey = POSTHOG_API_KEY.trim();
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const body = JSON.stringify({
    query: { kind: "HogQLQuery", query },
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

  if (!results || results.length === 0) return 0;

  const value = results[0]?.[0];
  return typeof value === "number" ? value : Number(value) || 0;
}

function getTimeWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (timeRange) {
    case "30d":
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      break;
    case "90d":
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      break;
    default:
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
  }

  const startAdjusted = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)
  );
  startAdjusted.setHours(startAdjusted.getHours() - 1);

  const endAdjusted = new Date(
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0)
  );
  endAdjusted.setDate(endAdjusted.getDate() + 1);
  endAdjusted.setHours(endAdjusted.getHours() - 1);

  return { start: startAdjusted, end: endAdjusted };
}

function getComparisonWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (timeRange) {
    case "30d":
      end = new Date(now);
      end.setDate(end.getDate() - 30);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      break;
    case "90d":
      end = new Date(now);
      end.setDate(end.getDate() - 90);
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      break;
    default:
      end = new Date(now);
      end.setDate(end.getDate() - 7);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
  }

  const startAdjusted = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)
  );
  startAdjusted.setHours(startAdjusted.getHours() - 1);

  const endAdjusted = new Date(
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0)
  );
  endAdjusted.setDate(endAdjusted.getDate() + 1);
  endAdjusted.setHours(endAdjusted.getHours() - 1);

  return { start: startAdjusted, end: endAdjusted };
}

function calculateDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatChange(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function extractPeriodCount(
  results: Array<Array<number | string>>,
  period: string
): number {
  for (const row of results) {
    const rowPeriod = (Array.isArray(row) ? row[0] : "")?.toString() || "";
    const count = (Array.isArray(row) ? row[1] : 0) || 0;
    if (
      rowPeriod.toLowerCase() === period.toLowerCase() ||
      (period === "annual" && rowPeriod.toLowerCase() === "yearly")
    ) {
      return typeof count === "number" ? count : Number(count) || 0;
    }
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";
    const analyticsVersionParam =
      searchParams.get("analyticsVersion") || "v2";
    const analyticsVersion: "v1" | "v2" =
      analyticsVersionParam === "v1" ? "v1" : "v2";

    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    const currentWindow = getTimeWindow(timeRange);
    const comparisonWindow = getComparisonWindow(timeRange);

    const startIso = currentWindow.start.toISOString();
    const endIso = currentWindow.end.toISOString();
    const compStartIso = comparisonWindow.start.toISOString();
    const compEndIso = comparisonWindow.end.toISOString();

    const vf = getVersionFilter(analyticsVersion);

    const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${vf}`;
    const compFilters = `timestamp >= toDateTime('${compStartIso}','Europe/Warsaw') AND timestamp < toDateTime('${compEndIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${vf}`;

    const reflectionTypeFilter = `JSONExtractString(properties,'practice_type') = 'reflection'`;

    // --- Current period queries ---

    const startedDirectQ = `SELECT count() AS value FROM events WHERE event = 'practice_started' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const startedFromPracticesQ = `SELECT count() AS value FROM events WHERE event = 'chat_closed_early' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const completedQ = `SELECT count() AS value FROM events WHERE event = 'practice_completed' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const cancelledQ = `SELECT count() AS value FROM events WHERE event = 'practice_cancelled' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const totalMessagesQ = `SELECT coalesce(sum(toIntOrZero(JSONExtractString(properties,'message_count'))), 0) AS value FROM events WHERE event = 'chat_closed_early' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const sourcePracticesQ = `SELECT JSONExtractString(properties,'original_practice_name') AS practice_name, count() AS cnt FROM events WHERE event = 'chat_closed_early' AND ${reflectionTypeFilter} AND ${baseFilters} AND JSONExtractString(properties,'original_practice_name') IS NOT NULL AND JSONExtractString(properties,'original_practice_name') != '' GROUP BY practice_name ORDER BY cnt DESC`;

    const paywallViewsQ = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'viewed' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const trialsStartedQ = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${reflectionTypeFilter} AND ${baseFilters}`;

    const trialsByPeriodQ = `SELECT JSONExtractString(properties,'selected_period') AS period, count() AS cnt FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${reflectionTypeFilter} AND ${baseFilters} AND JSONExtractString(properties,'selected_period') IS NOT NULL AND JSONExtractString(properties,'selected_period') != '' GROUP BY period`;

    // --- Comparison period queries ---

    const compStartedDirectQ = `SELECT count() AS value FROM events WHERE event = 'practice_started' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compStartedFromPracticesQ = `SELECT count() AS value FROM events WHERE event = 'chat_closed_early' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compCompletedQ = `SELECT count() AS value FROM events WHERE event = 'practice_completed' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compCancelledQ = `SELECT count() AS value FROM events WHERE event = 'practice_cancelled' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compTotalMessagesQ = `SELECT coalesce(sum(toIntOrZero(JSONExtractString(properties,'message_count'))), 0) AS value FROM events WHERE event = 'chat_closed_early' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compPaywallViewsQ = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'viewed' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compTrialsStartedQ = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${reflectionTypeFilter} AND ${compFilters}`;

    const compTrialsByPeriodQ = `SELECT JSONExtractString(properties,'selected_period') AS period, count() AS cnt FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${reflectionTypeFilter} AND ${compFilters} AND JSONExtractString(properties,'selected_period') IS NOT NULL AND JSONExtractString(properties,'selected_period') != '' GROUP BY period`;

    const [
      startedDirect,
      compStartedDirect,
      startedFromPractices,
      compStartedFromPractices,
      completed,
      compCompleted,
      cancelled,
      compCancelled,
      totalMessages,
      compTotalMessages,
      sourcePractices,
      paywallViews,
      compPaywallViews,
      trialsStarted,
      compTrialsStarted,
      trialsByPeriod,
      compTrialsByPeriod,
    ] = await Promise.all([
      queryPostHog(startedDirectQ),
      queryPostHog(compStartedDirectQ),
      queryPostHog(startedFromPracticesQ),
      queryPostHog(compStartedFromPracticesQ),
      queryPostHog(completedQ),
      queryPostHog(compCompletedQ),
      queryPostHog(cancelledQ),
      queryPostHog(compCancelledQ),
      queryPostHog(totalMessagesQ),
      queryPostHog(compTotalMessagesQ),
      queryPostHogArray(sourcePracticesQ),
      queryPostHog(paywallViewsQ),
      queryPostHog(compPaywallViewsQ),
      queryPostHog(trialsStartedQ),
      queryPostHog(compTrialsStartedQ),
      queryPostHogArray(trialsByPeriodQ),
      queryPostHogArray(compTrialsByPeriodQ),
    ]);

    const monthly = extractPeriodCount(trialsByPeriod, "monthly");
    const annual = extractPeriodCount(trialsByPeriod, "annual");
    const total = monthly + annual;
    const compMonthly = extractPeriodCount(compTrialsByPeriod, "monthly");
    const compAnnual = extractPeriodCount(compTrialsByPeriod, "annual");
    const compTotal = compMonthly + compAnnual;

    const sourcePracticesList = sourcePractices.map((row) => ({
      name: (Array.isArray(row) ? row[0] : "")?.toString() || "Unknown",
      count:
        typeof row[1] === "number" ? row[1] : Number(row[1]) || 0,
    }));

    const d1 = calculateDelta(startedDirect, compStartedDirect);
    const d2 = calculateDelta(startedFromPractices, compStartedFromPractices);
    const d3 = calculateDelta(completed, compCompleted);
    const d4 = calculateDelta(cancelled, compCancelled);
    const d5 = calculateDelta(totalMessages, compTotalMessages);
    const d6 = calculateDelta(paywallViews, compPaywallViews);
    const d7 = calculateDelta(trialsStarted, compTrialsStarted);
    const d8 = calculateDelta(monthly, compMonthly);
    const d9 = calculateDelta(annual, compAnnual);
    const d10 = calculateDelta(total, compTotal);

    return NextResponse.json({
      startedDirect: {
        value: Math.round(startedDirect),
        previous: Math.round(compStartedDirect),
        delta: d1,
        change: formatChange(d1),
      },
      startedFromPractices: {
        value: Math.round(startedFromPractices),
        previous: Math.round(compStartedFromPractices),
        delta: d2,
        change: formatChange(d2),
      },
      completed: {
        value: Math.round(completed),
        previous: Math.round(compCompleted),
        delta: d3,
        change: formatChange(d3),
      },
      cancelled: {
        value: Math.round(cancelled),
        previous: Math.round(compCancelled),
        delta: d4,
        change: formatChange(d4),
      },
      totalMessages: {
        value: Math.round(totalMessages),
        previous: Math.round(compTotalMessages),
        delta: d5,
        change: formatChange(d5),
      },
      sourcePractices: sourcePracticesList,
      trial: {
        paywallViews: {
          value: Math.round(paywallViews),
          previous: Math.round(compPaywallViews),
          delta: d6,
          change: formatChange(d6),
        },
        trialsStarted: {
          value: Math.round(trialsStarted),
          previous: Math.round(compTrialsStarted),
          delta: d7,
          change: formatChange(d7),
        },
        monthly: {
          value: Math.round(monthly),
          previous: Math.round(compMonthly),
          delta: d8,
          change: formatChange(d8),
        },
        annual: {
          value: Math.round(annual),
          previous: Math.round(compAnnual),
          delta: d9,
          change: formatChange(d9),
        },
        total: {
          value: Math.round(total),
          previous: Math.round(compTotal),
          delta: d10,
          change: formatChange(d10),
        },
      },
    });
  } catch (error) {
    console.error("Reflections API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch reflections data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

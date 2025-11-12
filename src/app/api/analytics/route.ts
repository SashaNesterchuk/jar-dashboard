import { NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://eu.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "50390";
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

async function queryPostHog(query: string): Promise<number> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  const response = await fetch(
    `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query,
        },
      }),
    }
  );

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

function dayWindow(offsetDays: number = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Create midnight in Warsaw timezone (UTC+1 winter, UTC+2 summer)
  // For UTC+1: midnight Warsaw = 23:00 previous day UTC
  const year = d.getFullYear();
  const month = d.getMonth();
  const date = d.getDate();
  const start = new Date(Date.UTC(year, month, date, 0, 0, 0));
  start.setHours(start.getHours() - 1); // Adjust for Warsaw offset (UTC+1)
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function weekWindow(offsetWeeks: number = 0) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - offsetWeeks * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start, end };
}

function monthWindow(offsetMonths: number = 0) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - offsetMonths * 30);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start, end };
}

function buildQuery(
  startIso: string,
  endIso: string,
  environment: string = "production"
): string {
  return `SELECT uniqExact(JSONExtractString(properties,'user_id')) AS value FROM events WHERE timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND JSONExtractString(properties,'user_id') IS NOT NULL AND JSONExtractString(properties,'user_id') != ''`;
}

export async function GET() {
  try {
    const environment = "production";

    // DAU: Today vs Yesterday
    const today = dayWindow(0);
    const yesterday = dayWindow(-1);
    const dauQuery = buildQuery(
      today.start.toISOString(),
      today.end.toISOString(),
      environment
    );
    const dauComparisonQuery = buildQuery(
      yesterday.start.toISOString(),
      yesterday.end.toISOString(),
      environment
    );

    // WAU: Last 7 days vs Previous 7 days
    const lastWeek = weekWindow(0);
    const prevWeek = weekWindow(1);
    const wauQuery = buildQuery(
      lastWeek.start.toISOString(),
      lastWeek.end.toISOString(),
      environment
    );
    const wauComparisonQuery = buildQuery(
      prevWeek.start.toISOString(),
      prevWeek.end.toISOString(),
      environment
    );

    // MAU: Last 30 days vs Previous 30 days
    const lastMonth = monthWindow(0);
    const prevMonth = monthWindow(1);
    const mauQuery = buildQuery(
      lastMonth.start.toISOString(),
      lastMonth.end.toISOString(),
      environment
    );
    const mauComparisonQuery = buildQuery(
      prevMonth.start.toISOString(),
      prevMonth.end.toISOString(),
      environment
    );

    // Execute all queries in parallel
    const [dau, dauComparison, wau, wauComparison, mau, mauComparison] =
      await Promise.all([
        queryPostHog(dauQuery),
        queryPostHog(dauComparisonQuery),
        queryPostHog(wauQuery),
        queryPostHog(wauComparisonQuery),
        queryPostHog(mauQuery),
        queryPostHog(mauComparisonQuery),
      ]);

    // Calculate percentage changes
    function calculateDelta(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    }

    const dauDelta = calculateDelta(dau, dauComparison);
    const wauDelta = calculateDelta(wau, wauComparison);
    const mauDelta = calculateDelta(mau, mauComparison);

    return NextResponse.json({
      dau: {
        value: dau,
        previous: dauComparison,
        delta: dauDelta,
        change: `${dauDelta >= 0 ? "+" : ""}${dauDelta.toFixed(1)}%`,
      },
      wau: {
        value: wau,
        previous: wauComparison,
        delta: wauDelta,
        change: `${wauDelta >= 0 ? "+" : ""}${wauDelta.toFixed(1)}%`,
      },
      mau: {
        value: mau,
        previous: mauComparison,
        delta: mauDelta,
        change: `${mauDelta >= 0 ? "+" : ""}${mauDelta.toFixed(1)}%`,
      },
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

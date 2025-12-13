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

const TARGET_TIMEZONE = "Europe/Warsaw";

async function queryPostHog(query: string): Promise<any[]> {
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

  return results || [];
}

function getDateRange(daysAgo: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  return { start, end };
}

async function calculateFrequencyDistribution(
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    frequency: string;
    count: number;
    percentage: number;
    avgD30Retention: number;
  }>
> {
  // Calculate checkin frequency per user
  const query = `
    WITH user_checkins AS (
      SELECT 
        JSONExtractString(properties, 'user_id') AS uid,
        count() AS total_checkins,
        dateDiff('day', toDate('${
          startDate.toISOString().split("T")[0]
        }'), toDate('${endDate.toISOString().split("T")[0]}')) AS period_days
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'mood_check_in_completed'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
      GROUP BY uid
    ),
    categorized_users AS (
      SELECT 
        uid,
        total_checkins,
        (total_checkins * 7.0) / period_days AS checkins_per_week,
        multiIf(
          (total_checkins * 7.0) / period_days >= 6, 'daily',
          (total_checkins * 7.0) / period_days >= 3, 'several_per_week',
          (total_checkins * 7.0) / period_days >= 1, 'weekly',
          'less'
        ) AS frequency
      FROM user_checkins
      WHERE period_days > 0
    )
    SELECT 
      frequency,
      count() AS user_count
    FROM categorized_users
    GROUP BY frequency
    ORDER BY 
      multiIf(
        frequency = 'daily', 1,
        frequency = 'several_per_week', 2,
        frequency = 'weekly', 3,
        4
      )
  `;

  const results = await queryPostHog(query);
  const total = results.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);

  // For now, return without retention data (would require complex join with retention calculation)
  return results.map((row) => {
    const count = Number(row[1]) || 0;
    return {
      frequency: String(row[0]),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      avgD30Retention: 0, // Placeholder - would need retention calculation
    };
  });
}

async function getTrends(
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; dailyUsers: number; weeklyUsers: number }>> {
  const query = `
    WITH daily_checkins AS (
      SELECT 
        formatDateTime(timestamp, '%Y-%m-%d') AS date,
        JSONExtractString(properties, 'user_id') AS uid
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'mood_check_in_completed'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
    )
    SELECT 
      date,
      uniqExact(uid) AS daily_users
    FROM daily_checkins
    GROUP BY date
    ORDER BY date
  `;

  const results = await queryPostHog(query);

  return results.map((row) => ({
    date: String(row[0]),
    dailyUsers: Number(row[1]) || 0,
    weeklyUsers: 0, // Simplified - would need rolling window calculation
  }));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "30d";

    // Validate timeRange
    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    const days = parseInt(timeRange);
    const dateRange = getDateRange(days);

    // Fetch frequency distribution and trends
    const [frequencyDistribution, trends] = await Promise.all([
      calculateFrequencyDistribution(dateRange.start, dateRange.end),
      getTrends(dateRange.start, dateRange.end),
    ]);

    return NextResponse.json({
      frequencyDistribution,
      trends,
    });
  } catch (error) {
    console.error("Checkin habits API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch checkin habits",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

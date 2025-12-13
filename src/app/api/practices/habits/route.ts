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

async function calculateStreakStatistics(
  startDate: Date,
  endDate: Date
): Promise<{
  usersWithStreak3Plus: { value: number; percentage: number };
  usersWithStreak7Plus: { value: number; percentage: number };
  usersWithStreak14Plus: { value: number; percentage: number };
}> {
  // Get users with practice days
  const query = `
    WITH user_practice_days AS (
      SELECT 
        JSONExtractString(properties, 'user_id') AS uid,
        formatDateTime(timestamp, '%Y-%m-%d') AS practice_date
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'practice_completed'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND toInt(coalesce(JSONExtractString(properties, 'completion_percentage'), '0')) >= 80
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
      GROUP BY uid, practice_date
    ),
    user_stats AS (
      SELECT 
        uid,
        uniqExact(practice_date) AS days_with_practice
      FROM user_practice_days
      GROUP BY uid
    )
    SELECT 
      count() AS total_users,
      countIf(days_with_practice >= 3) AS streak_3_plus,
      countIf(days_with_practice >= 7) AS streak_7_plus,
      countIf(days_with_practice >= 14) AS streak_14_plus
    FROM user_stats
  `;

  const results = await queryPostHog(query);

  if (results.length === 0) {
    return {
      usersWithStreak3Plus: { value: 0, percentage: 0 },
      usersWithStreak7Plus: { value: 0, percentage: 0 },
      usersWithStreak14Plus: { value: 0, percentage: 0 },
    };
  }

  const row = results[0];
  const totalUsers = Number(row[0]) || 0;
  const streak3Plus = Number(row[1]) || 0;
  const streak7Plus = Number(row[2]) || 0;
  const streak14Plus = Number(row[3]) || 0;

  return {
    usersWithStreak3Plus: {
      value: streak3Plus,
      percentage: totalUsers > 0 ? (streak3Plus / totalUsers) * 100 : 0,
    },
    usersWithStreak7Plus: {
      value: streak7Plus,
      percentage: totalUsers > 0 ? (streak7Plus / totalUsers) * 100 : 0,
    },
    usersWithStreak14Plus: {
      value: streak14Plus,
      percentage: totalUsers > 0 ? (streak14Plus / totalUsers) * 100 : 0,
    },
  };
}

async function calculateARPPA(
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  const query = `
    WITH practice_counts AS (
      SELECT 
        JSONExtractString(properties, 'practice_type') AS practice_type,
        count() AS total_practices,
        uniqExact(JSONExtractString(properties, 'user_id')) AS active_users
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'practice_completed'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND toInt(coalesce(JSONExtractString(properties, 'completion_percentage'), '0')) >= 80
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
        AND JSONExtractString(properties, 'practice_type') IS NOT NULL
        AND JSONExtractString(properties, 'practice_type') != ''
      GROUP BY practice_type
    )
    SELECT 
      practice_type,
      total_practices / active_users AS arppa
    FROM practice_counts
    WHERE active_users > 0
  `;

  const results = await queryPostHog(query);

  const arppa: Record<string, number> = {};
  results.forEach((row) => {
    const practiceType = String(row[0]);
    const value = Number(row[1]) || 0;
    arppa[practiceType] = value;
  });

  return arppa;
}

async function getTopStreaks(
  startDate: Date,
  endDate: Date
): Promise<
  Array<{
    userId: string;
    daysWithPractice: number;
    practiceTypes: string[];
  }>
> {
  const query = `
    WITH user_practice_days AS (
      SELECT 
        JSONExtractString(properties, 'user_id') AS uid,
        formatDateTime(timestamp, '%Y-%m-%d') AS practice_date,
        groupUniqArray(JSONExtractString(properties, 'practice_type')) AS practice_types
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'practice_completed'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND toInt(coalesce(JSONExtractString(properties, 'completion_percentage'), '0')) >= 80
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
      GROUP BY uid, practice_date
    ),
    user_stats AS (
      SELECT 
        uid,
        uniqExact(practice_date) AS days_with_practice,
        arrayDistinct(arrayFlatten(groupArray(practice_types))) AS all_practice_types
      FROM user_practice_days
      GROUP BY uid
    )
    SELECT 
      uid,
      days_with_practice,
      all_practice_types
    FROM user_stats
    ORDER BY days_with_practice DESC
    LIMIT 10
  `;

  const results = await queryPostHog(query);

  return results.map((row) => ({
    userId: "anonymous", // Don't expose actual user IDs
    daysWithPractice: Number(row[1]) || 0,
    practiceTypes: Array.isArray(row[2]) ? row[2].filter((t) => t) : [],
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

    // Fetch all habit metrics in parallel
    const [streakStats, arppa, topStreaks] = await Promise.all([
      calculateStreakStatistics(dateRange.start, dateRange.end),
      calculateARPPA(dateRange.start, dateRange.end),
      getTopStreaks(dateRange.start, dateRange.end),
    ]);

    return NextResponse.json({
      summary: streakStats,
      arppa,
      topStreaks,
    });
  } catch (error) {
    console.error("Practice habits API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch practice habits",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

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

async function calculateEngagementMetrics(
  startDate: Date,
  endDate: Date
): Promise<{
  sessionsPerDAU: number;
  engagedSessionsRate: number;
  avgSessionDuration: number;
}> {
  // Calculate Sessions per DAU and Engaged sessions rate
  const query = `
    WITH sessions AS (
      SELECT 
        JSONExtractString(properties, 'session_id') AS sid,
        JSONExtractString(properties, 'user_id') AS uid,
        min(timestamp) AS session_start,
        max(timestamp) AS session_end,
        dateDiff('second', min(timestamp), max(timestamp)) AS duration,
        countIf(event IN ('practice_started', 'mood_check_in_started')) > 0 AS has_engagement
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'session_id') IS NOT NULL
        AND JSONExtractString(properties, 'session_id') != ''
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
      GROUP BY sid, uid
    )
    SELECT 
      uniqExact(uid) AS dau,
      count() AS total_sessions,
      countIf(has_engagement AND duration >= 30) AS engaged_sessions,
      avg(duration) AS avg_duration
    FROM sessions
  `;

  const results = await queryPostHog(query);

  if (results.length === 0) {
    return {
      sessionsPerDAU: 0,
      engagedSessionsRate: 0,
      avgSessionDuration: 0,
    };
  }

  const row = results[0];
  const dau = Number(row[0]) || 1;
  const totalSessions = Number(row[1]) || 0;
  const engagedSessions = Number(row[2]) || 0;
  const avgDuration = Number(row[3]) || 0;

  return {
    sessionsPerDAU: totalSessions / dau,
    engagedSessionsRate:
      totalSessions > 0 ? engagedSessions / totalSessions : 0,
    avgSessionDuration: avgDuration,
  };
}

async function getUserDistributionByPractices(
  startDate: Date,
  endDate: Date
): Promise<Array<{ bucket: string; count: number; percentage: number }>> {
  const query = `
    WITH user_practices AS (
      SELECT 
        JSONExtractString(properties, 'user_id') AS uid,
        countIf(
          event = 'practice_completed' 
          AND toInt(coalesce(JSONExtractString(properties, 'completion_percentage'), '0')) >= 80
        ) AS practice_count
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
      GROUP BY uid
    )
    SELECT 
      multiIf(
        practice_count = 0, '0',
        practice_count >= 1 AND practice_count <= 3, '1-3',
        practice_count >= 4 AND practice_count <= 7, '4-7',
        '8+'
      ) AS bucket,
      count() AS user_count
    FROM user_practices
    GROUP BY bucket
    ORDER BY 
      multiIf(
        bucket = '0', 1,
        bucket = '1-3', 2,
        bucket = '4-7', 3,
        4
      )
  `;

  const results = await queryPostHog(query);
  const total = results.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);

  return results.map((row) => {
    const count = Number(row[1]) || 0;
    return {
      bucket: String(row[0]),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
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

    // Current period
    const currentRange = getDateRange(days);
    // Previous period (same length)
    const previousRange = getDateRange(days * 2);
    previousRange.end = currentRange.start;

    // Fetch engagement metrics for current and previous periods
    const [currentMetrics, previousMetrics, userDistribution] =
      await Promise.all([
        calculateEngagementMetrics(currentRange.start, currentRange.end),
        calculateEngagementMetrics(previousRange.start, previousRange.end),
        getUserDistributionByPractices(currentRange.start, currentRange.end),
      ]);

    // Calculate deltas
    function calculateDelta(curr: number, prev: number): number {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    }

    return NextResponse.json({
      sessionsPerDAU: {
        value: currentMetrics.sessionsPerDAU,
        previous: previousMetrics.sessionsPerDAU,
        delta: calculateDelta(
          currentMetrics.sessionsPerDAU,
          previousMetrics.sessionsPerDAU
        ),
      },
      engagedSessionsRate: {
        value: currentMetrics.engagedSessionsRate,
        previous: previousMetrics.engagedSessionsRate,
        delta: calculateDelta(
          currentMetrics.engagedSessionsRate,
          previousMetrics.engagedSessionsRate
        ),
      },
      avgSessionDuration: {
        value: currentMetrics.avgSessionDuration,
        previous: previousMetrics.avgSessionDuration,
        delta: calculateDelta(
          currentMetrics.avgSessionDuration,
          previousMetrics.avgSessionDuration
        ),
      },
      userDistribution: {
        practices: userDistribution,
      },
    });
  } catch (error) {
    console.error("Engagement summary API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch engagement summary",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

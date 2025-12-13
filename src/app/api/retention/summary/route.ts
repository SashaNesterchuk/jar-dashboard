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

interface RetentionData {
  cohortDate: string;
  cohortSize: number;
  day1Retained: number;
  day7Retained: number;
  day30Retained: number;
}

async function calculateRetention(
  startDate: Date,
  endDate: Date,
  segmentFilter?: string
): Promise<RetentionData[]> {
  // Build the retention query
  // This query finds users who started onboarding and tracks if they were active on D+1, D+7, D+30
  const query = `
    WITH cohorts AS (
      SELECT 
        JSONExtractString(properties, 'user_id') AS uid,
        formatDateTime(min(timestamp), '%Y-%m-%d') AS signup_date
        ${segmentFilter ? `, ${segmentFilter}` : ""}
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'onboarding_step'
        AND JSONExtractString(properties, 'action') = 'started'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
      GROUP BY uid ${segmentFilter ? ", " + segmentFilter.split(" AS ")[0] : ""}
    ),
    activity AS (
      SELECT DISTINCT
        JSONExtractString(properties, 'user_id') AS uid,
        formatDateTime(timestamp, '%Y-%m-%d') AS activity_date
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${new Date(
          endDate.getTime() + 30 * 24 * 60 * 60 * 1000
        ).toISOString()}', '${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
    )
    SELECT 
      c.signup_date,
      uniqExact(c.uid) AS cohort_size,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 1) AS day1_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 7) AS day7_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 30) AS day30_retained
    FROM cohorts c
    LEFT JOIN activity a ON c.uid = a.uid
    GROUP BY c.signup_date
    ORDER BY c.signup_date DESC
  `;

  const results = await queryPostHog(query);

  return results.map((row) => ({
    cohortDate: String(row[0]),
    cohortSize: Number(row[1]) || 0,
    day1Retained: Number(row[2]) || 0,
    day7Retained: Number(row[3]) || 0,
    day30Retained: Number(row[4]) || 0,
  }));
}

function aggregateRetention(data: RetentionData[]): {
  d1: number;
  d7: number;
  d30: number;
} {
  if (data.length === 0) {
    return { d1: 0, d7: 0, d30: 0 };
  }

  let totalCohortSize = 0;
  let totalD1Retained = 0;
  let totalD7Retained = 0;
  let totalD30Retained = 0;

  // Only include cohorts that have had enough time to measure retention
  const now = new Date();

  data.forEach((cohort) => {
    const cohortDate = new Date(cohort.cohortDate);
    const daysAgo = Math.floor(
      (now.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysAgo >= 30) {
      // Can measure all retention periods
      totalCohortSize += cohort.cohortSize;
      totalD1Retained += cohort.day1Retained;
      totalD7Retained += cohort.day7Retained;
      totalD30Retained += cohort.day30Retained;
    } else if (daysAgo >= 7) {
      // Can only measure D1 and D7
      totalCohortSize += cohort.cohortSize;
      totalD1Retained += cohort.day1Retained;
      totalD7Retained += cohort.day7Retained;
    } else if (daysAgo >= 1) {
      // Can only measure D1
      totalCohortSize += cohort.cohortSize;
      totalD1Retained += cohort.day1Retained;
    }
  });

  return {
    d1: totalCohortSize > 0 ? totalD1Retained / totalCohortSize : 0,
    d7: totalCohortSize > 0 ? totalD7Retained / totalCohortSize : 0,
    d30: totalCohortSize > 0 ? totalD30Retained / totalCohortSize : 0,
  };
}

async function getSegmentedRetention(
  startDate: Date,
  endDate: Date,
  segmentField: string,
  segmentAlias: string
): Promise<Array<{ segment: string; d1: number; d7: number; d30: number }>> {
  try {
    // Query for segment-specific retention
    const query = `
      WITH cohorts AS (
        SELECT 
          JSONExtractString(properties, 'user_id') AS uid,
          formatDateTime(min(timestamp), '%Y-%m-%d') AS signup_date,
          any(JSONExtractString(properties, '${segmentField}')) AS segment_value
        FROM events
        WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
          AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
          AND event = 'onboarding_step'
          AND JSONExtractString(properties, 'action') = 'started'
          AND JSONExtractString(properties, 'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
          AND JSONExtractString(properties, 'user_id') IS NOT NULL
          AND JSONExtractString(properties, 'user_id') != ''
        GROUP BY uid
      ),
      activity AS (
        SELECT DISTINCT
          JSONExtractString(properties, 'user_id') AS uid,
          formatDateTime(timestamp, '%Y-%m-%d') AS activity_date
        FROM events
        WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
          AND timestamp < toDateTime('${new Date(
            endDate.getTime() + 30 * 24 * 60 * 60 * 1000
          ).toISOString()}', '${TARGET_TIMEZONE}')
          AND JSONExtractString(properties, 'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
          AND JSONExtractString(properties, 'user_id') IS NOT NULL
          AND JSONExtractString(properties, 'user_id') != ''
      )
      SELECT 
        c.segment_value,
        c.signup_date,
        uniqExact(c.uid) AS cohort_size,
        uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 1) AS day1_retained,
        uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 7) AS day7_retained,
        uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 30) AS day30_retained
      FROM cohorts c
      LEFT JOIN activity a ON c.uid = a.uid
      WHERE c.segment_value IS NOT NULL AND c.segment_value != ''
      GROUP BY c.segment_value, c.signup_date
      ORDER BY c.segment_value, c.signup_date DESC
    `;

    const results = await queryPostHog(query);

    // Group by segment and aggregate
    const segmentMap = new Map<
      string,
      { totalSize: number; d1: number; d7: number; d30: number; count: number }
    >();

    const now = new Date();

    results.forEach((row) => {
      const segment = String(row[0]);
      const cohortDate = new Date(String(row[1]));
      const cohortSize = Number(row[2]) || 0;
      const day1Retained = Number(row[3]) || 0;
      const day7Retained = Number(row[4]) || 0;
      const day30Retained = Number(row[5]) || 0;

      const daysAgo = Math.floor(
        (now.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysAgo >= 30 && cohortSize > 0) {
        const existing = segmentMap.get(segment) || {
          totalSize: 0,
          d1: 0,
          d7: 0,
          d30: 0,
          count: 0,
        };

        segmentMap.set(segment, {
          totalSize: existing.totalSize + cohortSize,
          d1: existing.d1 + day1Retained,
          d7: existing.d7 + day7Retained,
          d30: existing.d30 + day30Retained,
          count: existing.count + 1,
        });
      }
    });

    // Convert to array and calculate rates
    return Array.from(segmentMap.entries())
      .map(([segment, data]) => ({
        segment,
        d1: data.totalSize > 0 ? data.d1 / data.totalSize : 0,
        d7: data.totalSize > 0 ? data.d7 / data.totalSize : 0,
        d30: data.totalSize > 0 ? data.d30 / data.totalSize : 0,
      }))
      .filter((item) => item.segment) // Filter out empty segments
      .sort((a, b) => b.d7 - a.d7); // Sort by D7 retention
  } catch (error) {
    console.error(`Error fetching ${segmentAlias} retention:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "90d";

    // Validate timeRange
    if (!["30d", "90d", "180d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 30d, 90d, or 180d" },
        { status: 400 }
      );
    }

    const days = parseInt(timeRange);

    // Current period
    const currentRange = getDateRange(days);
    // Previous period (same length)
    const previousRange = getDateRange(days * 2);
    previousRange.end = currentRange.start;

    // Fetch retention data for current and previous periods
    const [currentData, previousData] = await Promise.all([
      calculateRetention(currentRange.start, currentRange.end),
      calculateRetention(previousRange.start, previousRange.end),
    ]);

    // Aggregate retention rates
    const current = aggregateRetention(currentData);
    const previous = aggregateRetention(previousData);

    // Calculate deltas
    function calculateDelta(curr: number, prev: number): number {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    }

    // Generate trend data (last 30 cohorts for sparklines)
    const trendData = currentData.slice(0, 30).reverse();

    // Fetch segment breakdowns in parallel
    const [platformSegments, countrySegments, premiumSegments] =
      await Promise.all([
        getSegmentedRetention(
          currentRange.start,
          currentRange.end,
          "platform",
          "platform"
        ),
        getSegmentedRetention(
          currentRange.start,
          currentRange.end,
          "country",
          "country"
        ),
        getSegmentedRetention(
          currentRange.start,
          currentRange.end,
          "is_premium",
          "premium"
        ),
      ]);

    return NextResponse.json({
      d1: {
        rate: current.d1,
        previous: previous.d1,
        delta: calculateDelta(current.d1, previous.d1),
        trend: trendData.map((d) => ({
          date: d.cohortDate,
          value: d.cohortSize > 0 ? d.day1Retained / d.cohortSize : 0,
        })),
      },
      d7: {
        rate: current.d7,
        previous: previous.d7,
        delta: calculateDelta(current.d7, previous.d7),
        trend: trendData.map((d) => ({
          date: d.cohortDate,
          value: d.cohortSize > 0 ? d.day7Retained / d.cohortSize : 0,
        })),
      },
      d30: {
        rate: current.d30,
        previous: previous.d30,
        delta: calculateDelta(current.d30, previous.d30),
        trend: trendData.map((d) => ({
          date: d.cohortDate,
          value: d.cohortSize > 0 ? d.day30Retained / d.cohortSize : 0,
        })),
      },
      segments: {
        platform: platformSegments.slice(0, 5), // Top 5
        country: countrySegments.slice(0, 5), // Top 5
        premium: premiumSegments.slice(0, 2), // Premium vs non-premium
      },
    });
  } catch (error) {
    console.error("Retention summary API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch retention summary",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

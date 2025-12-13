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

interface CohortRetentionData {
  cohortDate: string;
  cohortSize: number;
  retention: {
    day0: number;
    day1: number;
    day7: number;
    day14: number;
    day30: number;
    day60?: number;
    day90?: number;
  };
}

async function calculateCohortRetention(
  startDate: Date,
  endDate: Date,
  bucket: "weekly" | "monthly",
  platform?: string,
  country?: string,
  premium?: string
): Promise<CohortRetentionData[]> {
  // Determine the cohort grouping function
  const cohortDateFunc =
    bucket === "weekly" ? "toStartOfWeek" : "toStartOfMonth";

  // Build filter conditions
  let additionalFilters = "";
  if (platform) {
    additionalFilters += ` AND JSONExtractString(properties, 'platform') = '${platform}'`;
  }
  if (country) {
    additionalFilters += ` AND JSONExtractString(properties, 'country') = '${country}'`;
  }
  if (premium) {
    additionalFilters += ` AND JSONExtractString(properties, 'is_premium') = '${premium}'`;
  }

  // Build the cohort retention query
  // This tracks users from signup through day 0, 1, 7, 14, 30, 60, 90
  const query = `
    WITH cohorts AS (
      SELECT 
        JSONExtractString(properties, 'user_id') AS uid,
        ${cohortDateFunc}(toDate(formatDateTime(min(timestamp), '%Y-%m-%d'))) AS cohort_date,
        formatDateTime(min(timestamp), '%Y-%m-%d') AS signup_date
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND event = 'onboarding_step'
        AND JSONExtractString(properties, 'action') = 'started'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
        ${additionalFilters}
      GROUP BY uid
    ),
    activity AS (
      SELECT DISTINCT
        JSONExtractString(properties, 'user_id') AS uid,
        formatDateTime(timestamp, '%Y-%m-%d') AS activity_date
      FROM events
      WHERE timestamp >= toDateTime('${startDate.toISOString()}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${new Date(
          endDate.getTime() + 90 * 24 * 60 * 60 * 1000
        ).toISOString()}', '${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = 'production'
        AND JSONExtractString(properties, 'user_id') IS NOT NULL
        AND JSONExtractString(properties, 'user_id') != ''
    )
    SELECT 
      c.cohort_date,
      uniqExact(c.uid) AS cohort_size,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 0) AS day0_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 1) AS day1_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 7) AS day7_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 14) AS day14_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 30) AS day30_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 60) AS day60_retained,
      uniqExactIf(a.uid, dateDiff('day', toDate(c.signup_date), toDate(a.activity_date)) = 90) AS day90_retained
    FROM cohorts c
    LEFT JOIN activity a ON c.uid = a.uid
    GROUP BY c.cohort_date
    ORDER BY c.cohort_date DESC
  `;

  const results = await queryPostHog(query);

  return results.map((row) => {
    const cohortSize = Number(row[1]) || 0;

    return {
      cohortDate: String(row[0]),
      cohortSize,
      retention: {
        day0: cohortSize > 0 ? (Number(row[2]) || 0) / cohortSize : 0,
        day1: cohortSize > 0 ? (Number(row[3]) || 0) / cohortSize : 0,
        day7: cohortSize > 0 ? (Number(row[4]) || 0) / cohortSize : 0,
        day14: cohortSize > 0 ? (Number(row[5]) || 0) / cohortSize : 0,
        day30: cohortSize > 0 ? (Number(row[6]) || 0) / cohortSize : 0,
        day60: cohortSize > 0 ? (Number(row[7]) || 0) / cohortSize : 0,
        day90: cohortSize > 0 ? (Number(row[8]) || 0) / cohortSize : 0,
      },
    };
  });
}

function formatCohortDate(
  dateStr: string,
  bucket: "weekly" | "monthly"
): string {
  const date = new Date(dateStr);

  if (bucket === "weekly") {
    // Format as "2025-W01"
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const weekNumber = Math.ceil(
      ((date.getTime() - startOfYear.getTime()) / 86400000 +
        startOfYear.getDay() +
        1) /
        7
    );
    return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
  } else {
    // Format as "2025-01"
    return date.toISOString().slice(0, 7);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "90d";
    const bucket = (searchParams.get("bucket") || "weekly") as
      | "weekly"
      | "monthly";
    const platform = searchParams.get("platform") || undefined;
    const country = searchParams.get("country") || undefined;
    const premium = searchParams.get("premium") || undefined;

    // Validate parameters
    if (!["7d", "30d", "90d", "180d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, 90d, or 180d" },
        { status: 400 }
      );
    }

    if (!["weekly", "monthly"].includes(bucket)) {
      return NextResponse.json(
        { error: "Invalid bucket. Must be weekly or monthly" },
        { status: 400 }
      );
    }

    const days = parseInt(timeRange);
    const dateRange = getDateRange(days);

    // Fetch cohort retention data
    const cohortData = await calculateCohortRetention(
      dateRange.start,
      dateRange.end,
      bucket,
      platform,
      country,
      premium
    );

    // Format the response
    const formattedCohorts = cohortData.map((cohort) => ({
      cohortDate: formatCohortDate(cohort.cohortDate, bucket),
      cohortSize: cohort.cohortSize,
      retention: {
        day0: Math.round(cohort.retention.day0 * 100),
        day1: Math.round(cohort.retention.day1 * 100),
        day7: Math.round(cohort.retention.day7 * 100),
        day14: Math.round(cohort.retention.day14 * 100),
        day30: Math.round(cohort.retention.day30 * 100),
        day60: Math.round((cohort.retention.day60 || 0) * 100),
        day90: Math.round((cohort.retention.day90 || 0) * 100),
      },
    }));

    // Filter out cohorts that are too new (not enough time to measure retention)
    const now = new Date();
    const filteredCohorts = formattedCohorts.filter((cohort) => {
      const cohortDate = new Date(cohort.cohortDate);
      const daysAgo = Math.floor(
        (now.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysAgo >= 1; // At least 1 day old to show D1 retention
    });

    return NextResponse.json({
      cohorts: filteredCohorts,
      metadata: {
        bucket,
        timeRange,
        filters: {
          platform: platform || "all",
          country: country || "all",
          premium: premium || "all",
        },
      },
    });
  } catch (error) {
    console.error("Retention cohorts API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch cohort retention data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

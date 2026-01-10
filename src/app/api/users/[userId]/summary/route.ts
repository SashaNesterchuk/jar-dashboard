import { NextRequest, NextResponse } from "next/server";
import { getOrAssignName } from "@/lib/user-names";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;

if (!POSTHOG_API_KEY) {
  console.error("POSTHOG_API_KEY is not set");
}

interface PostHogQueryResponse {
  results?: Array<Array<number | string | Record<string, any>>>;
  responseData?: {
    results?: Array<Array<number | string | Record<string, any>>>;
  };
}

const TARGET_TIMEZONE = "Europe/Warsaw";

async function queryPostHogArray(
  query: string
): Promise<Array<Array<number | string | Record<string, any>>>> {
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

  if (!results || results.length === 0) {
    return [];
  }

  return results;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const environment = "production";
    
    // All time: from 2024-01-01 to now
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date();
    
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const baseFilters = `
      timestamp >= toDateTime('${startIso}', '${TARGET_TIMEZONE}')
      AND timestamp < toDateTime('${endIso}', '${TARGET_TIMEZONE}')
      AND JSONExtractString(properties, 'user_id') = '${userId}'
      AND JSONExtractString(properties, 'consent_status') = 'granted'
      AND coalesce(JSONExtractString(properties, 'environment'), 'production') = '${environment}'
    `;

    // Query for total unique sessions (batched within 5-minute windows)
    const sessionsQuery = `
      SELECT count() as total_sessions
      FROM (
        SELECT 
          user_id,
          session_batch
        FROM (
          SELECT 
            JSONExtractString(properties,'user_id') as user_id,
            JSONExtractString(properties,'session_id') as session_id,
            toUnixTimestamp(min(timestamp)) as first_event_ts,
            intDiv(toUnixTimestamp(min(timestamp)), 300) as session_batch
          FROM events
          WHERE ${baseFilters}
            AND JSONExtractString(properties,'session_id') IS NOT NULL
            AND JSONExtractString(properties,'session_id') != ''
          GROUP BY user_id, session_id
        )
        GROUP BY user_id, session_batch
      )
    `;

    // Query for total practices started
    const practicesStartedQuery = `
      SELECT count() as total_practices
      FROM events
      WHERE event = 'practice_started'
        AND ${baseFilters}
        AND JSONExtractString(properties, 'event_id') IS NOT NULL
        AND JSONExtractString(properties, 'event_id') != ''
    `;

    // Query for total check-ins completed
    const checkinsCompletedQuery = `
      SELECT count() as total_checkins
      FROM events
      WHERE event = 'mood_check_in_completed'
        AND ${baseFilters}
    `;

    console.log("Fetching summary for user:", userId);

    // Execute all queries in parallel
    const [sessionsResult, practicesResult, checkinsResult] = await Promise.all([
      queryPostHogArray(sessionsQuery),
      queryPostHogArray(practicesStartedQuery),
      queryPostHogArray(checkinsCompletedQuery),
    ]);

    const totalSessions = Number(sessionsResult[0]?.[0] || 0);
    const totalPractices = Number(practicesResult[0]?.[0] || 0);
    const totalCheckins = Number(checkinsResult[0]?.[0] || 0);
    
    // Generate or get assigned name for user (only if they have more than 1 session)
    const userName = getOrAssignName(userId, totalSessions);

    return NextResponse.json({
      userId,
      userName: userName !== userId ? userName : null,
      totalSessions,
      totalPractices,
      totalCheckins,
      dateRange: {
        start: startIso,
        end: endIso,
      },
    });
  } catch (error) {
    console.error("User Summary API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user summary",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


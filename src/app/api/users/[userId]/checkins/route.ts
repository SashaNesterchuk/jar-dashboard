import { NextRequest, NextResponse } from "next/server";

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

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

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

interface CheckinEvent {
  checkInId: string;
  timestamp: string;
  event: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const environment = "production";

    // Get time window from params or default to last 7 days
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last 7 days
      end = new Date();
      start = new Date();
      start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    console.log(
      `[User Checkins API] userId=${userId}, start=${startIso}, end=${endIso}`
    );

    // Query for completed check-in events (main events)
    const checkinsQuery = `
      SELECT 
        JSONExtractString(properties,'check_in_id') as check_in_id,
        timestamp,
        event,
        properties
      FROM events
      WHERE event = 'mood_check_in_completed'
        AND timestamp >= toDateTime('${startIso}','${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endIso}','${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'user_id') = '${userId}'
        AND JSONExtractString(properties,'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const results = await queryPostHogArray(checkinsQuery);

    console.log(
      `[User Checkins API] Found ${results.length} completed check-in events from PostHog`
    );

    // Process completed check-in events
    const checkins = results
      .map((row) => {
        const checkInId = String(row[0] || "");
        const timestampRaw = row[1];
        const timestamp = isDate(timestampRaw)
          ? timestampRaw.toISOString()
          : String(timestampRaw || "");
        const event = String(row[2] || "");
        const properties = typeof row[3] === "object" ? row[3] : {};

        if (!timestamp) {
          return null;
        }

        return {
          checkInId: checkInId || "unknown",
          timestamp,
          status: "completed" as const,
          duration: 0, // We don't have start time, so duration is 0
          pagesViewed: 0, // Would need additional query to get page views
          pages: [],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    console.log(
      `[User Checkins API] Returning ${checkins.length} unique check-ins`
    );

    return NextResponse.json({
      userId,
      startDate: startIso,
      endDate: endIso,
      checkins,
      totalCheckins: checkins.length,
    });
  } catch (error) {
    console.error("User Checkins API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user check-ins",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


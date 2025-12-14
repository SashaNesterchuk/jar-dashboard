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
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Default to last 7 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const environment = "production";

    // Query to fetch ALL events for a specific user
    const userEventsQuery = `
      SELECT 
        timestamp,
        event,
        JSONExtractString(properties, 'session_id') as session_id,
        properties
      FROM events
      WHERE timestamp >= toDateTime('${startIso}', '${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endIso}', '${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'user_id') = '${userId}'
        AND JSONExtractString(properties, 'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties, 'environment'), 'production') = '${environment}'
      ORDER BY timestamp DESC
      LIMIT 100000
    `;

    console.log("Fetching events for user:", userId);
    console.log("Query:", userEventsQuery);

    const results = await queryPostHogArray(userEventsQuery);

    console.log(`PostHog returned ${results.length} raw results`);

    // Transform results
    const events = results.map((row) => {
      const timestamp = String(row[0] || "");
      const event = String(row[1] || "");
      const sessionId = String(row[2] || "");
      const properties = typeof row[3] === "object" ? row[3] : {};

      return {
        timestamp,
        event,
        sessionId,
        properties,
      };
    });

    return NextResponse.json({
      userId,
      startDate: startIso,
      endDate: endIso,
      events,
      totalEvents: events.length,
    });
  } catch (error) {
    console.error("User Events API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user events",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

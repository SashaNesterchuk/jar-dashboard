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

function isDate(value: unknown): value is Date {
  return value instanceof Date;
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

interface SessionEvent {
  sessionId: string;
  practiceId: string;
  practiceName: string;
  practiceType: string;
  timestamp: string;
  event: string;
  completionPercentage: number;
  country: string;
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
      `[User Practices API] userId=${userId}, start=${startIso}, end=${endIso}`
    );

    // Set limit based on date range to get sufficient data
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const limit = diffDays > 90 ? 10000 : diffDays > 30 ? 5000 : diffDays > 7 ? 2000 : 1000;

    const practicesQuery = `
      SELECT 
        concat(toString(timestamp), '_', JSONExtractString(properties,'event_id'), '_', distinct_id) as session_id,
        JSONExtractString(properties,'event_id') as practice_id,
        coalesce(JSONExtractString(properties,'practice_name'), JSONExtractString(properties,'event_id')) as practice_name,
        coalesce(JSONExtractString(properties,'practice_type'), 'practice') as practice_type,
        timestamp,
        event,
        toInt(coalesce(JSONExtractString(properties,'completion_percentage'), '0')) as completion_percentage,
        coalesce(JSONExtractString(properties,'$geoip_country_code'), 'Unknown') as country
      FROM events
      WHERE event IN ('practice_started', 'practice_completed')
        AND timestamp >= toDateTime('${startIso}','${TARGET_TIMEZONE}')
        AND timestamp < toDateTime('${endIso}','${TARGET_TIMEZONE}')
        AND JSONExtractString(properties, 'user_id') = '${userId}'
        AND JSONExtractString(properties,'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
        AND JSONExtractString(properties,'event_id') IS NOT NULL
        AND JSONExtractString(properties,'event_id') != ''
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    const results = await queryPostHogArray(practicesQuery);

    console.log(
      `[User Practices API] Found ${results.length} raw practice events from PostHog`
    );

    // Process results - group by practice + time window to create sessions
    const sessionMap = new Map<string, SessionEvent>();

    for (const row of results) {
      const sessionId = String(row[0] || "");
      const practiceId = String(row[1] || "");
      const practiceName = String(row[2] || "") || practiceId;
      const practiceType = String(row[3] || "") || "practice";
      const timestampRaw = row[4];
      const timestamp = isDate(timestampRaw)
        ? timestampRaw.toISOString()
        : String(timestampRaw || "");
      const event = String(row[5] || "");
      const completionPercentage =
        typeof row[6] === "number" ? row[6] : Number(row[6]) || 0;
      const country = String(row[7] || "Unknown");

      if (!sessionId || !practiceId || !timestamp) {
        continue;
      }

      // Create a key for grouping events into sessions
      // Using practice + rounded timestamp (5 minute window)
      const timestampDate = new Date(timestamp);
      const roundedTime = new Date(
        Math.floor(timestampDate.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)
      );
      const sessionKey = `${practiceId}_${roundedTime.toISOString()}`;

      const existingSession = sessionMap.get(sessionKey);

      if (existingSession) {
        // Update existing session if this event is more complete
        if (
          event === "practice_completed" &&
          completionPercentage >= 80 &&
          existingSession.event !== "practice_completed"
        ) {
          existingSession.event = event;
          existingSession.completionPercentage = completionPercentage;
        }
        // Use the latest timestamp
        if (new Date(timestamp) > new Date(existingSession.timestamp)) {
          existingSession.timestamp = timestamp;
        }
      } else {
        // Create new session
        sessionMap.set(sessionKey, {
          sessionId: sessionKey,
          practiceId,
          practiceName,
          practiceType,
          timestamp,
          event,
          completionPercentage,
          country,
        });
      }
    }

    // Convert to final format
    const sessions = Array.from(sessionMap.values()).map((session) => {
      const completed =
        session.event === "practice_completed" &&
        session.completionPercentage >= 80;

      return {
        sessionId: session.sessionId,
        practiceId: session.practiceId,
        practiceName: session.practiceName,
        practiceType: session.practiceType,
        timestamp: session.timestamp,
        completed,
        completionPercentage: session.completionPercentage,
        country: session.country,
      };
    });

    // Sort by timestamp descending
    sessions.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    console.log(
      `[User Practices API] Returning ${sessions.length} unique practice sessions`
    );

    return NextResponse.json({
      userId,
      startDate: startIso,
      endDate: endIso,
      sessions,
      totalSessions: sessions.length,
    });
  } catch (error) {
    console.error("User Practices API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user practices",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


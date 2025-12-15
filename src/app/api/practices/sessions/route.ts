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
const MS_IN_DAY = 24 * 60 * 60 * 1000;

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

function parseTimeZoneOffset(label: string): number {
  const match = label.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return 0;
  }
  const sign = match[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(parseInt(match[1], 10));
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return sign * (hours * 60 + minutes);
}

function getStartOfDayInTimeZone(date: Date, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  const year = Number(lookup("year") ?? date.getUTCFullYear());
  const month = Number(lookup("month") ?? date.getUTCMonth() + 1);
  const day = Number(lookup("day") ?? date.getUTCDate());
  const offsetLabel = lookup("timeZoneName") ?? "GMT+0";
  const offsetMinutes = parseTimeZoneOffset(offsetLabel);

  const midnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(midnightUtc - offsetMinutes * 60 * 1000);
}

function getTimeWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  const startOfToday = getStartOfDayInTimeZone(now, TARGET_TIMEZONE);
  const end = new Date(startOfToday.getTime() + MS_IN_DAY);

  const daysToInclude = timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 7;

  const start = new Date(end.getTime() - daysToInclude * MS_IN_DAY);

  return { start, end };
}

interface SessionEvent {
  sessionId: string;
  practiceId: string;
  practiceName: string;
  practiceType: string;
  userId: string;
  timestamp: string;
  event: string;
  completionPercentage: number;
  country: string;
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";

    // Validate timeRange
    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    // Get time window
    const timeWindow = getTimeWindow(timeRange);
    const startIso = timeWindow.start.toISOString();
    const endIso = timeWindow.end.toISOString();

    // Build query to get all practice events
    const sessionsQuery = `
      SELECT 
        concat(toString(timestamp), '_', JSONExtractString(properties,'event_id'), '_', distinct_id) as session_id,
        JSONExtractString(properties,'event_id') as practice_id,
        coalesce(JSONExtractString(properties,'practice_name'), JSONExtractString(properties,'event_id')) as practice_name,
        coalesce(JSONExtractString(properties,'practice_type'), 'practice') as practice_type,
        distinct_id as user_id,
        timestamp,
        event,
        toInt(coalesce(JSONExtractString(properties,'completion_percentage'), '0')) as completion_percentage,
        coalesce(JSONExtractString(properties,'$geoip_country_code'), 'Unknown') as country
      FROM events
      WHERE event IN ('practice_started', 'practice_completed', 'mood_check_in_completed')
        AND timestamp >= toDateTime('${startIso}','Europe/Warsaw')
        AND timestamp < toDateTime('${endIso}','Europe/Warsaw')
        AND JSONExtractString(properties,'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
        AND JSONExtractString(properties,'event_id') IS NOT NULL
        AND JSONExtractString(properties,'event_id') != ''
      ORDER BY timestamp DESC
    `;

    const results = await queryPostHogArray(sessionsQuery);

    // Process results - group by user + practice + time window to create sessions
    const sessionMap = new Map<string, SessionEvent>();

    for (const row of results) {
      const sessionId = String(row[0] || "");
      const practiceId = String(row[1] || "");
      const practiceName = String(row[2] || "") || practiceId;
      const practiceType = String(row[3] || "") || "practice";
      const userId = String(row[4] || "");
      // row[5] is timestamp - could be DateTime object or string
      const timestampRaw = row[5];
      const timestamp = isDate(timestampRaw)
        ? timestampRaw.toISOString()
        : String(timestampRaw || "");
      const event = String(row[6] || "");
      const completionPercentage =
        typeof row[7] === "number" ? row[7] : Number(row[7]) || 0;
      const country = String(row[8] || "Unknown");

      if (!sessionId || !practiceId || !userId || !timestamp) {
        continue;
      }

      // Create a key for grouping events into sessions
      // Using user + practice + rounded timestamp (5 minute window)
      const timestampDate = new Date(timestamp);
      const roundedTime = new Date(
        Math.floor(timestampDate.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)
      );
      const sessionKey = `${userId}_${practiceId}_${roundedTime.toISOString()}`;

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
        } else if (
          event === "mood_check_in_completed" &&
          existingSession.event !== "practice_completed"
        ) {
          existingSession.event = event;
          existingSession.completionPercentage = 100;
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
          userId,
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
        session.event === "practice_completed"
          ? session.completionPercentage >= 80
          : session.event === "mood_check_in_completed";

      return {
        sessionId: session.sessionId,
        practiceId: session.practiceId,
        practiceName: session.practiceName,
        practiceType: session.practiceType,
        userId: session.userId,
        timestamp: session.timestamp,
        completed,
        country: session.country,
      };
    });

    // Sort by timestamp descending
    sessions.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Practice sessions API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch practice sessions data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

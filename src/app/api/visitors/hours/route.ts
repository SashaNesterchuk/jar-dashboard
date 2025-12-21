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

async function queryPostHogArray(
  query: string
): Promise<Array<Array<string | number>>> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }

  // Trim any whitespace from API key
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

  // Parse timezone offset
  const match = offsetLabel.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  let offsetMinutes = 0;
  if (match) {
    const sign = match[1].startsWith("-") ? -1 : 1;
    const hours = Math.abs(parseInt(match[1], 10));
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    offsetMinutes = sign * (hours * 60 + minutes);
  }

  const midnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(midnightUtc - offsetMinutes * 60 * 1000);
}

function getTimeWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  const startOfToday = getStartOfDayInTimeZone(now, TARGET_TIMEZONE);
  const end = new Date(startOfToday.getTime() + MS_IN_DAY); // exclusive

  const daysToInclude = timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 7;

  const start = new Date(end.getTime() - daysToInclude * MS_IN_DAY);

  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "90d";

    // Validate timeRange
    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    // Get time window
    const timeWindow = getTimeWindow(timeRange);

    // Build query to get all sessions with start time, timezone, and country
    // Debug: Test query to check available timezone fields
    const testQuery = `
      SELECT 
        JSONExtractString(properties, '$geoip_time_zone') as geoip_tz,
        JSONExtractString(properties, 'timezone') as custom_tz,
        JSONExtractString(properties, 'country') as country,
        properties
      FROM events
      WHERE timestamp >= toDateTime('${timeWindow.start.toISOString()}','UTC')
        AND JSONExtractString(properties,'consent_status') = 'granted'
        AND JSONExtractString(properties,'user_id') IS NOT NULL
      LIMIT 5
    `;

    console.log("Debug: Testing timezone fields availability");
    const testResults = await queryPostHogArray(testQuery);
    console.log("Debug: Test results:", JSON.stringify(testResults, null, 2));

    // New approach: Get session starts with timezone from PostHog GeoIP
    // PostHog automatically adds $geoip_time_zone based on IP address
    // Using $geoip_time_zone instead of custom timezone property
    const sessionsQuery = `
      WITH session_starts AS (
        SELECT 
          min(timestamp) as session_start,
          JSONExtractString(properties,'user_id') as user_id,
          coalesce(
            JSONExtractString(properties, '$geoip_time_zone'),
            'UTC'
          ) as timezone,
          JSONExtractString(properties,'session_id') as session_id
        FROM events
        WHERE timestamp >= toDateTime('${timeWindow.start.toISOString()}','UTC') 
          AND timestamp < toDateTime('${timeWindow.end.toISOString()}','UTC')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'session_id') IS NOT NULL
          AND JSONExtractString(properties,'session_id') != ''
        GROUP BY user_id, session_id, timezone
      )
      SELECT
        session_start,
        user_id,
        timezone
      FROM session_starts
      LIMIT 50000
    `;

    // Execute query
    const results = await queryPostHogArray(sessionsQuery);

    // Return raw sessions - client will group by hour using local timezone
    const sessions = results.map((row) => {
      // PostHog may return timestamp as Date object or ISO string
      let sessionStart: string;
      const timestampValue: string | number | Date = row[0] as
        | string
        | number
        | Date;
      if (
        timestampValue &&
        typeof timestampValue === "object" &&
        "toISOString" in timestampValue
      ) {
        sessionStart = (timestampValue as Date).toISOString();
      } else if (typeof timestampValue === "string") {
        // If it's already a string, use it directly
        sessionStart = timestampValue;
      } else {
        // Try to parse as date
        sessionStart = new Date(String(timestampValue)).toISOString();
      }

      const userId = String(row[1] || "");
      let timezone = String(row[2] || "").trim();

      // If timezone is empty, use UTC
      if (!timezone || timezone === "") {
        timezone = "UTC";
      }

      return { sessionStart, userId, timezone };
    });

    // Debug: log sample data
    if (sessions.length > 0) {
      console.log("Total sessions:", sessions.length);
      console.log("Sample sessions from API (first 5):", sessions.slice(0, 5));

      // Check unique users
      const uniqueUsers = new Set(sessions.map((s) => s.userId));
      console.log("Unique users:", uniqueUsers.size);
      console.log("Sample user IDs:", Array.from(uniqueUsers).slice(0, 10));

      // Check timezone distribution
      const timezoneCounts = new Map<string, number>();
      sessions.forEach((s) => {
        timezoneCounts.set(
          s.timezone,
          (timezoneCounts.get(s.timezone) || 0) + 1
        );
      });
      console.log(
        "Timezone distribution:",
        Array.from(timezoneCounts.entries()).slice(0, 10)
      );

      // Check if all are UTC
      const utcCount = timezoneCounts.get("UTC") || 0;
      console.log(
        `Sessions with UTC timezone: ${utcCount} out of ${
          sessions.length
        } (${Math.round((utcCount / sessions.length) * 100)}%)`
      );
    }

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Hourly visitors API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch hourly visitors data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

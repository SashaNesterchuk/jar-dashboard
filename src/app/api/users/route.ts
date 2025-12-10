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

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";
    const debugUserId = searchParams.get("debugUserId");

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

    // Build base filters
    const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;

    // Country Summary Query
    const countrySummaryQuery = `
      SELECT 
        JSONExtractString(properties,'country') as country,
        uniqExact(JSONExtractString(properties,'user_id')) as user_count
      FROM events
      WHERE ${baseFilters}
        AND JSONExtractString(properties,'user_id') IS NOT NULL
        AND JSONExtractString(properties,'user_id') != ''
        AND JSONExtractString(properties,'country') IS NOT NULL
        AND JSONExtractString(properties,'country') != ''
      GROUP BY country
      ORDER BY user_count DESC
    `;

    // Users Detail Query - batch rapid session_ids into real sessions
    // Session_ids that occur within 5 minutes of each other are considered the same session
    const usersDetailQuery = `
      SELECT 
        user_id,
        any(country) as country,
        count() as session_count,
        max(last_activity) as last_session,
        sum(checkin_count) as checkin_count,
        sum(breathing_count) as breathing_count,
        sum(meditation_count) as meditation_count,
        sum(journal_count) as journal_count,
        sum(self_discovery_count) as self_discovery_count
      FROM (
        SELECT 
          user_id,
          session_batch,
          any(country) as country,
          max(last_activity) as last_activity,
          sum(checkin_count) as checkin_count,
          sum(breathing_count) as breathing_count,
          sum(meditation_count) as meditation_count,
          sum(journal_count) as journal_count,
          sum(self_discovery_count) as self_discovery_count
        FROM (
          SELECT 
            JSONExtractString(properties,'user_id') as user_id,
            JSONExtractString(properties,'session_id') as session_id,
            any(JSONExtractString(properties,'country')) as country,
            max(timestamp) as last_activity,
            toUnixTimestamp(min(timestamp)) as first_event_ts,
            intDiv(toUnixTimestamp(min(timestamp)), 300) as session_batch,
            countIf(event = 'mood_check_in_completed') as checkin_count,
            countIf(
              event = 'practice_completed' 
              AND JSONExtractString(properties,'practice_type') = 'breathing'
              AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80
            ) as breathing_count,
            countIf(
              event = 'practice_completed' 
              AND JSONExtractString(properties,'practice_type') = 'meditation'
              AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80
            ) as meditation_count,
            countIf(
              event = 'practice_completed' 
              AND JSONExtractString(properties,'practice_type') = 'journaling'
              AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80
            ) as journal_count,
            countIf(
              event = 'practice_completed' 
              AND JSONExtractString(properties,'practice_type') = 'question'
              AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80
            ) as self_discovery_count
          FROM events
          WHERE ${baseFilters}
            AND JSONExtractString(properties,'user_id') IS NOT NULL
            AND JSONExtractString(properties,'user_id') != ''
            AND JSONExtractString(properties,'session_id') IS NOT NULL
            AND JSONExtractString(properties,'session_id') != ''
          GROUP BY user_id, session_id
        )
        GROUP BY user_id, session_batch
      )
      GROUP BY user_id
      ORDER BY session_count DESC
    `;

    // Session Duration Query - calculate total duration per user
    const sessionDurationQuery = `
      SELECT 
        user_id,
        sum(duration_seconds) as total_duration
      FROM (
        SELECT 
          JSONExtractString(properties,'user_id') as user_id,
          JSONExtractString(properties,'session_id') as session_id,
          min(timestamp) as session_start,
          max(timestamp) as session_end,
          dateDiff('second', min(timestamp), max(timestamp)) as duration_seconds
        FROM events
        WHERE ${baseFilters}
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
          AND JSONExtractString(properties,'session_id') IS NOT NULL
          AND JSONExtractString(properties,'session_id') != ''
        GROUP BY user_id, session_id
      )
      GROUP BY user_id
    `;

    // Debug query for specific user if requested
    let debugInfo = null;
    if (debugUserId) {
      // Debug query with session batching (same logic as main query)
      const debugQuery = `
        SELECT 
          session_batch,
          min(session_start) as batch_start,
          max(session_end) as batch_end,
          sum(event_count) as total_events,
          count() as session_ids_in_batch,
          groupArray(session_id) as session_ids
        FROM (
          SELECT 
            JSONExtractString(properties,'session_id') as session_id,
            min(timestamp) as session_start,
            max(timestamp) as session_end,
            count() as event_count,
            intDiv(toUnixTimestamp(min(timestamp)), 300) as session_batch
          FROM events
          WHERE ${baseFilters}
            AND JSONExtractString(properties,'user_id') = '${debugUserId}'
            AND JSONExtractString(properties,'session_id') IS NOT NULL
            AND JSONExtractString(properties,'session_id') != ''
          GROUP BY session_id
        )
        GROUP BY session_batch
        ORDER BY batch_start DESC
        LIMIT 20
      `;

      console.log("Debug Query for user:", debugUserId);

      const debugResults = await queryPostHogArray(debugQuery);
      console.log("Debug results count (real sessions):", debugResults.length);

      debugInfo = {
        userId: debugUserId,
        timeRange,
        totalSessions: debugResults.length,
        batchingInfo: "Sessions are batched in 5-minute windows",
        recentSessions: debugResults.slice(0, 10).map((row) => ({
          sessionBatch:
            typeof row[0] === "number" ? row[0] : Number(row[0]) || 0,
          batchStart: String(row[1] || ""),
          batchEnd: String(row[2] || ""),
          totalEvents:
            typeof row[3] === "number" ? row[3] : Number(row[3]) || 0,
          sessionIdsCount:
            typeof row[4] === "number" ? row[4] : Number(row[4]) || 0,
        })),
      };
    }

    console.log("Executing main queries with timeRange:", timeRange);

    // Execute queries in parallel
    const [countrySummaryResults, usersDetailResults, sessionDurationResults] =
      await Promise.all([
        queryPostHogArray(countrySummaryQuery),
        queryPostHogArray(usersDetailQuery),
        queryPostHogArray(sessionDurationQuery),
      ]);

    // Transform country summary results
    const countrySummary = countrySummaryResults.map((row) => ({
      country: String(row[0] || ""),
      userCount: typeof row[1] === "number" ? row[1] : Number(row[1]) || 0,
    }));

    // Build session duration map
    const sessionDurationMap = new Map<string, number>();
    sessionDurationResults.forEach((row) => {
      const userId = String(row[0] || "");
      const duration =
        typeof row[1] === "number" ? row[1] : Number(row[1]) || 0;
      if (userId) {
        sessionDurationMap.set(userId, duration);
      }
    });

    // Transform users detail results
    const users = usersDetailResults.map((row) => {
      const userId = String(row[0] || "");
      const country = String(row[1] || "");
      const sessionCount =
        typeof row[2] === "number" ? row[2] : Number(row[2]) || 0;
      const lastSession = row[3] ? String(row[3]) : null;
      const checkinCount =
        typeof row[4] === "number" ? row[4] : Number(row[4]) || 0;
      const breathingCount =
        typeof row[5] === "number" ? row[5] : Number(row[5]) || 0;
      const meditationCount =
        typeof row[6] === "number" ? row[6] : Number(row[6]) || 0;
      const journalCount =
        typeof row[7] === "number" ? row[7] : Number(row[7]) || 0;
      const selfDiscoveryCount =
        typeof row[8] === "number" ? row[8] : Number(row[8]) || 0;

      return {
        userId,
        country,
        sessionCount,
        lastSession,
        sessionDuration: sessionDurationMap.get(userId) || 0,
        checkinCount,
        breathingCount,
        meditationCount,
        journalCount,
        selfDiscoveryCount,
      };
    });

    return NextResponse.json({
      countrySummary,
      users,
      debug: debugInfo,
    });
  } catch (error) {
    console.error("Users API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch users data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

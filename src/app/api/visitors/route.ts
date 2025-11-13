import { NextRequest, NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://eu.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "50390";
const POSTHOG_API_KEY = "phx_13ZYZ8irTB5GrP90S58G2OCuj85gr4UtrnyPpv7ojTI4b7RX";

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
): Promise<Array<[string, number]>> {
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

  // Convert results to array of [date, value] tuples
  return results.map((row) => {
    const date = String(row[0] || "");
    const value = typeof row[1] === "number" ? row[1] : Number(row[1]) || 0;
    return [date, value] as [string, number];
  });
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
  const end = new Date(startOfToday.getTime() + MS_IN_DAY); // exclusive

  const daysToInclude = timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 7;

  const start = new Date(end.getTime() - daysToInclude * MS_IN_DAY);

  return { start, end };
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function fillMissingDays(
  data: Array<{ date: string; allUsers: number; newUsers: number }>,
  startDate: Date,
  endDate: Date
): Array<{ date: string; allUsers: number; newUsers: number }> {
  const dataMap = new Map<string, { allUsers: number; newUsers: number }>();
  data.forEach((item) => {
    dataMap.set(item.date, {
      allUsers: item.allUsers,
      newUsers: item.newUsers,
    });
  });

  const result: Array<{ date: string; allUsers: number; newUsers: number }> =
    [];
  const current = new Date(startDate);

  while (current < endDate) {
    const dateStr = formatDateInTimeZone(current, TARGET_TIMEZONE);
    const existing = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      allUsers: existing?.allUsers || 0,
      newUsers: existing?.newUsers || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
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

    // Build DAU query (all users per day)
    const dauQuery = `
      SELECT 
        formatDateTime(timestamp, '%Y-%m-%d') as date,
        uniqExact(JSONExtractString(properties,'user_id')) AS value 
      FROM events 
      WHERE timestamp >= toDateTime('${timeWindow.start.toISOString()}','Europe/Warsaw') 
        AND timestamp < toDateTime('${timeWindow.end.toISOString()}','Europe/Warsaw')
        AND JSONExtractString(properties,'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
        AND JSONExtractString(properties,'user_id') IS NOT NULL
        AND JSONExtractString(properties,'user_id') != ''
      GROUP BY date
      ORDER BY date
    `;

    // Build New Users query (new users per day)
    const newUsersQuery = `
      SELECT 
        formatDateTime(first_ts, '%Y-%m-%d') as date,
        count() AS value
      FROM (
        SELECT 
          JSONExtractString(properties,'user_id') AS uid,
          min(timestamp) AS first_ts
        FROM events
        WHERE timestamp < toDateTime('${timeWindow.end.toISOString()}','Europe/Warsaw')
          AND JSONExtractString(properties,'consent_status') = 'granted'
          AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
          AND JSONExtractString(properties,'user_id') IS NOT NULL
          AND JSONExtractString(properties,'user_id') != ''
        GROUP BY uid
        HAVING first_ts >= toDateTime('${timeWindow.start.toISOString()}','Europe/Warsaw')
           AND first_ts < toDateTime('${timeWindow.end.toISOString()}','Europe/Warsaw')
      )
      GROUP BY date
      ORDER BY date
    `;

    // Execute queries in parallel
    const [dauResults, newUsersResults] = await Promise.all([
      queryPostHogArray(dauQuery),
      queryPostHogArray(newUsersQuery),
    ]);

    // Combine results by date
    const combinedMap = new Map<
      string,
      { allUsers: number; newUsers: number }
    >();

    dauResults.forEach(([date, value]) => {
      // PostHog returns dates as strings in format "YYYY-MM-DD" or as Date objects
      let dateStr = String(date);
      // If it's a Date object or timestamp, convert to YYYY-MM-DD
      if (dateStr.includes("T") || dateStr.includes(" ")) {
        dateStr = new Date(dateStr).toISOString().split("T")[0];
      } else if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try to parse as date if format is different
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          dateStr = parsed.toISOString().split("T")[0];
        }
      }
      const existing = combinedMap.get(dateStr) || { allUsers: 0, newUsers: 0 };
      combinedMap.set(dateStr, { ...existing, allUsers: Math.round(value) });
    });

    newUsersResults.forEach(([date, value]) => {
      // PostHog returns dates as strings in format "YYYY-MM-DD" or as Date objects
      let dateStr = String(date);
      // If it's a Date object or timestamp, convert to YYYY-MM-DD
      if (dateStr.includes("T") || dateStr.includes(" ")) {
        dateStr = new Date(dateStr).toISOString().split("T")[0];
      } else if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try to parse as date if format is different
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          dateStr = parsed.toISOString().split("T")[0];
        }
      }
      const existing = combinedMap.get(dateStr) || { allUsers: 0, newUsers: 0 };
      combinedMap.set(dateStr, { ...existing, newUsers: Math.round(value) });
    });

    // Convert to array and sort by date
    const combinedData = Array.from(combinedMap.entries())
      .map(([date, values]) => ({
        date,
        allUsers: values.allUsers,
        newUsers: values.newUsers,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Fill missing days with zeros
    const filledData = fillMissingDays(
      combinedData,
      timeWindow.start,
      timeWindow.end
    );

    return NextResponse.json(filledData);
  } catch (error) {
    console.error("Visitors API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch visitors data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

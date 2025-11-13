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
): Promise<Array<Array<number | string>>> {
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

async function queryPostHog(query: string): Promise<number> {
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
    return 0;
  }

  // Extract value from results array
  const value = results[0]?.[0];
  return typeof value === "number" ? value : Number(value) || 0;
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
  const end = new Date(startOfToday.getTime() + MS_IN_DAY); // exclusive, start of tomorrow

  const daysToInclude = timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 7;

  const start = new Date(end.getTime() - daysToInclude * MS_IN_DAY);

  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";
    const type = searchParams.get("type");

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

    // Handle practice types query
    if (type === "types") {
      // Query for practice types completion counts
      const breathingQuery = `SELECT count() AS value FROM events WHERE event = 'practice_completed' AND JSONExtractString(properties,'practice_type') = 'breathing' AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80 AND ${baseFilters}`;
      const journalingQuery = `SELECT count() AS value FROM events WHERE event = 'practice_completed' AND JSONExtractString(properties,'practice_type') = 'journaling' AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80 AND ${baseFilters}`;
      const questionQuery = `SELECT count() AS value FROM events WHERE event = 'practice_completed' AND JSONExtractString(properties,'practice_type') = 'question' AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80 AND ${baseFilters}`;
      const meditationQuery = `SELECT count() AS value FROM events WHERE event = 'practice_completed' AND JSONExtractString(properties,'practice_type') = 'meditation' AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80 AND ${baseFilters}`;
      const moodQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_completed' AND ${baseFilters}`;

      // Execute all queries in parallel
      const [breathing, journaling, question, meditation, mood] =
        await Promise.all([
          queryPostHog(breathingQuery),
          queryPostHog(journalingQuery),
          queryPostHog(questionQuery),
          queryPostHog(meditationQuery),
          queryPostHog(moodQuery),
        ]);

      return NextResponse.json({
        breathing,
        meditation,
        journaling,
        question,
        mood,
      });
    }

    if (type === "trial-conversions") {
      const trialConversionsQuery = `
        SELECT
          coalesce(
            JSONExtractString(properties,'source_practice_id'),
            JSONExtractString(properties,'practice_event_id'),
            JSONExtractString(properties,'event_id')
          ) AS event_id,
          any(JSONExtractString(properties,'source_practice_name')) AS practice_name,
          any(JSONExtractString(properties,'practice_type')) AS practice_type,
          coalesce(JSONExtractString(properties,'selected_period'), '') AS selected_period,
          count() AS trials_started
        FROM events
        WHERE event IN ('price_screen_action', 'onboarding_paywall_action')
          AND JSONExtractString(properties,'action') = 'trial_started'
          AND ${baseFilters}
          AND coalesce(
            JSONExtractString(properties,'source_practice_id'),
            JSONExtractString(properties,'practice_event_id'),
            JSONExtractString(properties,'event_id')
          ) IS NOT NULL
          AND coalesce(
            JSONExtractString(properties,'source_practice_id'),
            JSONExtractString(properties,'practice_event_id'),
            JSONExtractString(properties,'event_id')
          ) != ''
        GROUP BY event_id, selected_period
        ORDER BY trials_started DESC
      `;

      const trialResults = await queryPostHogArray(trialConversionsQuery);

      const trialData = trialResults.map((row) => {
        const eventId = String(row[0] || "");
        const practiceName = String(row[1] || "") || eventId;
        const practiceType = String(row[2] || "") || "practice";
        const periodRaw = String(row[3] || "");
        const countValue =
          typeof row[4] === "number" ? row[4] : Number(row[4]) || 0;

        const period =
          periodRaw === ""
            ? "unknown"
            : periodRaw.toLowerCase() === "yearly"
            ? "annual"
            : periodRaw.toLowerCase();

        return {
          eventId,
          title: practiceName,
          type: practiceType,
          period,
          count: countValue,
        };
      });

      return NextResponse.json(trialData.sort((a, b) => b.count - a.count));
    }

    // Query for completed practices grouped by event_id
    const completedQuery = `
      SELECT 
        JSONExtractString(properties,'event_id') as event_id,
        any(JSONExtractString(properties,'practice_name')) as practice_name,
        any(JSONExtractString(properties,'practice_type')) as practice_type,
        count() as completions
      FROM events 
      WHERE event = 'practice_completed' 
        AND toInt(JSONExtractString(properties,'completion_percentage')) >= 80 
        AND JSONExtractString(properties,'event_id') IS NOT NULL 
        AND JSONExtractString(properties,'event_id') != '' 
        AND ${baseFilters}
      GROUP BY event_id 
      ORDER BY completions DESC
    `;

    // Query for started practices grouped by event_id
    const startedQuery = `
      SELECT 
        JSONExtractString(properties,'event_id') as event_id,
        count() as started
      FROM events 
      WHERE event = 'practice_started'
        AND JSONExtractString(properties,'event_id') IS NOT NULL 
        AND JSONExtractString(properties,'event_id') != '' 
        AND ${baseFilters}
      GROUP BY event_id
    `;

    // Execute both queries in parallel
    const [completedResults, startedResultsRaw] = await Promise.all([
      queryPostHogArray(completedQuery),
      queryPostHogArray(startedQuery),
    ]);

    const completedMap = completedResults.reduce<
      Map<
        string,
        {
          practice_name: string;
          practice_type: string;
          completions: number;
        }
      >
    >((acc, row) => {
      const eventId = String(row[0] || "");
      if (!eventId) {
        return acc;
      }
      const practiceName = String(row[1] || "") || eventId;
      const practiceType = String(row[2] || "") || "practice";
      const completions =
        typeof row[3] === "number" ? row[3] : Number(row[3]) || 0;
      acc.set(eventId, {
        practice_name: practiceName,
        practice_type: practiceType,
        completions,
      });
      return acc;
    }, new Map());

    const startedMap = startedResultsRaw.reduce<Map<string, number>>(
      (acc, row) => {
        const eventId = String(row[0] || "");
        if (!eventId) {
          return acc;
        }
        const started =
          typeof row[1] === "number" ? row[1] : Number(row[1]) || 0;
        acc.set(eventId, started);
        return acc;
      },
      new Map()
    );

    // Get all unique event_ids (from both started and completed)
    const allEventIds = new Set([...completedMap.keys(), ...startedMap.keys()]);

    // Merge results and sort by completions DESC
    const practices = Array.from(allEventIds)
      .map((eventId) => {
        const completedEntry = completedMap.get(eventId);
        return {
          event_id: eventId,
          practice_name: completedEntry?.practice_name || eventId,
          practice_type: completedEntry?.practice_type || "practice",
          completions: completedEntry?.completions || 0,
          started: startedMap.get(eventId) || 0,
        };
      })
      .sort((a, b) => b.completions - a.completions); // Sort by completions DESC

    return NextResponse.json(practices);
  } catch (error) {
    console.error("Practices API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch practices data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

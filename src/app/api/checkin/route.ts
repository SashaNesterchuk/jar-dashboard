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

async function queryPostHog(query: string): Promise<number> {
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
    return 0;
  }

  const value = results[0]?.[0];
  return typeof value === "number" ? value : Number(value) || 0;
}

function getTimeWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let end: Date;
  let start: Date;

  switch (timeRange) {
    case "7d": {
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      break;
    }
    case "30d": {
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      break;
    }
    case "90d": {
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      break;
    }
    default: {
      end = new Date(now);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
    }
  }

  const year = start.getFullYear();
  const month = start.getMonth();
  const date = start.getDate();
  const startAdjusted = new Date(Date.UTC(year, month, date, 0, 0, 0));
  startAdjusted.setHours(startAdjusted.getHours() - 1);

  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  const endDate = end.getDate();
  const endAdjusted = new Date(Date.UTC(endYear, endMonth, endDate, 0, 0, 0));
  endAdjusted.setDate(endAdjusted.getDate() + 1);
  endAdjusted.setHours(endAdjusted.getHours() - 1);

  return { start: startAdjusted, end: endAdjusted };
}

function getComparisonWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  let end: Date;
  let start: Date;

  switch (timeRange) {
    case "7d": {
      end = new Date(now);
      end.setDate(end.getDate() - 7);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      break;
    }
    case "30d": {
      end = new Date(now);
      end.setDate(end.getDate() - 30);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      break;
    }
    case "90d": {
      end = new Date(now);
      end.setDate(end.getDate() - 90);
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      break;
    }
    default: {
      end = new Date(now);
      end.setDate(end.getDate() - 7);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
    }
  }

  const year = start.getFullYear();
  const month = start.getMonth();
  const date = start.getDate();
  const startAdjusted = new Date(Date.UTC(year, month, date, 0, 0, 0));
  startAdjusted.setHours(startAdjusted.getHours() - 1);

  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  const endDate = end.getDate();
  const endAdjusted = new Date(Date.UTC(endYear, endMonth, endDate, 0, 0, 0));
  endAdjusted.setDate(endAdjusted.getDate() + 1);
  endAdjusted.setHours(endAdjusted.getHours() - 1);

  return { start: startAdjusted, end: endAdjusted };
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";

    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    const currentWindow = getTimeWindow(timeRange);
    const comparisonWindow = getComparisonWindow(timeRange);

    const startIso = currentWindow.start.toISOString();
    const endIso = currentWindow.end.toISOString();
    const compStartIso = comparisonWindow.start.toISOString();
    const compEndIso = comparisonWindow.end.toISOString();

    const baseFilters = `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;
    const compBaseFilters = `timestamp >= toDateTime('${compStartIso}','Europe/Warsaw') AND timestamp < toDateTime('${compEndIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'`;

    // Build queries for current period
    const usersStartedQuery = `SELECT uniqExact(JSONExtractString(properties,'user_id')) AS value FROM events WHERE event = 'mood_check_in_started' AND ${baseFilters} AND JSONExtractString(properties,'user_id') IS NOT NULL AND JSONExtractString(properties,'user_id') != ''`;
    const startedTotalQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_started' AND ${baseFilters}`;
    const completedQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_completed' AND ${baseFilters}`;
    const abandonedQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_abandoned' AND ${baseFilters}`;
    const checkinStartedTimesQuery = `SELECT JSONExtractString(properties,'check_in_id') AS cid, min(timestamp) AS ts FROM events WHERE event = 'mood_check_in_started' AND ${baseFilters} AND JSONExtractString(properties,'check_in_id') IS NOT NULL GROUP BY cid`;
    const checkinCompletedTimesQuery = `SELECT JSONExtractString(properties,'check_in_id') AS cid, min(timestamp) AS ts FROM events WHERE event = 'mood_check_in_completed' AND ${baseFilters} AND JSONExtractString(properties,'check_in_id') IS NOT NULL GROUP BY cid`;

    // Build page view queries for current period
    const viewedMoodSelectionQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') = 'mood_selection' AND ${baseFilters}`;
    const viewedEmotionsQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') = 'emotions' AND ${baseFilters}`;
    const viewedTagsQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') = 'tags' AND ${baseFilters}`;
    const viewedChatQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') IN ('chat','reflection') AND ${baseFilters}`;
    const viewedSummaryQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND (JSONExtractString(properties,'page_name') = 'summary' OR JSONExtractString(properties,'page_name') = 'ai_summary') AND ${baseFilters}`;
    const viewedPaywallQuery = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'viewed' AND ${baseFilters}`;

    // Build trial queries for current period
    const trialsStartedQuery = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${baseFilters}`;
    const trialsByPeriodQuery = `SELECT JSONExtractString(properties,'selected_period') as period, count() as count FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${baseFilters} AND JSONExtractString(properties,'selected_period') IS NOT NULL AND JSONExtractString(properties,'selected_period') != '' GROUP BY period`;

    // Build queries for comparison period
    const compUsersStartedQuery = `SELECT uniqExact(JSONExtractString(properties,'user_id')) AS value FROM events WHERE event = 'mood_check_in_started' AND ${compBaseFilters} AND JSONExtractString(properties,'user_id') IS NOT NULL AND JSONExtractString(properties,'user_id') != ''`;
    const compStartedTotalQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_started' AND ${compBaseFilters}`;
    const compCompletedQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_completed' AND ${compBaseFilters}`;
    const compAbandonedQuery = `SELECT count() AS value FROM events WHERE event = 'mood_check_in_abandoned' AND ${compBaseFilters}`;
    const compCheckinStartedTimesQuery = `SELECT JSONExtractString(properties,'check_in_id') AS cid, min(timestamp) AS ts FROM events WHERE event = 'mood_check_in_started' AND ${compBaseFilters} AND JSONExtractString(properties,'check_in_id') IS NOT NULL GROUP BY cid`;
    const compCheckinCompletedTimesQuery = `SELECT JSONExtractString(properties,'check_in_id') AS cid, min(timestamp) AS ts FROM events WHERE event = 'mood_check_in_completed' AND ${compBaseFilters} AND JSONExtractString(properties,'check_in_id') IS NOT NULL GROUP BY cid`;

    // Build page view queries for comparison period
    const compViewedMoodSelectionQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') = 'mood_selection' AND ${compBaseFilters}`;
    const compViewedEmotionsQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') = 'emotions' AND ${compBaseFilters}`;
    const compViewedTagsQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') = 'tags' AND ${compBaseFilters}`;
    const compViewedChatQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND JSONExtractString(properties,'page_name') IN ('chat','reflection') AND ${compBaseFilters}`;
    const compViewedSummaryQuery = `SELECT count() AS value FROM events WHERE event = 'mood_page_viewed' AND (JSONExtractString(properties,'page_name') = 'summary' OR JSONExtractString(properties,'page_name') = 'ai_summary') AND ${compBaseFilters}`;
    const compViewedPaywallQuery = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'viewed' AND ${compBaseFilters}`;

    // Build trial queries for comparison period
    const compTrialsStartedQuery = `SELECT count() AS value FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${compBaseFilters}`;
    const compTrialsByPeriodQuery = `SELECT JSONExtractString(properties,'selected_period') as period, count() as count FROM events WHERE event = 'price_screen_action' AND JSONExtractString(properties,'action') = 'trial_started' AND ${compBaseFilters} AND JSONExtractString(properties,'selected_period') IS NOT NULL AND JSONExtractString(properties,'selected_period') != '' GROUP BY period`;

    // Execute queries in parallel
    const [
      usersStarted,
      compUsersStarted,
      startedTotal,
      compStartedTotal,
      completed,
      compCompleted,
      abandoned,
      compAbandoned,
      checkinStartedTimes,
      checkinCompletedTimes,
      compCheckinStartedTimes,
      compCheckinCompletedTimes,
      viewedMoodSelection,
      compViewedMoodSelection,
      viewedEmotions,
      compViewedEmotions,
      viewedTags,
      compViewedTags,
      viewedChat,
      compViewedChat,
      viewedSummary,
      compViewedSummary,
      viewedPaywall,
      compViewedPaywall,
      trialsStarted,
      compTrialsStarted,
      trialsByPeriod,
      compTrialsByPeriod,
    ] = await Promise.all([
      queryPostHog(usersStartedQuery),
      queryPostHog(compUsersStartedQuery),
      queryPostHog(startedTotalQuery),
      queryPostHog(compStartedTotalQuery),
      queryPostHog(completedQuery),
      queryPostHog(compCompletedQuery),
      queryPostHog(abandonedQuery),
      queryPostHog(compAbandonedQuery),
      queryPostHogArray(checkinStartedTimesQuery),
      queryPostHogArray(checkinCompletedTimesQuery),
      queryPostHogArray(compCheckinStartedTimesQuery),
      queryPostHogArray(compCheckinCompletedTimesQuery),
      queryPostHog(viewedMoodSelectionQuery),
      queryPostHog(compViewedMoodSelectionQuery),
      queryPostHog(viewedEmotionsQuery),
      queryPostHog(compViewedEmotionsQuery),
      queryPostHog(viewedTagsQuery),
      queryPostHog(compViewedTagsQuery),
      queryPostHog(viewedChatQuery),
      queryPostHog(compViewedChatQuery),
      queryPostHog(viewedSummaryQuery),
      queryPostHog(compViewedSummaryQuery),
      queryPostHog(viewedPaywallQuery),
      queryPostHog(compViewedPaywallQuery),
      queryPostHog(trialsStartedQuery),
      queryPostHog(compTrialsStartedQuery),
      queryPostHogArray(trialsByPeriodQuery),
      queryPostHogArray(compTrialsByPeriodQuery),
    ]);

    // Calculate average duration for current period
    let avgDurationSec = 0;
    if (checkinStartedTimes.length > 0 && checkinCompletedTimes.length > 0) {
      const startedMap = new Map<string, Date>();
      checkinStartedTimes.forEach((row) => {
        // Handle both array format [cid, ts] and object format {cid, ts}
        const cid =
          (Array.isArray(row) ? row[0] : (row as any)?.cid)?.toString() || "";
        const ts =
          (Array.isArray(row) ? row[1] : (row as any)?.ts)?.toString() || "";
        if (cid && ts && cid !== "cid" && ts !== "ts") {
          try {
            startedMap.set(cid, new Date(ts));
          } catch (e) {
            // Skip invalid dates
          }
        }
      });

      const durations: number[] = [];
      checkinCompletedTimes.forEach((row) => {
        const cid =
          (Array.isArray(row) ? row[0] : (row as any)?.cid)?.toString() || "";
        const ts =
          (Array.isArray(row) ? row[1] : (row as any)?.ts)?.toString() || "";
        if (cid && ts && cid !== "cid" && ts !== "ts" && startedMap.has(cid)) {
          try {
            const startTime = startedMap.get(cid)!;
            const endTime = new Date(ts);
            const durationSec =
              (endTime.getTime() - startTime.getTime()) / 1000;
            if (durationSec > 0 && isFinite(durationSec)) {
              durations.push(durationSec);
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });

      if (durations.length > 0) {
        avgDurationSec =
          durations.reduce((sum, d) => sum + d, 0) / durations.length;
      }
    }

    // Calculate average duration for comparison period
    let compAvgDurationSec = 0;
    if (
      compCheckinStartedTimes.length > 0 &&
      compCheckinCompletedTimes.length > 0
    ) {
      const startedMap = new Map<string, Date>();
      compCheckinStartedTimes.forEach((row) => {
        const cid =
          (Array.isArray(row) ? row[0] : (row as any)?.cid)?.toString() || "";
        const ts =
          (Array.isArray(row) ? row[1] : (row as any)?.ts)?.toString() || "";
        if (cid && ts && cid !== "cid" && ts !== "ts") {
          try {
            startedMap.set(cid, new Date(ts));
          } catch (e) {
            // Skip invalid dates
          }
        }
      });

      const durations: number[] = [];
      compCheckinCompletedTimes.forEach((row) => {
        const cid =
          (Array.isArray(row) ? row[0] : (row as any)?.cid)?.toString() || "";
        const ts =
          (Array.isArray(row) ? row[1] : (row as any)?.ts)?.toString() || "";
        if (cid && ts && cid !== "cid" && ts !== "ts" && startedMap.has(cid)) {
          try {
            const startTime = startedMap.get(cid)!;
            const endTime = new Date(ts);
            const durationSec =
              (endTime.getTime() - startTime.getTime()) / 1000;
            if (durationSec > 0 && isFinite(durationSec)) {
              durations.push(durationSec);
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });

      if (durations.length > 0) {
        compAvgDurationSec =
          durations.reduce((sum, d) => sum + d, 0) / durations.length;
      }
    }

    // Calculate deltas
    function calculateDelta(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    }

    const usersStartedDelta = calculateDelta(usersStarted, compUsersStarted);
    const startedTotalDelta = calculateDelta(startedTotal, compStartedTotal);
    const completedDelta = calculateDelta(completed, compCompleted);
    const abandonedDelta = calculateDelta(abandoned, compAbandoned);
    const durationDelta = calculateDelta(avgDurationSec, compAvgDurationSec);

    // Parse trialsByPeriod array results
    function extractPeriodCount(
      results: Array<Array<number | string>>,
      period: string
    ): number {
      if (!results || results.length === 0) return 0;
      for (const row of results) {
        // Handle both array format [period, count] and object format {period, count}
        const rowPeriod =
          (Array.isArray(row) ? row[0] : (row as any)?.period)?.toString() ||
          "";
        const count =
          (Array.isArray(row) ? row[1] : (row as any)?.count) || 0;
        if (
          rowPeriod.toLowerCase() === period.toLowerCase() ||
          (period === "annual" && rowPeriod.toLowerCase() === "yearly")
        ) {
          return typeof count === "number" ? count : Number(count) || 0;
        }
      }
      return 0;
    }

    const monthly = extractPeriodCount(trialsByPeriod, "monthly");
    const annual = extractPeriodCount(trialsByPeriod, "annual");
    const total = monthly + annual;

    const compMonthly = extractPeriodCount(compTrialsByPeriod, "monthly");
    const compAnnual = extractPeriodCount(compTrialsByPeriod, "annual");
    const compTotal = compMonthly + compAnnual;

    // Calculate trial deltas
    const paywallViewsDelta = calculateDelta(viewedPaywall, compViewedPaywall);
    const trialsStartedDelta = calculateDelta(trialsStarted, compTrialsStarted);
    const monthlyDelta = calculateDelta(monthly, compMonthly);
    const annualDelta = calculateDelta(annual, compAnnual);
    const totalDelta = calculateDelta(total, compTotal);

    // Build pages data structure
    // Based on workflow JSON logic: moodCount = startedTotal, emotionsCount = viewedEmotions
    const pagesData: Record<string, number> = {
      mood: Math.round(startedTotal), // Base value: mood_check_in_started count
      emotions: Math.round(viewedEmotions), // mood_page_viewed with page_name = 'emotions'
      context: Math.round(viewedTags), // mood_page_viewed with page_name = 'tags'
      reflection: Math.round(viewedChat), // mood_page_viewed with page_name IN ('chat','reflection')
      summary: Math.round(viewedSummary), // mood_page_viewed with page_name IN ('summary','ai_summary')
      paywall: Math.round(viewedPaywall), // price_screen_action with action = 'viewed'
    };

    return NextResponse.json({
      usersStarted: {
        value: Math.round(usersStarted),
        previous: Math.round(compUsersStarted),
        delta: usersStartedDelta,
        change: `${
          usersStartedDelta >= 0 ? "+" : ""
        }${usersStartedDelta.toFixed(1)}%`,
      },
      startedTotal: {
        value: Math.round(startedTotal),
        previous: Math.round(compStartedTotal),
        delta: startedTotalDelta,
        change: `${
          startedTotalDelta >= 0 ? "+" : ""
        }${startedTotalDelta.toFixed(1)}%`,
      },
      completed: {
        value: Math.round(completed),
        previous: Math.round(compCompleted),
        delta: completedDelta,
        change: `${completedDelta >= 0 ? "+" : ""}${completedDelta.toFixed(
          1
        )}%`,
      },
      abandoned: {
        value: Math.round(abandoned),
        previous: Math.round(compAbandoned),
        delta: abandonedDelta,
        change: `${abandonedDelta >= 0 ? "+" : ""}${abandonedDelta.toFixed(
          1
        )}%`,
      },
      avgDuration: {
        value: avgDurationSec,
        previous: compAvgDurationSec,
        delta: durationDelta,
        change: `${durationDelta >= 0 ? "+" : ""}${durationDelta.toFixed(1)}%`,
      },
      pages: pagesData,
      trial: {
        paywallViews: {
          value: Math.round(viewedPaywall),
          previous: Math.round(compViewedPaywall),
          delta: paywallViewsDelta,
          change: `${
            paywallViewsDelta >= 0 ? "+" : ""
          }${paywallViewsDelta.toFixed(1)}%`,
        },
        trialsStarted: {
          value: Math.round(trialsStarted),
          previous: Math.round(compTrialsStarted),
          delta: trialsStartedDelta,
          change: `${
            trialsStartedDelta >= 0 ? "+" : ""
          }${trialsStartedDelta.toFixed(1)}%`,
        },
        monthly: {
          value: Math.round(monthly),
          previous: Math.round(compMonthly),
          delta: monthlyDelta,
          change: `${monthlyDelta >= 0 ? "+" : ""}${monthlyDelta.toFixed(1)}%`,
        },
        annual: {
          value: Math.round(annual),
          previous: Math.round(compAnnual),
          delta: annualDelta,
          change: `${annualDelta >= 0 ? "+" : ""}${annualDelta.toFixed(1)}%`,
        },
        total: {
          value: Math.round(total),
          previous: Math.round(compTotal),
          delta: totalDelta,
          change: `${totalDelta >= 0 ? "+" : ""}${totalDelta.toFixed(1)}%`,
        },
      },
    });
  } catch (error) {
    console.error("Checkin API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch checkin data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

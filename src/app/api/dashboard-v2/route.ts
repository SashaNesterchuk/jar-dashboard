import { NextRequest, NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;

interface PostHogQueryResponse {
  results?: Array<Array<number | string>>;
  responseData?: {
    results?: Array<Array<number | string>>;
  };
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
  return data.results || data.responseData?.results || [];
}

function getTimeWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(end);

  switch (timeRange) {
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "90d":
      start.setDate(start.getDate() - 89);
      break;
    default:
      start.setDate(start.getDate() - 6);
      break;
  }

  const startAdjusted = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)
  );
  startAdjusted.setHours(startAdjusted.getHours() - 1);

  const endAdjusted = new Date(
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0)
  );
  endAdjusted.setDate(endAdjusted.getDate() + 1);
  endAdjusted.setHours(endAdjusted.getHours() - 1);

  return { start: startAdjusted, end: endAdjusted };
}

function getComparisonWindow(timeRange: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(end);

  switch (timeRange) {
    case "7d":
      end.setDate(end.getDate() - 7);
      start.setDate(end.getDate() - 6);
      break;
    case "30d":
      end.setDate(end.getDate() - 30);
      start.setDate(end.getDate() - 29);
      break;
    case "90d":
      end.setDate(end.getDate() - 90);
      start.setDate(end.getDate() - 89);
      break;
    default:
      end.setDate(end.getDate() - 7);
      start.setDate(end.getDate() - 6);
      break;
  }

  const startAdjusted = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)
  );
  startAdjusted.setHours(startAdjusted.getHours() - 1);

  const endAdjusted = new Date(
    Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0)
  );
  endAdjusted.setDate(endAdjusted.getDate() + 1);
  endAdjusted.setHours(endAdjusted.getHours() - 1);

  return { start: startAdjusted, end: endAdjusted };
}

function getVersionFilter(analyticsVersion: "v1" | "v2"): string {
  if (analyticsVersion === "v2") {
    return `JSONExtractString(properties,'analytics_version') = 'v2'`;
  }
  return `(JSONExtractString(properties,'analytics_version') != 'v2' OR JSONExtractString(properties,'analytics_version') = '')`;
}

function getBaseFilters(
  startIso: string,
  endIso: string,
  environment: string,
  analyticsVersion: "v1" | "v2"
): string {
  return `timestamp >= toDateTime('${startIso}','Europe/Warsaw') AND timestamp < toDateTime('${endIso}','Europe/Warsaw') AND JSONExtractString(properties,'consent_status') = 'granted' AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}' AND ${getVersionFilter(
    analyticsVersion
  )}`;
}

function metric(value: number, previous: number) {
  const delta = previous === 0 ? (value > 0 ? 100 : 0) : ((value - previous) / previous) * 100;
  return {
    value: Math.round(value),
    previous: Math.round(previous),
    delta,
    change: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`,
  };
}

function eventCountQuery(event: string, filters: string): string {
  return `SELECT count() AS value FROM events WHERE event = '${event}' AND ${filters}`;
}

function eventCountWithConditionQuery(
  event: string,
  condition: string,
  filters: string
): string {
  return `SELECT count() AS value FROM events WHERE event = '${event}' AND ${condition} AND ${filters}`;
}

export async function GET(request: NextRequest) {
  try {
    const environment = "production";
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";
    const analyticsVersionParam = searchParams.get("analyticsVersion") || "v2";
    const analyticsVersion =
      analyticsVersionParam === "v1" ? "v1" : ("v2" as "v1" | "v2");

    if (!["7d", "30d", "90d"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange. Must be 7d, 30d, or 90d" },
        { status: 400 }
      );
    }

    const currentWindow = getTimeWindow(timeRange);
    const comparisonWindow = getComparisonWindow(timeRange);

    const currentFilters = getBaseFilters(
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      environment,
      analyticsVersion
    );
    const comparisonFilters = getBaseFilters(
      comparisonWindow.start.toISOString(),
      comparisonWindow.end.toISOString(),
      environment,
      analyticsVersion
    );

    const viewedQuery = eventCountQuery("dashboard_viewed", currentFilters);
    const viewedComparisonQuery = eventCountQuery(
      "dashboard_viewed",
      comparisonFilters
    );
    const elementPressedQuery = eventCountQuery(
      "dashboard_element_pressed",
      currentFilters
    );
    const elementPressedComparisonQuery = eventCountQuery(
      "dashboard_element_pressed",
      comparisonFilters
    );
    const streakPressedQuery = eventCountQuery(
      "dashboard_streak_pressed",
      currentFilters
    );
    const streakPressedComparisonQuery = eventCountQuery(
      "dashboard_streak_pressed",
      comparisonFilters
    );
    const eventPressedQuery = eventCountWithConditionQuery(
      "dashboard_event_pressed",
      `JSONExtractString(properties,'context') = 'dashboard'`,
      currentFilters
    );
    const eventPressedComparisonQuery = eventCountWithConditionQuery(
      "dashboard_event_pressed",
      `JSONExtractString(properties,'context') = 'dashboard'`,
      comparisonFilters
    );
    const moodSelectedDashboardQuery = eventCountWithConditionQuery(
      "mood_selected",
      `JSONExtractString(properties,'context') = 'dashboard'`,
      currentFilters
    );
    const moodSelectedDashboardComparisonQuery = eventCountWithConditionQuery(
      "mood_selected",
      `JSONExtractString(properties,'context') = 'dashboard'`,
      comparisonFilters
    );
    const premiumGetPremiumQuery = eventCountQuery(
      "premium_banner_pressed",
      currentFilters
    );
    const premiumGetPremiumComparisonQuery = eventCountQuery(
      "premium_banner_pressed",
      comparisonFilters
    );
    const premiumDismissedQuery = eventCountWithConditionQuery(
      "dashboard_element_pressed",
      `JSONExtractString(properties,'element_type') = 'premium_banner_dismissed'`,
      currentFilters
    );
    const premiumDismissedComparisonQuery = eventCountWithConditionQuery(
      "dashboard_element_pressed",
      `JSONExtractString(properties,'element_type') = 'premium_banner_dismissed'`,
      comparisonFilters
    );
    const addPracticePressedQuery = eventCountQuery(
      "add_practice_pressed",
      currentFilters
    );
    const addPracticePressedComparisonQuery = eventCountQuery(
      "add_practice_pressed",
      comparisonFilters
    );
    const addPracticeSheetOpenedQuery = eventCountQuery(
      "add_practice_sheet_opened",
      currentFilters
    );
    const addPracticeSheetOpenedComparisonQuery = eventCountQuery(
      "add_practice_sheet_opened",
      comparisonFilters
    );
    const practiceTypeSelectedQuery = eventCountQuery(
      "practice_type_selected",
      currentFilters
    );
    const practiceTypeSelectedComparisonQuery = eventCountQuery(
      "practice_type_selected",
      comparisonFilters
    );
    const practiceTemplateSelectedQuery = eventCountQuery(
      "practice_template_selected",
      currentFilters
    );
    const practiceTemplateSelectedComparisonQuery = eventCountQuery(
      "practice_template_selected",
      comparisonFilters
    );

    const elementTypesQuery = `
      SELECT
        JSONExtractString(properties,'element_type') AS element_type,
        count() AS count
      FROM events
      WHERE event = 'dashboard_element_pressed'
        AND ${currentFilters}
      GROUP BY element_type
      ORDER BY count DESC
      LIMIT 20
    `;

    const practiceTypesQuery = `
      SELECT
        JSONExtractString(properties,'practice_type') AS practice_type,
        count() AS count
      FROM events
      WHERE event = 'practice_type_selected'
        AND ${currentFilters}
      GROUP BY practice_type
      ORDER BY count DESC
      LIMIT 20
    `;

    const [
      viewed,
      viewedComparison,
      elementPressed,
      elementPressedComparison,
      streakPressed,
      streakPressedComparison,
      eventPressed,
      eventPressedComparison,
      moodSelectedDashboard,
      moodSelectedDashboardComparison,
      premiumGetPremium,
      premiumGetPremiumComparison,
      premiumDismissed,
      premiumDismissedComparison,
      addPracticePressed,
      addPracticePressedComparison,
      addPracticeSheetOpened,
      addPracticeSheetOpenedComparison,
      practiceTypeSelected,
      practiceTypeSelectedComparison,
      practiceTemplateSelected,
      practiceTemplateSelectedComparison,
      elementTypesRows,
      practiceTypesRows,
    ] = await Promise.all([
      queryPostHog(viewedQuery),
      queryPostHog(viewedComparisonQuery),
      queryPostHog(elementPressedQuery),
      queryPostHog(elementPressedComparisonQuery),
      queryPostHog(streakPressedQuery),
      queryPostHog(streakPressedComparisonQuery),
      queryPostHog(eventPressedQuery),
      queryPostHog(eventPressedComparisonQuery),
      queryPostHog(moodSelectedDashboardQuery),
      queryPostHog(moodSelectedDashboardComparisonQuery),
      queryPostHog(premiumGetPremiumQuery),
      queryPostHog(premiumGetPremiumComparisonQuery),
      queryPostHog(premiumDismissedQuery),
      queryPostHog(premiumDismissedComparisonQuery),
      queryPostHog(addPracticePressedQuery),
      queryPostHog(addPracticePressedComparisonQuery),
      queryPostHog(addPracticeSheetOpenedQuery),
      queryPostHog(addPracticeSheetOpenedComparisonQuery),
      queryPostHog(practiceTypeSelectedQuery),
      queryPostHog(practiceTypeSelectedComparisonQuery),
      queryPostHog(practiceTemplateSelectedQuery),
      queryPostHog(practiceTemplateSelectedComparisonQuery),
      queryPostHogArray(elementTypesQuery),
      queryPostHogArray(practiceTypesQuery),
    ]);

    const elementTypes = elementTypesRows.map((row) => ({
      elementType: String(row[0] || "unknown"),
      count: typeof row[1] === "number" ? row[1] : Number(row[1]) || 0,
    }));

    const practiceTypes = practiceTypesRows.map((row) => ({
      practiceType: String(row[0] || "unknown"),
      count: typeof row[1] === "number" ? row[1] : Number(row[1]) || 0,
    }));

    return NextResponse.json({
      viewed: metric(viewed, viewedComparison),
      elementPressed: metric(elementPressed, elementPressedComparison),
      streakPressed: metric(streakPressed, streakPressedComparison),
      eventPressed: metric(eventPressed, eventPressedComparison),
      moodSelectedDashboard: metric(
        moodSelectedDashboard,
        moodSelectedDashboardComparison
      ),
      premiumGetPremium: metric(premiumGetPremium, premiumGetPremiumComparison),
      premiumDismissed: metric(premiumDismissed, premiumDismissedComparison),
      addPracticePressed: metric(
        addPracticePressed,
        addPracticePressedComparison
      ),
      addPracticeSheetOpened: metric(
        addPracticeSheetOpened,
        addPracticeSheetOpenedComparison
      ),
      practiceTypeSelected: metric(
        practiceTypeSelected,
        practiceTypeSelectedComparison
      ),
      practiceTemplateSelected: metric(
        practiceTemplateSelected,
        practiceTemplateSelectedComparison
      ),
      elementTypes,
      practiceTypes,
    });
  } catch (error) {
    console.error("Dashboard V2 API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch dashboard v2 data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

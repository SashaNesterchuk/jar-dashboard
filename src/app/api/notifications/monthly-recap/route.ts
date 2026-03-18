import { NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function queryPostHog(query: string): Promise<Array<Array<unknown>>> {
  if (!POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY is not configured");
  }
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_API_KEY.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${text}`);
  }
  const data = await response.json();
  const results = data.results || data.responseData?.results;
  return results || [];
}

export async function POST() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const query = `
      SELECT
        JSONExtractString(properties,'user_id') as user_id,
        countIf(event = 'practice_completed') as practices_count,
        countIf(event = 'mood_check_in_completed') as checkins_count
      FROM events
      WHERE timestamp >= subtractDays(now(), 30)
        AND JSONExtractString(properties,'user_id') IS NOT NULL
        AND JSONExtractString(properties,'user_id') != ''
      GROUP BY user_id
      HAVING (practices_count + checkins_count) > 0
    `;

    const results = await queryPostHog(query);
    const users = results.map((row) => ({
      id: String(row[0] || ""),
      practices_count: Number(row[1] || 0),
      checkins_count: Number(row[2] || 0),
    })).filter((u) => u.id);

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users with activity in last 30 days",
        sent: 0,
      });
    }

    const functionUrl = `${SUPABASE_URL}/functions/v1/send-monthly-recap`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ users }),
    });

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || "Edge function failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error in monthly-recap:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

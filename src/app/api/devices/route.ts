import { NextResponse } from "next/server";

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

export async function GET() {
  try {
    const environment = "production";

    // Query for device type and OS version data (all time)
    const devicesQuery = `
      SELECT 
        JSONExtractString(properties,'device_type') as device_type,
        JSONExtractString(properties,'os_version') as os_version,
        uniqExact(JSONExtractString(properties,'user_id')) as user_count
      FROM events
      WHERE JSONExtractString(properties,'consent_status') = 'granted'
        AND coalesce(JSONExtractString(properties,'environment'),'production') = '${environment}'
        AND JSONExtractString(properties,'user_id') IS NOT NULL
        AND JSONExtractString(properties,'user_id') != ''
        AND JSONExtractString(properties,'device_type') IS NOT NULL
        AND JSONExtractString(properties,'device_type') != ''
        AND JSONExtractString(properties,'os_version') IS NOT NULL
        AND JSONExtractString(properties,'os_version') != ''
      GROUP BY device_type, os_version
      ORDER BY user_count DESC
    `;

    console.log("Executing devices query (all time)");

    const devicesResults = await queryPostHogArray(devicesQuery);

    // Transform results
    const devices = devicesResults.map((row) => ({
      deviceType: String(row[0] || ""),
      osVersion: String(row[1] || ""),
      userCount: typeof row[2] === "number" ? row[2] : Number(row[2]) || 0,
    }));

    return NextResponse.json({
      devices,
    });
  } catch (error) {
    console.error("Devices API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch devices data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


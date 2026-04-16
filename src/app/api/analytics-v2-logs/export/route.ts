import { NextResponse } from "next/server";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;

interface PostHogQueryResponse {
  results?: Array<Array<unknown>>;
  responseData?: {
    results?: Array<Array<unknown>>;
  };
}

async function queryPostHogArray(query: string): Promise<Array<Array<unknown>>> {
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
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
  }

  const data: PostHogQueryResponse = await response.json();
  return data.results || data.responseData?.results || [];
}

export async function GET() {
  try {
    const batchSize = 10000;
    const rows: Array<Array<unknown>> = [];
    let offset = 0;

    while (true) {
      const query = `
        SELECT
          timestamp,
          event,
          distinct_id,
          properties
        FROM events
        WHERE JSONExtractString(properties,'analytics_version') = 'v2'
        ORDER BY timestamp ASC
        LIMIT ${batchSize}
        OFFSET ${offset}
      `;

      const chunk = await queryPostHogArray(query);
      rows.push(...chunk);

      if (chunk.length < batchSize) {
        break;
      }

      offset += batchSize;
    }

    const lines = rows.map((row) =>
      row
        .map((value) => {
          if (value === null || value === undefined) {
            return "";
          }

          if (typeof value === "object") {
            return JSON.stringify(value);
          }

          return String(value);
        })
        .join("\t")
    );

    const payload = ["timestamp\tevent\tdistinct_id\tproperties", ...lines].join(
      "\n"
    );
    const filename = `analytics-v2-logs-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.txt`;

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Analytics v2 export error:", error);
    return NextResponse.json(
      {
        error: "Failed to export analytics v2 logs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

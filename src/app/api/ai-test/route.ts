import { NextRequest } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

const FUNCTION_MAP: Record<string, string> = {
  generate_ai_chat: `${SUPABASE_URL}/functions/v1/generate_ai_chat`,
  generate_ai_summary: `${SUPABASE_URL}/functions/v1/generate_ai_summary`,
  generate_ai_tags: `${SUPABASE_URL}/functions/v1/generate_ai_tags`,
  generate_ai_events: `${SUPABASE_URL}/functions/v1/generate_ai_events`,
  generate_ai_ny_summary: `${SUPABASE_URL}/functions/v1/generate_ai_ny_summary`,
  generate_ai_review: `${SUPABASE_URL}/functions/v1/generate_ai_review`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { function: functionName, payload } = body;

    // Validate function name
    if (!functionName || !FUNCTION_MAP[functionName]) {
      return Response.json(
        { error: "Invalid function name" },
        { status: 400 }
      );
    }

    // Validate payload
    if (!payload || typeof payload !== "object") {
      return Response.json(
        { error: "Invalid payload - must be an object" },
        { status: 400 }
      );
    }

    // Add testMode flag to payload
    const testPayload = {
      ...payload,
      testMode: true,
    };

    console.log(`Calling ${functionName} with test mode enabled`);

    // Call the Supabase edge function
    const functionUrl = FUNCTION_MAP[functionName];
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", responseText);
      return Response.json(
        {
          error: "Invalid JSON response from function",
          raw_response: responseText,
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error(`Function ${functionName} returned error:`, data);
      return Response.json(
        {
          error: data.error || data.message || "Function execution failed",
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    // Return the response from the AI function
    return Response.json(
      {
        success: true,
        function: functionName,
        result: data,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in AI test endpoint:", error);
    return Response.json(
      {
        error: error.message || "Internal server error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEMORY_FN = "generate_ai_memory";

interface MemoryAIRequest {
  operation: "smart_summary" | "enrichment" | "safety_classifier";
  input: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing for memory AI proxy",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as MemoryAIRequest;
    if (!body?.operation || !body?.input) {
      return NextResponse.json(
        { error: "operation and input are required" },
        { status: 400 },
      );
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${MEMORY_FN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "memory edge function call failed",
          status: response.status,
          details: parsed,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(parsed ?? {});
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected memory AI proxy error",
      },
      { status: 500 },
    );
  }
}

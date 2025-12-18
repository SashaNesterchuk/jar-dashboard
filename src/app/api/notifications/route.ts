import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// POST - Create a new scheduled notification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.date || !body.time || !body.content) {
      return Response.json(
        { error: "Missing required fields: date, time, content" },
        { status: 400 }
      );
    }

    // Validate English content is present
    if (!body.content.en || !body.content.en.title) {
      return Response.json(
        { error: "English content is required" },
        { status: 400 }
      );
    }

    // Validate content structure
    for (const [lang, content] of Object.entries(body.content)) {
      const langContent = content as any;
      if (
        !langContent.title ||
        !langContent.bodyShort ||
        !langContent.bodyLong
      ) {
        return Response.json(
          { error: `Invalid content structure for language: ${lang}` },
          { status: 400 }
        );
      }
    }

    // Insert notification
    const { data, error } = await supabase
      .from("scheduled_notifications")
      .insert({
        scheduled_date: body.date,
        scheduled_time: body.time,
        content: body.content,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/notifications:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get all scheduled notifications
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    let query = supabase
      .from("scheduled_notifications")
      .select("*")
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false })
      .limit(limit);

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET /api/notifications:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scheduled notification (only if pending)
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Missing notification id" },
        { status: 400 }
      );
    }

    // Check if notification is pending
    const { data: notification, error: fetchError } = await supabase
      .from("scheduled_notifications")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError) {
      return Response.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.status !== "pending") {
      return Response.json(
        { error: "Can only delete pending notifications" },
        { status: 400 }
      );
    }

    // Delete notification
    const { error } = await supabase
      .from("scheduled_notifications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting notification:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error in DELETE /api/notifications:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

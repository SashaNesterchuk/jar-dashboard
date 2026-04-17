import { NextResponse } from "next/server";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      content?: unknown;
    };
    const title =
      typeof body.title === "string" && body.title.trim() !== ""
        ? body.title.trim()
        : null;
    const initialContent =
      typeof body.content === "string" ? body.content : null;

    const supabase = getDocsSupabaseServiceClient();
    const { data, error } = await supabase.rpc("collab_create_chat_with_document", {
      p_title: title,
    });

    if (error) {
      console.error("collab_create_chat_with_document:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (
      !row ||
      typeof row !== "object" ||
      !("chat_id" in row) ||
      !("document_id" in row)
    ) {
      return NextResponse.json(
        { error: "Unexpected RPC response" },
        { status: 500 }
      );
    }

    const documentId = row.document_id as string;

    if (initialContent !== null) {
      const { error: docErr } = await supabase
        .from("documents")
        .update({ content: initialContent })
        .eq("id", documentId);
      if (docErr) {
        console.error("collab-docs sessions initial content:", docErr);
        return NextResponse.json(
          { error: docErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      chatId: row.chat_id as string,
      documentId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/collab-docs/sessions:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

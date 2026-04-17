import { NextResponse } from "next/server";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";

type Params = {
  params: Promise<{
    documentId?: string;
  }>;
};

export async function POST(_request: Request, context: Params) {
  try {
    const { documentId } = await context.params;
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const supabase = getDocsSupabaseServiceClient();
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return NextResponse.json(
        { error: docErr?.message ?? "Document not found" },
        { status: 404 }
      );
    }

    const chatTitle =
      typeof doc.title === "string" && doc.title.trim() !== ""
        ? doc.title.trim()
        : "Chat";

    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .insert({ document_id: documentId, title: chatTitle })
      .select("id")
      .single();

    if (chatErr || !chat) {
      console.error("POST document chats:", chatErr);
      return NextResponse.json(
        { error: chatErr?.message ?? "Failed to create chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chatId: chat.id as string });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/collab-docs/documents/[documentId]/chats:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

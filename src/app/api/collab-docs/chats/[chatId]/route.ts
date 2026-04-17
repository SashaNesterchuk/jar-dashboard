import { NextResponse } from "next/server";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";

type Params = {
  params: Promise<{
    chatId?: string;
  }>;
};

export async function DELETE(_request: Request, context: Params) {
  try {
    const { chatId } = await context.params;
    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    const supabase = getDocsSupabaseServiceClient();

    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("id, document_id")
      .eq("id", chatId)
      .maybeSingle();

    if (chatErr || !chat) {
      return NextResponse.json(
        { error: chatErr?.message ?? "Chat not found" },
        { status: 404 }
      );
    }

    const { data: siblings, error: sibErr } = await supabase
      .from("chats")
      .select("id, created_at")
      .eq("document_id", chat.document_id)
      .order("created_at", { ascending: true });

    if (sibErr) {
      return NextResponse.json({ error: sibErr.message }, { status: 500 });
    }

    if ((siblings?.length ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only chat for a document." },
        { status: 400 }
      );
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("primary_chat_id")
      .eq("id", chat.document_id)
      .maybeSingle();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    if (doc?.primary_chat_id === chatId) {
      const fallback = siblings!.find((s) => s.id !== chatId);
      if (!fallback) {
        return NextResponse.json(
          { error: "No fallback chat available." },
          { status: 400 }
        );
      }
      const { error: updErr } = await supabase
        .from("documents")
        .update({ primary_chat_id: fallback.id })
        .eq("id", chat.document_id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    const { error: delErr } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId);

    if (delErr) {
      console.error("DELETE chat:", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const nextActive =
      doc?.primary_chat_id === chatId
        ? siblings!.find((s) => s.id !== chatId)!.id
        : siblings!.find((s) => s.id !== chatId)?.id ?? null;

    return NextResponse.json({ ok: true, nextActiveChatId: nextActive });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/collab-docs/chats/[chatId]:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

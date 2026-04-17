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
    const { error } = await supabase.from("chats").delete().eq("id", chatId);

    if (error) {
      console.error("DELETE /api/collab-docs/sessions/[chatId]:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/collab-docs/sessions/[chatId]:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

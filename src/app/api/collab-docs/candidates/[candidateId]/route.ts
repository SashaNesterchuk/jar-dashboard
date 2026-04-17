import { NextResponse } from "next/server";
import { z } from "zod";
import { chunkDocumentForAi } from "@/lib/collab-doc-chunking";
import { rebuildDocumentChunks } from "@/lib/collab-doc-chunk-store";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";

const bodySchema = z.object({
  action: z.enum(["apply", "reject"]),
});

type CandidateRow = {
  id: string;
  chat_id: string;
  document_id: string;
  base_document_content: string;
  candidate_document_content: string;
  model: string;
  chat_reply: string;
  status: "pending" | "applied" | "rejected" | "superseded";
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await context.params;
    const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const supabase = getDocsSupabaseServiceClient();
    const { data: candidate, error: candErr } = await supabase
      .from("ai_change_candidates")
      .select(
        "id, chat_id, document_id, base_document_content, candidate_document_content, model, chat_reply, status, usage"
      )
      .eq("id", candidateId)
      .single<CandidateRow>();

    if (candErr || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    if (candidate.status !== "pending") {
      return NextResponse.json(
        { error: `Candidate is already ${candidate.status}` },
        { status: 409 }
      );
    }

    if (parsedBody.data.action === "reject") {
      const { error: rejectErr } = await supabase
        .from("ai_change_candidates")
        .update({ status: "rejected" })
        .eq("id", candidateId)
        .eq("status", "pending");
      if (rejectErr) {
        return NextResponse.json({ error: rejectErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    const { data: document, error: docErr } = await supabase
      .from("documents")
      .select("id, content")
      .eq("id", candidate.document_id)
      .single<{ id: string; content: string | null }>();
    if (docErr || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const currentContent = document.content ?? "";
    if (currentContent !== candidate.base_document_content) {
      return NextResponse.json(
        {
          error: "Document changed since proposal was generated",
          code: "stale_candidate",
        },
        { status: 409 }
      );
    }

    const { error: updDocErr } = await supabase
      .from("documents")
      .update({ content: candidate.candidate_document_content })
      .eq("id", candidate.document_id);
    if (updDocErr) {
      return NextResponse.json({ error: updDocErr.message }, { status: 500 });
    }

    try {
      const chunks = chunkDocumentForAi(candidate.candidate_document_content);
      await rebuildDocumentChunks(candidate.document_id, chunks);
    } catch (chunkErr) {
      return NextResponse.json(
        {
          error:
            chunkErr instanceof Error
              ? chunkErr.message
              : "Failed to rebuild document chunks",
        },
        { status: 500 }
      );
    }

    const { error: applyErr } = await supabase
      .from("ai_change_candidates")
      .update({ status: "applied", applied_at: new Date().toISOString() })
      .eq("id", candidateId)
      .eq("status", "pending");
    if (applyErr) {
      return NextResponse.json({ error: applyErr.message }, { status: 500 });
    }

    const { error: asstErr } = await supabase.from("messages").insert({
      chat_id: candidate.chat_id,
      role: "assistant",
      content: candidate.chat_reply,
      model: candidate.model,
      usage: candidate.usage,
      metadata: { document_applied: true, candidate_id: candidate.id },
    });
    if (asstErr) {
      return NextResponse.json({ error: asstErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "applied" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

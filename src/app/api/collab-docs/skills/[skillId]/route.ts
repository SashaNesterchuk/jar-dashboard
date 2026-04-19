import { NextResponse } from "next/server";
import { z } from "zod";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";

type Params = {
  params: Promise<{ skillId?: string }>;
};

const patchBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  prompt: z.string().min(1).max(50_000).optional(),
  icon: z.string().max(100).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: Params) {
  try {
    const { skillId } = await context.params;
    if (!skillId) {
      return NextResponse.json({ error: "Missing skillId" }, { status: 400 });
    }

    const json = await request.json();
    const parsed = patchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) {
      patch.description =
        parsed.data.description === null || parsed.data.description === ""
          ? null
          : parsed.data.description.trim();
    }
    if (parsed.data.prompt !== undefined) patch.prompt = parsed.data.prompt.trim();
    if (parsed.data.icon !== undefined) {
      patch.icon =
        parsed.data.icon === null || parsed.data.icon === ""
          ? null
          : parsed.data.icon.trim();
    }
    if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order;
    if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = getDocsSupabaseServiceClient();
    const { data, error } = await supabase
      .from("chat_skills")
      .update(patch)
      .eq("id", skillId)
      .select(
        "id, slug, name, description, prompt, icon, sort_order, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("PATCH /api/collab-docs/skills/[skillId]:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({ skill: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/collab-docs/skills/[skillId]:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Permanently removes the row. Use PATCH { is_active: false } to hide from the picker only. */
export async function DELETE(_request: Request, context: Params) {
  try {
    const { skillId } = await context.params;
    if (!skillId) {
      return NextResponse.json({ error: "Missing skillId" }, { status: 400 });
    }

    const supabase = getDocsSupabaseServiceClient();
    const { data, error } = await supabase
      .from("chat_skills")
      .delete()
      .eq("id", skillId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("DELETE /api/collab-docs/skills/[skillId]:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/collab-docs/skills/[skillId]:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

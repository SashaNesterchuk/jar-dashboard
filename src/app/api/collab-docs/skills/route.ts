import { NextResponse } from "next/server";
import { z } from "zod";
import { getDocsSupabaseServiceClient } from "@/lib/docs-supabase";

function slugifyBase(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "skill";
}

async function uniqueSlugForInsert(
  supabase: ReturnType<typeof getDocsSupabaseServiceClient>,
  base: string
): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase
      .from("chat_skills")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) {
      console.error("uniqueSlugForInsert:", error);
      candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`;
      continue;
    }
    if (!data) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const postBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  prompt: z.string().min(1).max(50_000),
  icon: z.string().max(100).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = getDocsSupabaseServiceClient();
    const { data, error } = await supabase
      .from("chat_skills")
      .select(
        "id, slug, name, description, prompt, icon, sort_order, is_active, created_at, updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/collab-docs/skills:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ skills: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/collab-docs/skills:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = postBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const supabase = getDocsSupabaseServiceClient();
    const baseSlug = slugifyBase(parsed.data.name);
    const slug = await uniqueSlugForInsert(supabase, baseSlug);

    const { data, error } = await supabase
      .from("chat_skills")
      .insert({
        slug,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        prompt: parsed.data.prompt.trim(),
        icon: parsed.data.icon?.trim() || null,
        sort_order: parsed.data.sort_order ?? 0,
        is_active: parsed.data.is_active ?? true,
      })
      .select(
        "id, slug, name, description, prompt, icon, sort_order, is_active, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      console.error("POST /api/collab-docs/skills:", error);
      return NextResponse.json(
        { error: error?.message ?? "Insert failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ skill: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/collab-docs/skills:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

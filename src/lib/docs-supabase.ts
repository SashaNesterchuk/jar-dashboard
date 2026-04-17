import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireDocsUrl(): string {
  const url = process.env.NEXT_PUBLIC_DOCS_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_DOCS_SUPABASE_URL (collaborative docs Supabase project)."
    );
  }
  return url;
}

function requireDocsAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY (collaborative docs Supabase project)."
    );
  }
  return key;
}

/** Browser / Client Components — anon key, RLS applies. */
export function getDocsSupabaseBrowserClient(): SupabaseClient {
  return createClient(requireDocsUrl(), requireDocsAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Server-only: service role bypasses RLS. Do not import from Client Components. */
export function getDocsSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_DOCS_SUPABASE_URL;
  const key = process.env.DOCS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_DOCS_SUPABASE_URL or DOCS_SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

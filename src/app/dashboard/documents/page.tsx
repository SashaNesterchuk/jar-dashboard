"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeDocumentListRow } from "@/lib/collab-docs-normalize";
import {
  COLLAB_IMPORT_MAX_BYTES,
  safeDownloadBasename,
} from "@/lib/collab-doc-files";
import { getDocsSupabaseBrowserClient } from "@/lib/docs-supabase";
import type { CollabDocumentListRow } from "@/types/collab-docs";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function DocumentsPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<CollabDocumentListRow[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [listFileError, setListFileError] = React.useState<string | null>(null);
  const [configOk, setConfigOk] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const url = process.env.NEXT_PUBLIC_DOCS_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setLoadError(
        "Set NEXT_PUBLIC_DOCS_SUPABASE_URL and NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY in .env.local."
      );
      return;
    }
    setConfigOk(true);
  }, []);

  const refresh = React.useCallback(async () => {
    if (!configOk) return;
    setLoadError(null);
    try {
      const supabase = getDocsSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, chat_id, title, content, updated_at, created_at, chats(id, title, created_at, default_model)"
        )
        .order("updated_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        return;
      }
      const list = Array.isArray(data)
        ? data.map((r) =>
            normalizeDocumentListRow(r as Record<string, unknown>)
          )
        : [];
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, [configOk]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleNew = React.useCallback(async () => {
    setCreating(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/collab-docs/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        chatId?: string;
      };
      if (!res.ok) {
        setLoadError(json.error || `HTTP ${res.status}`);
        return;
      }
      if (!json.chatId) {
        setLoadError("No chatId in response");
        return;
      }
      router.push(`/dashboard/documents/${json.chatId}`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }, [router]);

  const handleExportRow = React.useCallback((row: CollabDocumentListRow) => {
    setListFileError(null);
    const base = safeDownloadBasename(row.title?.trim() ?? "", "document");
    const blob = new Blob([row.content ?? ""], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportFileChange = React.useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setListFileError(null);
      setLoadError(null);
      if (file.size > COLLAB_IMPORT_MAX_BYTES) {
        setListFileError(
          `File is too large (max ${Math.floor(COLLAB_IMPORT_MAX_BYTES / (1024 * 1024))} MB).`
        );
        return;
      }
      setImporting(true);
      try {
        const text = await file.text();
        const stem = file.name.replace(/\.(md|markdown|txt)$/i, "").trim();
        const title = stem || "Imported document";
        const res = await fetch("/api/collab-docs/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content: text }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          chatId?: string;
        };
        if (!res.ok) {
          setListFileError(json.error || `HTTP ${res.status}`);
          return;
        }
        if (!json.chatId) {
          setListFileError("No chatId in response");
          return;
        }
        router.push(`/dashboard/documents/${json.chatId}`);
      } catch (err) {
        setListFileError(
          err instanceof Error ? err.message : "Failed to import file"
        );
      } finally {
        setImporting(false);
      }
    },
    [router]
  );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Documents</h1>
                  <p className="text-muted-foreground max-w-2xl">
                    Open a session, start blank, or import a Markdown file. Export
                    any row as <code className="text-xs">.md</code>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={importInputRef}
                    type="file"
                    className="sr-only"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    aria-label="Import Markdown as new document"
                    onChange={handleImportFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!configOk || creating || importing}
                    onClick={() => {
                      setListFileError(null);
                      importInputRef.current?.click();
                    }}
                  >
                    <Upload className="size-4" />
                    {importing ? "Importing…" : "Import"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleNew()}
                    disabled={!configOk || creating || importing}
                  >
                    {creating ? "Creating…" : "New document"}
                  </Button>
                </div>
              </div>

              {loadError ? (
                <div className="px-4 lg:px-6 text-sm text-destructive">
                  {loadError}
                </div>
              ) : null}
              {listFileError ? (
                <div className="px-4 lg:px-6 text-sm text-destructive">
                  {listFileError}
                </div>
              ) : null}

              <div className="px-4 lg:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground text-center py-8"
                        >
                          {configOk
                            ? "No documents yet. Create one with New document."
                            : "Configure Supabase env vars to load documents."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.title?.trim() || "Untitled"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(row.updated_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportRow(row)}
                              >
                                <Download className="size-4" />
                                Export
                              </Button>
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  href={`/dashboard/documents/${row.chat_id}`}
                                >
                                  Open
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollabDocChatPanel } from "@/components/collab-doc-editor/collab-doc-chat-panel";
import { CollabMarkdownEditor } from "@/components/collab-doc-editor/collab-markdown-editor";
import { normalizeDocWithChat } from "@/lib/collab-docs-normalize";
import {
  COLLAB_DEFAULT_MODEL_ID,
  getCollabModel,
} from "@/lib/collab-ai-models";
import { getDocsSupabaseBrowserClient } from "@/lib/docs-supabase";
import type { CollabMessage, CollabMessageMetadata } from "@/types/collab-docs";
import { cn } from "@/lib/utils";
import {
  COLLAB_IMPORT_MAX_BYTES,
  safeDownloadBasename,
} from "@/lib/collab-doc-files";

function normalizeMessageRow(raw: Record<string, unknown>): CollabMessage {
  return {
    id: raw.id as string,
    chat_id: raw.chat_id as string,
    role: raw.role as CollabMessage["role"],
    content: raw.content as string | null,
    created_at: raw.created_at as string,
    model: raw.model as string | null,
    usage: raw.usage as CollabMessage["usage"],
    metadata: (raw.metadata as CollabMessageMetadata) ?? {},
    sort_key: raw.sort_key as number | null,
  };
}

interface CollabDocEditorProps {
  chatId: string;
}

export function CollabDocEditor({ chatId }: CollabDocEditorProps) {
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [saveState, setSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [messages, setMessages] = React.useState<CollabMessage[]>([]);
  const [modelId, setModelId] = React.useState(COLLAB_DEFAULT_MODEL_ID);
  const [remoteDocStale, setRemoteDocStale] = React.useState(false);

  const [otherDocs, setOtherDocs] = React.useState<
    { id: string; title: string | null }[]
  >([]);
  const [contextIds, setContextIds] = React.useState<string[]>([]);
  const [contextOpen, setContextOpen] = React.useState(true);
  const [docFileError, setDocFileError] = React.useState<string | null>(null);

  const contentDraftRef = React.useRef(content);

  React.useEffect(() => {
    contentDraftRef.current = content;
  }, [content]);

  React.useEffect(() => {
    if (!documentId) return;
    setContextIds((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : prev
    );
  }, [documentId]);

  const editorFocused = React.useRef(false);
  const importFileInputRef = React.useRef<HTMLInputElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshDoc = React.useCallback(async () => {
    const supabase = getDocsSupabaseBrowserClient();
    const { data, error: qErr } = await supabase
      .from("documents")
      .select(
        "id, chat_id, title, content, created_at, updated_at, chats(id, created_at, title, default_model)"
      )
      .eq("chat_id", chatId)
      .maybeSingle();
    if (qErr || !data) return;
    const d = normalizeDocWithChat(data as Record<string, unknown>);
    setDocumentId(d.id);
    setTitle(d.title ?? "");
    if (!editorFocused.current) {
      setContent(d.content ?? "");
    }
    const dm = d.chats?.default_model;
    if (dm && getCollabModel(dm)) setModelId(dm);
  }, [chatId]);

  const refreshMessages = React.useCallback(async () => {
    const supabase = getDocsSupabaseBrowserClient();
    const { data, error: qErr } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (qErr) return;
    setMessages(
      (data ?? []).map((r) =>
        normalizeMessageRow(r as unknown as Record<string, unknown>)
      )
    );
  }, [chatId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = process.env.NEXT_PUBLIC_DOCS_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY;
      if (!url || !key) {
        setLoadError("Missing NEXT_PUBLIC_DOCS_SUPABASE_* env.");
        setLoading(false);
        return;
      }
      try {
        const supabase = getDocsSupabaseBrowserClient();
        const { data, error: qErr } = await supabase
          .from("documents")
          .select(
            "id, chat_id, title, content, created_at, updated_at, chats(id, created_at, title, default_model)"
          )
          .eq("chat_id", chatId)
          .maybeSingle();
        if (cancelled) return;
        if (qErr || !data) {
          setLoadError(qErr?.message ?? "Document not found");
          setLoading(false);
          return;
        }
        const d = normalizeDocWithChat(data as Record<string, unknown>);
        setDocumentId(d.id);
        setTitle(d.title ?? "");
        setContent(d.content ?? "");
        const dm = d.chats?.default_model;
        if (dm && getCollabModel(dm)) setModelId(dm);
        await refreshMessages();
        const { data: allDocs } = await supabase
          .from("documents")
          .select("id, title")
          .neq("id", d.id)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (!cancelled) setOtherDocs(allDocs ?? []);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Load failed");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, refreshMessages]);

  const persistDocument = React.useCallback(
    async (patch: { title?: string; content?: string }) => {
      if (!documentId) return;
      const supabase = getDocsSupabaseBrowserClient();
      setSaveState("saving");
      const { error } = await supabase
        .from("documents")
        .update(patch)
        .eq("id", documentId);
      setSaveState(error ? "error" : "saved");
    },
    [documentId]
  );

  const schedulePersist = React.useCallback(
    (patch: { title?: string; content?: string }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persistDocument(patch);
      }, 900);
    },
    [persistDocument]
  );

  const handleExportMarkdown = React.useCallback(() => {
    setDocFileError(null);
    const base = safeDownloadBasename(title, "document");
    const blob = new Blob([content], {
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
  }, [title, content]);

  const handleImportFileChange = React.useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !documentId) return;
      setDocFileError(null);
      if (file.size > COLLAB_IMPORT_MAX_BYTES) {
        setDocFileError(
          `File is too large (max ${Math.floor(COLLAB_IMPORT_MAX_BYTES / (1024 * 1024))} MB).`
        );
        return;
      }
      try {
        const text = await file.text();
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        setContent(text);
        setRemoteDocStale(false);
        const stem = file.name.replace(/\.(md|markdown|txt)$/i, "").trim();
        if (!title.trim() && stem) {
          setTitle(stem);
        }
        await persistDocument({
          content: text,
          ...(!title.trim() && stem ? { title: stem } : {}),
        });
      } catch (err) {
        setDocFileError(
          err instanceof Error ? err.message : "Could not read file."
        );
      }
    },
    [documentId, persistDocument, title]
  );

  React.useEffect(() => {
    const supabase = getDocsSupabaseBrowserClient();
    if (!documentId) return;

    const chDoc = supabase
      .channel(`doc:${documentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "documents",
          filter: `id=eq.${documentId}`,
        },
        (payload) => {
          const next = payload.new as { content?: string | null };
          if (typeof next.content !== "string") return;
          if (editorFocused.current) {
            setRemoteDocStale(true);
            return;
          }
          setContent(next.content);
        }
      )
      .subscribe();

    const chMsg = supabase
      .channel(`msg:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          setMessages((prev) => {
            if (prev.some((m) => m.id === r.id)) return prev;
            return [...prev, normalizeMessageRow(r)];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(chDoc);
      void supabase.removeChannel(chMsg);
    };
  }, [documentId, chatId]);

  const persistModel = React.useCallback(
    async (next: string) => {
      const supabase = getDocsSupabaseBrowserClient();
      await supabase.from("chats").update({ default_model: next }).eq("id", chatId);
    },
    [chatId]
  );

  const editorPane = (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      {remoteDocStale ? (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          role="status"
        >
          <span>
            The document changed on the server while you were editing.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-600/50"
            onClick={() => {
              void refreshDoc().then(() => setRemoteDocStale(false));
            }}
          >
            Load latest
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="sr-only" htmlFor="doc-title">
            Title
          </Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => {
              const v = e.target.value;
              setTitle(v);
              schedulePersist({ title: v });
            }}
            onBlur={() => void persistDocument({ title })}
            placeholder="Title"
            className="text-lg font-semibold min-w-[12rem] max-w-xl flex-1"
          />
          <input
            ref={importFileInputRef}
            type="file"
            className="sr-only"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            aria-label="Import Markdown file"
            onChange={handleImportFileChange}
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!documentId}
              onClick={() => {
                setDocFileError(null);
                importFileInputRef.current?.click();
              }}
            >
              <Upload className="size-4" />
              Import
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!documentId}
              onClick={handleExportMarkdown}
            >
              <Download className="size-4" />
              Export
            </Button>
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                saveState === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save error"
                    : ""}
            </span>
          </div>
        </div>
        {docFileError ? (
          <p className="text-xs text-destructive">{docFileError}</p>
        ) : null}
      </div>
      <CollabMarkdownEditor
        className="min-h-0 flex-1"
        value={content}
        onChange={(v) => {
          contentDraftRef.current = v;
          schedulePersist({ content: v });
        }}
        onPersistRequest={(latestValue) => {
          contentDraftRef.current = latestValue;
          setContent(latestValue);
          void persistDocument({ content: latestValue });
        }}
        onEditorFocusChange={(focused) => {
          editorFocused.current = focused;
        }}
      />
      <p className="text-xs text-muted-foreground">
        Remote edits apply when this field is not focused (last-write-wins on
        blur).
      </p>
    </div>
  );

  const chatPane = (
    <CollabDocChatPanel
      chatId={chatId}
      documentId={documentId}
      title={title}
      content={content}
      modelId={modelId}
      onModelIdChange={setModelId}
      persistModel={persistModel}
      messages={messages}
      otherDocs={otherDocs}
      contextIds={contextIds}
      setContextIds={setContextIds}
      contextOpen={contextOpen}
      setContextOpen={setContextOpen}
      refreshDoc={refreshDoc}
    />
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
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-col gap-3 py-4 md:py-6 px-4 lg:px-6 min-h-0">
            <div className="flex items-center gap-3 shrink-0">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/documents">← Documents</Link>
              </Button>
            </div>

            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : loadError ? (
              <p className="text-destructive">{loadError}</p>
            ) : (
              <>
                <Tabs defaultValue="doc" className="lg:hidden flex flex-col flex-1 min-h-0">
                  <TabsList>
                    <TabsTrigger value="doc">Document</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                  </TabsList>
                  <TabsContent value="doc" className="flex-1 min-h-0 mt-3">
                    {editorPane}
                  </TabsContent>
                  <TabsContent value="chat" className="flex-1 min-h-0 mt-3">
                    {chatPane}
                  </TabsContent>
                </Tabs>

                <div className="hidden lg:flex flex-1 gap-6 min-h-0">
                  <div className="flex-1 min-w-0 flex flex-col min-h-0">
                    {editorPane}
                  </div>
                  <div className="w-[400px] shrink-0 border-l pl-6 flex flex-col min-h-0">
                    {chatPane}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client";

import * as React from "react";
import { diffLines } from "diff";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Upload, X } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollabDocChatPanel } from "@/components/collab-doc-editor/collab-doc-chat-panel";
import { CollabMarkdownEditor } from "@/components/collab-doc-editor/collab-markdown-editor";
import {
  COLLAB_DEFAULT_MODEL_ID,
  getCollabModel,
} from "@/lib/collab-ai-models";
import { getDocsSupabaseBrowserClient } from "@/lib/docs-supabase";
import type {
  CollabAiChangeCandidate,
  CollabMessage,
  CollabMessageMetadata,
} from "@/types/collab-docs";
import { cn } from "@/lib/utils";
import {
  COLLAB_IMPORT_MAX_BYTES,
  safeDownloadBasename,
} from "@/lib/collab-doc-files";

const OPEN_DOC_TABS_STORAGE_KEY = "collab-doc-open-tabs-v1";
const MAX_OPEN_DOC_TABS = 5;
type CachedChatState = {
  documentId: string | null;
  title: string;
  content: string;
  modelId: string;
  messages: CollabMessage[];
  otherDocs: { id: string; title: string | null }[];
};
const CHAT_STATE_CACHE = new Map<string, CachedChatState>();

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

export function CollabDocEditor({ chatId: initialChatId }: CollabDocEditorProps) {
  const router = useRouter();
  /**
   * Keep the active chat id in local state so that switching between open
   * document tabs happens purely client-side via `history.pushState` and
   * does NOT trigger a Next.js App Router navigation (which would re-fetch
   * the RSC payload for the dynamic segment and cause a visible reload).
   * The prop is only used as the initial value on mount; subsequent URL
   * changes from back/forward are synced via `popstate`.
   */
  const [chatId, setChatIdState] = React.useState(initialChatId);
  React.useEffect(() => {
    setChatIdState(initialChatId);
  }, [initialChatId]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePop = () => {
      const match = window.location.pathname.match(
        /\/dashboard\/documents\/([^/?#]+)/
      );
      if (match?.[1]) setChatIdState(match[1]);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);
  const setActiveChatId = React.useCallback((id: string) => {
    if (typeof window !== "undefined") {
      const nextUrl = `/dashboard/documents/${id}`;
      if (window.location.pathname !== nextUrl) {
        window.history.pushState(null, "", nextUrl);
      }
    }
    setChatIdState(id);
  }, []);

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
  const [documentChats, setDocumentChats] = React.useState<
    { id: string; title: string | null }[]
  >([]);
  const [docFileError, setDocFileError] = React.useState<string | null>(null);
  const [candidate, setCandidate] = React.useState<CollabAiChangeCandidate | null>(
    null
  );
  const [openTabs, setOpenTabs] = React.useState<string[]>([]);
  const [tabsHydrated, setTabsHydrated] = React.useState(false);
  const [tabTitles, setTabTitles] = React.useState<Record<string, string>>({});
  /** Preserved while `loading` toggles (Tabs unmount); avoid resetting to Document after new chat. */
  const [mobileMainTab, setMobileMainTab] = React.useState<"doc" | "chat">(
    "doc"
  );

  const contentDraftRef = React.useRef(content);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(OPEN_DOC_TABS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const storedTabs = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
      const deduped = Array.from(new Set([...storedTabs, chatId]));
      const nextTabs =
        deduped.length > MAX_OPEN_DOC_TABS
          ? deduped.slice(deduped.length - MAX_OPEN_DOC_TABS)
          : deduped;
      setOpenTabs(nextTabs);
    } catch {
      setOpenTabs([chatId]);
    } finally {
      setTabsHydrated(true);
    }
  }, [chatId]);

  React.useEffect(() => {
    if (!tabsHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(OPEN_DOC_TABS_STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs, tabsHydrated]);

  React.useEffect(() => {
    if (!openTabs.length) return;
    const supabase = getDocsSupabaseBrowserClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("id, documents!chats_document_id_fkey(title)")
        .in("id", openTabs);
      if (cancelled || error) return;

      const titles: Record<string, string> = {};
      for (const row of data ?? []) {
        const raw = row as {
          id?: string;
          documents?: { title?: string | null } | null;
        };
        if (!raw.id) continue;
        titles[raw.id] = raw.documents?.title?.trim() || "Untitled";
      }
      if (!cancelled) {
        setTabTitles(titles);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openTabs]);

  React.useEffect(() => {
    setTabTitles((prev) => ({
      ...prev,
      [chatId]: title.trim() || "Untitled",
    }));
  }, [chatId, title]);

  React.useEffect(() => {
    contentDraftRef.current = content;
  }, [content]);

  React.useEffect(() => {
    if (!documentId) return;
    setContextIds((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : prev
    );
  }, [documentId]);

  React.useEffect(() => {
    if (!documentId) {
      setDocumentChats([]);
      return;
    }
    const supabase = getDocsSupabaseBrowserClient();
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("id, title, created_at")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });
      if (cancelled || error) return;
      setDocumentChats(
        (data ?? [])
          .filter((row) => typeof row.id === "string")
          .map((row) => ({
            id: row.id as string,
            title: (row.title as string | null) ?? null,
          }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, chatId]);

  const editorFocused = React.useRef(false);
  const importFileInputRef = React.useRef<HTMLInputElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const documentIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);
  const documentChatsRef = React.useRef(documentChats);
  React.useEffect(() => {
    documentChatsRef.current = documentChats;
  }, [documentChats]);
  /**
   * Which chatId the current component state actually belongs to.
   * Used to prevent the "save to cache" effect from writing stale values
   * (belonging to the previous chatId) into the new chatId's cache entry
   * during the brief moment between `chatId` prop change and the load effect
   * populating state.
   */
  const loadedChatIdRef = React.useRef<string | null>(null);

  const refreshDoc = React.useCallback(async () => {
    if (!documentId) return;
    const supabase = getDocsSupabaseBrowserClient();
    const { data, error: qErr } = await supabase
      .from("documents")
      .select("id, title, content, created_at, updated_at, folder_id")
      .eq("id", documentId)
      .maybeSingle();
    if (qErr || !data) return;
    setTitle((data.title as string | null) ?? "");
    if (!editorFocused.current) {
      setContent((data.content as string | null) ?? "");
    }
  }, [documentId]);

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
      setLoadError(null);
      setRemoteDocStale(false);
      setCandidate(null);
      const cached = CHAT_STATE_CACHE.get(chatId);
      if (cached) {
        setDocumentId(cached.documentId);
        setTitle(cached.title);
        setContent(cached.content);
        setModelId(cached.modelId);
        setMessages(cached.messages);
        setOtherDocs(cached.otherDocs);
        loadedChatIdRef.current = chatId;
        setLoading(false);
        return;
      }
      const siblingDocId = documentIdRef.current;
      const isSiblingChat =
        !!siblingDocId &&
        documentChatsRef.current.some((c) => c.id === chatId);
      if (isSiblingChat) {
        try {
          const supabase = getDocsSupabaseBrowserClient();
          const { data: chatRow } = await supabase
            .from("chats")
            .select("id, default_model")
            .eq("id", chatId)
            .maybeSingle();
          if (cancelled) return;
          const nextModelId =
            chatRow?.default_model &&
            getCollabModel(chatRow.default_model as string)
              ? (chatRow.default_model as string)
              : COLLAB_DEFAULT_MODEL_ID;
          setModelId(nextModelId);
          await refreshMessages();
          loadedChatIdRef.current = chatId;
          setLoading(false);
        } catch (e) {
          if (!cancelled) {
            setLoadError(e instanceof Error ? e.message : "Load failed");
            setLoading(false);
          }
        }
        return;
      }
      const url = process.env.NEXT_PUBLIC_DOCS_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_DOCS_SUPABASE_ANON_KEY;
      if (!url || !key) {
        setLoadError("Missing NEXT_PUBLIC_DOCS_SUPABASE_* env.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = getDocsSupabaseBrowserClient();
        const { data: chatRow, error: qErr } = await supabase
          .from("chats")
          .select(
            `id, created_at, title, default_model, document_id,
             documents!chats_document_id_fkey(id, folder_id, title, content, created_at, updated_at, primary_chat_id)`
          )
          .eq("id", chatId)
          .maybeSingle();
        if (cancelled) return;
        if (qErr || !chatRow) {
          setLoadError(qErr?.message ?? "Chat not found");
          setLoading(false);
          return;
        }
        const rawDoc = chatRow.documents as
          | {
              id: string;
              folder_id?: string | null;
              title?: string | null;
              content?: string | null;
              created_at?: string;
              updated_at?: string;
            }
          | {
              id: string;
              folder_id?: string | null;
              title?: string | null;
              content?: string | null;
              created_at?: string;
              updated_at?: string;
            }[]
          | null;
        const docNested = Array.isArray(rawDoc) ? rawDoc[0] ?? null : rawDoc;
        if (!docNested?.id) {
          setLoadError("Document not found for this chat");
          setLoading(false);
          return;
        }
        setDocumentId(docNested.id);
        setTitle(docNested.title ?? "");
        setContent(docNested.content ?? "");
        const nextModelId =
          chatRow.default_model && getCollabModel(chatRow.default_model as string)
            ? (chatRow.default_model as string)
            : COLLAB_DEFAULT_MODEL_ID;
        setModelId(nextModelId);
        await refreshMessages();
        const { data: allDocs } = await supabase
          .from("documents")
          .select("id, title")
          .neq("id", docNested.id)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (!cancelled) {
          setOtherDocs(allDocs ?? []);
          CHAT_STATE_CACHE.set(chatId, {
            documentId: docNested.id,
            title: docNested.title ?? "",
            content: docNested.content ?? "",
            modelId: nextModelId,
            messages: [],
            otherDocs: allDocs ?? [],
          });
          loadedChatIdRef.current = chatId;
        }
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

  React.useEffect(() => {
    // Only persist to cache once the state actually reflects this chatId.
    // Otherwise we'd overwrite the new chat's cache with the previous chat's
    // state during the render right after a tab switch.
    if (loadedChatIdRef.current !== chatId) return;
    const existing = CHAT_STATE_CACHE.get(chatId);
    if (!existing && !documentId && !title && !content && messages.length === 0) {
      return;
    }
    CHAT_STATE_CACHE.set(chatId, {
      documentId,
      title,
      content,
      modelId,
      messages,
      otherDocs,
    });
  }, [chatId, content, documentId, messages, modelId, otherDocs, title]);

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

  const tabsToRender = openTabs.length > 0 ? openTabs : [chatId];

  const handleCloseTab = React.useCallback(
    (targetChatId: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((id) => id !== targetChatId);
        if (targetChatId === chatId) {
          const fallback = next[next.length - 1];
          if (fallback) {
            setActiveChatId(fallback);
          } else {
            router.replace("/dashboard/documents");
          }
        }
        return next;
      });
    },
    [chatId, router]
  );

  const handleDeleteChat = React.useCallback(
    async (targetChatId: string) => {
      if (!documentId) return;
      const current = documentChatsRef.current;
      if (current.length <= 1) {
        setLoadError("Cannot delete the only chat for this document.");
        return;
      }
      const fallback =
        current.find((c) => c.id !== targetChatId)?.id ?? null;
      // Optimistic UI.
      setDocumentChats((prev) => prev.filter((c) => c.id !== targetChatId));
      CHAT_STATE_CACHE.delete(targetChatId);
      if (targetChatId === chatId && fallback) {
        setActiveChatId(fallback);
      }
      try {
        const res = await fetch(
          `/api/collab-docs/chats/${targetChatId}`,
          { method: "DELETE" }
        );
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          nextActiveChatId?: string | null;
        };
        if (!res.ok) {
          setLoadError(json.error || `HTTP ${res.status}`);
          setDocumentChats(current);
          return;
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to delete chat");
        setDocumentChats(current);
      }
    },
    [chatId, documentId, setActiveChatId]
  );

  const handleNewChat = React.useCallback(async () => {
    if (!documentId) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/collab-docs/documents/${documentId}/chats`, {
        method: "POST",
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
      CHAT_STATE_CACHE.set(json.chatId, {
        documentId,
        title,
        content,
        modelId,
        messages: [],
        otherDocs,
      });
      setDocumentChats((prev) =>
        prev.some((c) => c.id === json.chatId)
          ? prev
          : [...prev, { id: json.chatId as string, title: null }]
      );
      setMobileMainTab("chat");
      setActiveChatId(json.chatId);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to create chat");
    }
  }, [documentId, router]);

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
      {candidate ? (
        <div className="space-y-2 rounded-md border border-primary/35 bg-primary/5 p-3">
          <p className="text-sm font-medium">
            Pending AI diff in main document ({candidate.model})
          </p>
          <div className="max-h-72 overflow-y-auto rounded-md border bg-background p-2 text-xs font-mono">
            {diffLines(
              candidate.base_document_content ?? "",
              candidate.candidate_document_content ?? ""
            ).map((part, idx) => {
              const lines = part.value.replace(/\n$/, "").split("\n");
              return (
                <div key={idx}>
                  {lines.map((line, lineIdx) => (
                    <div
                      key={`${idx}-${lineIdx}`}
                      className={cn(
                        "whitespace-pre-wrap break-all px-1 py-0.5",
                        part.added
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : part.removed
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            : "text-muted-foreground/80"
                      )}
                    >
                      {part.added ? "+" : part.removed ? "-" : " "} {line}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
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
      documentChats={documentChats}
      onSelectDocumentChat={(id) => {
        setMobileMainTab("chat");
        setActiveChatId(id);
      }}
      onNewDocumentChat={() => void handleNewChat()}
      onDeleteDocumentChat={(id) => void handleDeleteChat(id)}
      title={title}
      content={content}
      modelId={modelId}
      onModelIdChange={setModelId}
      persistModel={persistModel}
      messages={messages}
      otherDocs={otherDocs}
      contextIds={contextIds}
      setContextIds={setContextIds}
      refreshDoc={refreshDoc}
      candidate={candidate}
      onCandidateChange={setCandidate}
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
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {tabsToRender.map((id) => {
                const active = id === chatId;
                return (
                  <div
                    key={id}
                    className={cn(
                      "inline-flex items-center rounded-md border",
                      active ? "bg-accent" : "bg-background"
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-r-none px-3"
                      onClick={() => setActiveChatId(id)}
                    >
                      {tabTitles[id] ?? "Document"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-l-none"
                      onClick={() => handleCloseTab(id)}
                      aria-label="Close tab"
                      disabled={tabsToRender.length <= 1}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : loadError ? (
              <p className="text-destructive">{loadError}</p>
            ) : (
              <>
                <Tabs
                  value={mobileMainTab}
                  onValueChange={(v) =>
                    setMobileMainTab(v === "chat" ? "chat" : "doc")
                  }
                  className="lg:hidden flex flex-col flex-1 min-h-0"
                >
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

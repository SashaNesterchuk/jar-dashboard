"use client";

import * as React from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowUp,
  ChevronDown,
  FileText,
  Folder as FolderIcon,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  COLLAB_DEFAULT_MODEL_ID,
  COLLAB_MODELS,
  getCollabModel,
} from "@/lib/collab-ai-models";
import {
  estimateUsdRange,
  roughTokenEstimate,
} from "@/lib/collab-ai-estimate";
import { aiContextDocumentIds } from "@/lib/collab-doc-ai-context";
import { getDocsSupabaseBrowserClient } from "@/lib/docs-supabase";
import { throttle } from "@/lib/throttle";
import type {
  CollabAiChangeCandidate,
  CollabChatSkill,
  CollabDocumentFolder,
  CollabMentionItem,
  CollabMessage,
  CollabMessageMetadata,
} from "@/types/collab-docs";
import {
  CollabChatMentionPicker,
  type MentionPickerKeyboardApi,
} from "@/components/collab-doc-editor/collab-chat-mention-picker";
import { CollabDocDiffView } from "@/components/collab-doc-editor/collab-doc-diff-view";

export interface CollabDocChatPanelProps {
  chatId: string;
  documentId: string | null;
  documentChats: { id: string; title: string | null }[];
  onSelectDocumentChat: (chatId: string) => void;
  onNewDocumentChat: () => void | Promise<void>;
  onDeleteDocumentChat: (chatId: string) => void | Promise<void>;
  title: string;
  content: string;
  modelId: string;
  onModelIdChange: (id: string) => void;
  persistModel: (id: string) => void | Promise<void>;
  messages: CollabMessage[];
  otherDocs: { id: string; title: string | null }[];
  contextIds: string[];
  setContextIds: React.Dispatch<React.SetStateAction<string[]>>;
  refreshDoc: () => Promise<void>;
  candidate: CollabAiChangeCandidate | null;
  onCandidateChange: (next: CollabAiChangeCandidate | null) => void;
  flushPendingDocumentSave?: () => Promise<void>;
}

export const CollabDocChatPanel = React.memo(function CollabDocChatPanel({
  chatId,
  documentId,
  documentChats,
  onSelectDocumentChat,
  onNewDocumentChat,
  onDeleteDocumentChat,
  title,
  content,
  modelId,
  onModelIdChange,
  persistModel,
  messages,
  otherDocs,
  contextIds,
  setContextIds,
  refreshDoc,
  candidate,
  onCandidateChange,
  flushPendingDocumentSave,
}: CollabDocChatPanelProps) {
  const [chatInput, setChatInput] = React.useState("");
  const [aiPending, setAiPending] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [candidatePending, setCandidatePending] = React.useState<
    "apply" | "reject" | null
  >(null);

  const [contextFolderIds, setContextFolderIds] = React.useState<string[]>([]);
  const [skillId, setSkillId] = React.useState<string | null>(null);
  const [allFolders, setAllFolders] = React.useState<CollabDocumentFolder[]>([]);
  const [allSkills, setAllSkills] = React.useState<CollabChatSkill[]>([]);
  const [mentionsLoaded, setMentionsLoaded] = React.useState(false);

  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const mentionAnchorRef = React.useRef<number | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const pickerApiRef = React.useRef<MentionPickerKeyboardApi | null>(null);

  const ensureMentionsLoaded = React.useCallback(async () => {
    if (mentionsLoaded) return;
    setMentionsLoaded(true);
    const supabase = getDocsSupabaseBrowserClient();
    const [{ data: folderRows }, { data: skillRows }] = await Promise.all([
      supabase
        .from("document_folders")
        .select("id, name, parent_id, created_at, updated_at")
        .order("name", { ascending: true }),
      supabase
        .from("chat_skills")
        .select("id, slug, name, description, prompt, icon, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    setAllFolders((folderRows ?? []) as CollabDocumentFolder[]);
    setAllSkills((skillRows ?? []) as CollabChatSkill[]);
  }, [mentionsLoaded]);

  const folderMap = React.useMemo(() => {
    const map = new Map<string, CollabDocumentFolder>();
    for (const f of allFolders) map.set(f.id, f);
    return map;
  }, [allFolders]);

  const skillMap = React.useMemo(() => {
    const map = new Map<string, CollabChatSkill>();
    for (const s of allSkills) map.set(s.id, s);
    return map;
  }, [allSkills]);

  const [remotePeers, setRemotePeers] = React.useState<
    Record<string, { label: string; draft?: string }>
  >({});

  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = React.useRef<RealtimeChannel | null>(null);

  const clientId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    const k = "collab-doc-client-id";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      sessionStorage.setItem(k, v);
    }
    return v;
  }, []);

  React.useEffect(() => {
    if (!clientId || !chatId) return;
    const supabase = getDocsSupabaseBrowserClient();
    const ch = supabase
      .channel(`typing:${chatId}`, { config: { broadcast: { self: true } } })
      .on(
        "broadcast",
        { event: "typing" },
        (p: { payload?: Record<string, unknown> }) => {
          const pl = p.payload as
            | {
                clientId?: string;
                active?: boolean;
                label?: string;
                draftPreview?: string;
              }
            | undefined;
          if (!pl?.clientId || pl.clientId === clientId) return;
          const label = pl.label ?? "Someone";
          setRemotePeers((prev) => {
            const next = { ...prev };
            if (!pl.active) {
              delete next[pl.clientId!];
              return next;
            }
            const raw =
              typeof pl.draftPreview === "string" ? pl.draftPreview : "";
            const draft = raw.length > 0 ? raw.slice(0, 220) : undefined;
            next[pl.clientId!] = { label, draft };
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") typingChannelRef.current = ch;
      });

    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [chatId, clientId]);

  const sendTypingBroadcast = React.useCallback(
    (active: boolean, draft?: string) => {
      if (!clientId) return;
      void typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: {
          clientId,
          active,
          label: `…${clientId.slice(-4)}`,
          draftPreview: active ? (draft ?? "").slice(0, 220) : undefined,
        },
      });
    },
    [clientId]
  );

  const emitTypingDraft = React.useMemo(
    () =>
      throttle((draft: string) => {
        if (!clientId) return;
        void typingChannelRef.current?.send({
          type: "broadcast",
          event: "typing",
          payload: {
            clientId,
            active: true,
            label: `…${clientId.slice(-4)}`,
            draftPreview: draft.slice(0, 220),
          },
        });
      }, 280),
    [clientId]
  );

  React.useEffect(
    () => () => {
      emitTypingDraft.cancel();
    },
    [emitTypingDraft]
  );

  const onChatInputChange = React.useCallback(
    (v: string) => {
      setChatInput(v);
      if (!clientId) return;
      emitTypingDraft(v);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        emitTypingDraft.cancel();
        sendTypingBroadcast(false);
      }, 1200);
    },
    [emitTypingDraft, clientId, sendTypingBroadcast]
  );

  const [debouncedForCost, setDebouncedForCost] = React.useState({
    modelId: COLLAB_DEFAULT_MODEL_ID,
    title: "",
    content: "",
    messagesJoined: "",
    chatInput: "",
    contextLen: 0,
  });

  React.useEffect(() => {
    const messagesJoined = messages.map((m) => m.content ?? "").join("\n");
    const handle = window.setTimeout(() => {
      setDebouncedForCost({
        modelId,
        title,
        content,
        messagesJoined,
        chatInput,
        contextLen: contextIds.length,
      });
    }, 320);
    return () => clearTimeout(handle);
  }, [modelId, title, content, messages, chatInput, contextIds.length]);

  const costHint = React.useMemo(() => {
    const model = getCollabModel(debouncedForCost.modelId);
    if (!model) return null;
    const sysApprox = 800;
    const ctxNote = debouncedForCost.contextLen * 500;
    const inputTokens =
      sysApprox +
      roughTokenEstimate(
        debouncedForCost.title +
          debouncedForCost.content +
          debouncedForCost.messagesJoined +
          debouncedForCost.chatInput
      ) +
      ctxNote;
    const { low, high, mid } = estimateUsdRange({
      inputTokens,
      outputTokensLow: 400,
      outputTokensHigh: 2500,
      usdPer1MInput: model.usdPer1MInput,
      usdPer1MOutput: model.usdPer1MOutput,
    });
    return `~ $${mid.toFixed(3)} (range $${low.toFixed(3)}–$${high.toFixed(3)}, ±30% rough)`;
  }, [debouncedForCost]);

  const handleSend = React.useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !documentId || aiPending) return;
    setAiError(null);
    setAiPending(true);
    const supabase = getDocsSupabaseBrowserClient();
    const metadata: CollabMessageMetadata = {
      context_document_ids: aiContextDocumentIds(documentId, contextIds),
      context_folder_ids: contextFolderIds.length ? contextFolderIds : undefined,
      skill_id: skillId ?? undefined,
    };
    const { data: ins, error: insErr } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: text,
        metadata,
      })
      .select()
      .single();

    setChatInput("");
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    emitTypingDraft.cancel();
    sendTypingBroadcast(false);

    if (insErr || !ins) {
      setAiError(insErr?.message ?? "Failed to save message");
      setAiPending(false);
      return;
    }

    try {
      if (flushPendingDocumentSave) {
        try {
          await flushPendingDocumentSave();
        } catch (flushErr) {
          console.warn(
            "collab-docs: flush pending document save failed",
            flushErr
          );
        }
      }
      const res = await fetch("/api/collab-docs/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          modelId,
          userMessageId: ins.id,
          contextDocumentIds: contextIds.length ? contextIds : undefined,
          contextFolderIds: contextFolderIds.length
            ? contextFolderIds
            : undefined,
          skillId: skillId ?? undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        candidate?: CollabAiChangeCandidate;
        mode?: "answer_only" | string;
      };
      if (!res.ok) {
        setAiError(json.error || `HTTP ${res.status}`);
      } else if (json.mode === "answer_only") {
        // Assistant message is inserted server-side; realtime subscription
        // will pick it up. No candidate is created for answer_only.
      } else if (!json.candidate) {
        setAiError("No candidate in response");
      } else {
        onCandidateChange(json.candidate);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setAiPending(false);
    }
  }, [
    aiPending,
    chatInput,
    chatId,
    contextIds,
    contextFolderIds,
    skillId,
    documentId,
    emitTypingDraft,
    modelId,
    onCandidateChange,
    sendTypingBroadcast,
    flushPendingDocumentSave,
  ]);

  const handleCandidateAction = React.useCallback(
    async (action: "apply" | "reject") => {
      if (!candidate || candidatePending) return;
      setAiError(null);
      setCandidatePending(action);
      try {
        const res = await fetch(`/api/collab-docs/candidates/${candidate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setAiError(json.error || `HTTP ${res.status}`);
          return;
        }
        onCandidateChange(null);
        if (action === "apply") {
          await refreshDoc();
        }
      } catch (e) {
        setAiError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setCandidatePending(null);
      }
    },
    [candidate, candidatePending, onCandidateChange, refreshDoc]
  );


  const contextSummaryCount = documentId ? 1 + contextIds.length : contextIds.length;

  const findMentionContext = React.useCallback(
    (value: string, caret: number): { anchor: number; query: string } | null => {
      if (caret <= 0) return null;
      const before = value.slice(0, caret);
      const atIdx = before.lastIndexOf("@");
      if (atIdx < 0) return null;
      const prevChar = atIdx === 0 ? "" : before[atIdx - 1];
      if (prevChar && !/\s/.test(prevChar)) return null;
      const between = before.slice(atIdx + 1);
      if (/\s/.test(between)) return null;
      return { anchor: atIdx, query: between };
    },
    []
  );

  const syncMentionFromInput = React.useCallback(
    (value: string, caret: number) => {
      const ctx = findMentionContext(value, caret);
      if (!ctx) {
        if (mentionOpen) setMentionOpen(false);
        mentionAnchorRef.current = null;
        return;
      }
      mentionAnchorRef.current = ctx.anchor;
      setMentionQuery(ctx.query);
      if (!mentionOpen) setMentionOpen(true);
      void ensureMentionsLoaded();
    },
    [ensureMentionsLoaded, findMentionContext, mentionOpen]
  );

  const handleTextareaChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const caret = e.target.selectionStart ?? value.length;
      onChatInputChange(value);
      syncMentionFromInput(value, caret);
    },
    [onChatInputChange, syncMentionFromInput]
  );

  const handleSelectionSync = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    syncMentionFromInput(ta.value, ta.selectionStart ?? ta.value.length);
  }, [syncMentionFromInput]);

  const applyMention = React.useCallback(
    (item: CollabMentionItem) => {
      const anchor = mentionAnchorRef.current;
      if (anchor === null) {
        setMentionOpen(false);
        return;
      }
      const ta = textareaRef.current;
      const value = ta?.value ?? chatInput;
      const caret = ta?.selectionStart ?? value.length;
      const nextValue = value.slice(0, anchor) + value.slice(caret);
      onChatInputChange(nextValue);
      if (item.kind === "doc") {
        setContextIds((prev) =>
          prev.includes(item.id) ? prev : [...prev, item.id]
        );
      } else if (item.kind === "folder") {
        setContextFolderIds((prev) =>
          prev.includes(item.id) ? prev : [...prev, item.id]
        );
      } else if (item.kind === "skill") {
        setSkillId(item.skill.id);
      }
      setMentionOpen(false);
      setMentionQuery("");
      mentionAnchorRef.current = null;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const pos = anchor;
        el.setSelectionRange(pos, pos);
      });
    },
    [chatInput, onChatInputChange, setContextIds]
  );

  const handleTextareaKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          pickerApiRef.current?.moveDown();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          pickerApiRef.current?.moveUp();
          return;
        }
        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
          if (pickerApiRef.current?.commit()) {
            e.preventDefault();
            return;
          }
        }
        if (e.key === "Tab") {
          if (pickerApiRef.current?.commit()) {
            e.preventDefault();
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionOpen(false);
          return;
        }
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend, mentionOpen]
  );

  const removeContextDoc = React.useCallback(
    (id: string) => {
      setContextIds((prev) => prev.filter((x) => x !== id));
    },
    [setContextIds]
  );
  const removeContextFolder = React.useCallback((id: string) => {
    setContextFolderIds((prev) => prev.filter((x) => x !== id));
  }, []);
  const removeSkill = React.useCallback(() => {
    setSkillId(null);
  }, []);

  const hasAnyChips =
    contextIds.length > 0 ||
    contextFolderIds.length > 0 ||
    skillId !== null;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full max-h-[70vh] lg:max-h-[calc(100vh-10rem)]">
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 shrink-0 -mx-0.5 px-0.5">
        {documentChats.map((c, index) => {
          const label = (c.title?.trim() || `Chat ${index + 1}`).slice(0, 28);
          const active = c.id === chatId;
          const canDelete = documentChats.length > 1;
          return (
            <div
              key={c.id}
              className={cn(
                "group inline-flex h-8 shrink-0 items-center rounded-full text-xs",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-accent"
              )}
            >
              <button
                type="button"
                className="h-8 rounded-full pl-3 pr-2 text-xs outline-none"
                onClick={() => onSelectDocumentChat(c.id)}
              >
                {label}
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className={cn(
                    "mr-1 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background/60 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100",
                    active && "opacity-70"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDeleteDocumentChat(c.id);
                  }}
                  aria-label="Close chat"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0 rounded-full"
          disabled={!documentId}
          onClick={() => void onNewDocumentChat()}
          aria-label="New chat"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {Object.keys(remotePeers).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(remotePeers).map(([peerId, peer]) => (
            <div
              key={peerId}
              className="rounded-md border border-dashed p-2 text-xs bg-muted/20"
            >
              <div className="text-muted-foreground mb-1">
                {peer.label} typing…
              </div>
              {peer.draft ? (
                <pre className="whitespace-pre-wrap break-words text-foreground/85 max-h-28 overflow-y-auto rounded bg-muted/50 p-2 font-sans">
                  {peer.draft}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto rounded-md border p-2 space-y-3 bg-muted/30">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "text-sm rounded-md px-2 py-1.5",
              m.role === "user"
                ? "bg-background border ml-4"
                : "bg-background border mr-4 border-primary/20"
            )}
          >
            <div className="text-[10px] uppercase text-muted-foreground mb-0.5">
              {m.role === "assistant"
                ? "Assistant"
                : m.metadata?.note_only
                  ? "User · note"
                  : "User"}
              {m.model ? ` · ${m.model}` : ""}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.metadata &&
            Array.isArray(m.metadata.context_document_ids) &&
            m.metadata.context_document_ids.length > 0 ? (
              <div className="text-[10px] text-muted-foreground mt-1">
                Message context:{" "}
                {m.metadata.context_document_ids.length} document
                {m.metadata.context_document_ids.length === 1 ? "" : "s"}
              </div>
            ) : null}
            {m.usage?.completion_tokens != null ? (
              <div className="text-[10px] text-muted-foreground mt-1">
                Tokens in/out: {m.usage.prompt_tokens ?? "?"} /{" "}
                {m.usage.completion_tokens}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {aiError ? (
        <p className="text-xs text-destructive">{aiError}</p>
      ) : null}

      {candidate ? (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">AI proposal ({candidate.model})</p>
              <p className="text-[11px] text-muted-foreground">
                Review diff before applying changes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={candidatePending !== null}
                onClick={() => void handleCandidateAction("reject")}
              >
                {candidatePending === "reject" ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={candidatePending !== null}
                onClick={() => void handleCandidateAction("apply")}
              >
                {candidatePending === "apply" ? "Applying..." : "Apply"}
              </Button>
            </div>
          </div>
          <p className="text-xs whitespace-pre-wrap">{candidate.chat_reply}</p>
          <CollabDocDiffView
            base={candidate.base_document_content ?? ""}
            candidate={candidate.candidate_document_content ?? ""}
            maxHeightClassName="max-h-56"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {hasAnyChips ? (
          <div className="flex flex-wrap gap-1.5">
            {contextIds.map((id) => {
              const doc = otherDocs.find((d) => d.id === id);
              const label = (doc?.title?.trim() || "Untitled").slice(0, 40);
              return (
                <span
                  key={`doc:${id}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2 pr-1 text-[11px]"
                >
                  <FileText className="size-3 opacity-70" />
                  <span className="truncate max-w-56">{label}</span>
                  <button
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => removeContextDoc(id)}
                    aria-label="Remove document from context"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {contextFolderIds.map((id) => {
              const folder = folderMap.get(id);
              const label = folder?.name ?? "Folder";
              return (
                <span
                  key={`folder:${id}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2 pr-1 text-[11px]"
                >
                  <FolderIcon className="size-3 opacity-70" />
                  <span className="truncate max-w-56">{label}</span>
                  <button
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => removeContextFolder(id)}
                    aria-label="Remove folder from context"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {skillId ? (
              <span className="inline-flex items-center gap-1 rounded-full border bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] text-primary">
                <Sparkles className="size-3" />
                <span className="truncate max-w-56">
                  {skillMap.get(skillId)?.name ?? "Skill"}
                </span>
                <button
                  type="button"
                  className="inline-flex size-4 items-center justify-center rounded-full text-primary/70 hover:bg-background hover:text-primary"
                  onClick={removeSkill}
                  aria-label="Remove skill"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="relative rounded-lg border bg-background shadow-sm">
          <CollabChatMentionPicker
            open={mentionOpen}
            query={mentionQuery}
            docs={otherDocs}
            folders={allFolders}
            skills={allSkills}
            excludeDocIds={contextIds}
            excludeFolderIds={contextFolderIds}
            selectedSkillId={skillId}
            onSelect={applyMention}
            onClose={() => setMentionOpen(false)}
            navigateRef={pickerApiRef}
          />
          <Textarea
            ref={textareaRef}
            value={chatInput}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            onSelect={handleSelectionSync}
            onClick={handleSelectionSync}
            onBlur={() => {
              window.setTimeout(() => setMentionOpen(false), 120);
            }}
            placeholder="Ask or instruct the model… Type @ to add context. (⌘/Ctrl+Enter to send)"
            className="min-h-[88px] resize-y border-0 pr-14 pb-3 text-sm shadow-none focus-visible:ring-0"
            disabled={aiPending}
          />
          <Button
            type="button"
            size="icon"
            variant={chatInput.trim() && !aiPending ? "default" : "secondary"}
            className="absolute bottom-2 right-2 size-9 rounded-full"
            disabled={aiPending || !chatInput.trim() || !documentId}
            onClick={() => void handleSend()}
            aria-label="Send to AI"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          AI may propose edits to the document. Review before applying.
        </p>

        <div className="flex flex-wrap gap-2 items-stretch">
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <Label htmlFor="collab-chat-model" className="text-xs text-muted-foreground">
              Model
            </Label>
            <Select
              value={modelId}
              onValueChange={(v) => {
                onModelIdChange(v);
                void persistModel(v);
              }}
            >
              <SelectTrigger id="collab-chat-model" size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLLAB_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Context</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-between font-normal"
                  disabled={!documentId && otherDocs.length === 0}
                >
                  <span className="truncate">
                    {documentId
                      ? `Current + ${contextIds.length} extra`
                      : `${contextIds.length} attached`}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72" align="start">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  This document ({contextSummaryCount} sources for AI)
                </DropdownMenuLabel>
                {documentId ? (
                  <DropdownMenuItem
                    disabled
                    className="flex cursor-default flex-col items-start gap-0.5 py-2 opacity-100"
                  >
                    <span className="truncate font-medium">
                      {title.trim() || "Untitled"}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      Always included
                    </span>
                  </DropdownMenuItem>
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Loading document…
                  </p>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">
                  Additional documents
                </DropdownMenuLabel>
                {otherDocs.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    No other documents.
                  </p>
                ) : (
                  otherDocs.map((d) => (
                    <DropdownMenuCheckboxItem
                      key={d.id}
                      checked={contextIds.includes(d.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(c) => {
                        setContextIds((prev) =>
                          c === true
                            ? [...prev, d.id]
                            : prev.filter((x) => x !== d.id)
                        );
                      }}
                    >
                      <span className="truncate">{d.title || "Untitled"}</span>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {costHint ? (
          <p className="text-[10px] text-muted-foreground leading-snug">
            Est. cost: {costHint}
          </p>
        ) : null}
      </div>
    </div>
  );
});

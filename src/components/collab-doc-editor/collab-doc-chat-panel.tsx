"use client";

import * as React from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import type { CollabMessage, CollabMessageMetadata } from "@/types/collab-docs";
import { cn } from "@/lib/utils";

export interface CollabDocChatPanelProps {
  chatId: string;
  documentId: string | null;
  title: string;
  content: string;
  modelId: string;
  onModelIdChange: (id: string) => void;
  persistModel: (id: string) => void | Promise<void>;
  messages: CollabMessage[];
  otherDocs: { id: string; title: string | null }[];
  contextIds: string[];
  setContextIds: React.Dispatch<React.SetStateAction<string[]>>;
  contextOpen: boolean;
  setContextOpen: React.Dispatch<React.SetStateAction<boolean>>;
  refreshDoc: () => Promise<void>;
}

export const CollabDocChatPanel = React.memo(function CollabDocChatPanel({
  chatId,
  documentId,
  title,
  content,
  modelId,
  onModelIdChange,
  persistModel,
  messages,
  otherDocs,
  contextIds,
  setContextIds,
  contextOpen,
  setContextOpen,
  refreshDoc,
}: CollabDocChatPanelProps) {
  const [chatInput, setChatInput] = React.useState("");
  const [aiPending, setAiPending] = React.useState(false);
  const [notePending, setNotePending] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

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
      const res = await fetch("/api/collab-docs/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          modelId,
          userMessageId: ins.id,
          contextDocumentIds: contextIds.length ? contextIds : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAiError(json.error || `HTTP ${res.status}`);
      } else {
        await refreshDoc();
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
    documentId,
    emitTypingDraft,
    modelId,
    refreshDoc,
    sendTypingBroadcast,
  ]);

  const handleSendNote = React.useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !documentId || notePending || aiPending) return;
    setNotePending(true);
    setAiError(null);
    const supabase = getDocsSupabaseBrowserClient();
    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: text,
      metadata: { note_only: true },
    });
    setChatInput("");
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    emitTypingDraft.cancel();
    sendTypingBroadcast(false);
    if (error) setAiError(error.message);
    setNotePending(false);
  }, [
    aiPending,
    chatId,
    chatInput,
    documentId,
    emitTypingDraft,
    notePending,
    sendTypingBroadcast,
  ]);

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full max-h-[70vh] lg:max-h-[calc(100vh-10rem)]">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setContextOpen((o) => !o)}
        >
          Context (
          {documentId ? 1 + contextIds.length : contextIds.length})
        </Button>
      </div>
      {contextOpen ? (
        <div className="rounded-md border p-2 max-h-48 overflow-y-auto space-y-3 text-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              This session
            </p>
            {documentId ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                <Checkbox checked disabled className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {title.trim() || "Untitled"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Current document · always included for AI
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Loading document…</p>
            )}
          </div>
          <div className="space-y-1 border-t pt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Additional context
            </p>
            {otherDocs.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No other documents to attach.
              </p>
            ) : (
              otherDocs.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={contextIds.includes(d.id)}
                    onCheckedChange={(c) => {
                      setContextIds((prev) =>
                        c === true
                          ? [...prev, d.id]
                          : prev.filter((x) => x !== d.id)
                      );
                    }}
                  />
                  <span className="truncate">{d.title || "Untitled"}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}

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

      <div className="space-y-1">
        <Textarea
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Message the team or ask the model to edit the document…"
          className="min-h-[72px] text-sm"
          disabled={aiPending || notePending}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={notePending || aiPending || !chatInput.trim()}
            onClick={() => void handleSendNote()}
          >
            {notePending ? "Sending…" : "Send note"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={aiPending || notePending || !chatInput.trim()}
            onClick={() => void handleSend()}
          >
            {aiPending ? "Waiting for AI…" : "Send to AI"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Note: visible to everyone; AI: runs the model and may rewrite the
          document.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <Select
            value={modelId}
            onValueChange={(v) => {
              onModelIdChange(v);
              void persistModel(v);
            }}
          >
            <SelectTrigger size="sm" className="w-[200px]">
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
        {costHint ? (
          <p className="text-xs text-muted-foreground max-w-[220px] leading-snug">
            Est. cost: {costHint}
          </p>
        ) : null}
      </div>
    </div>
  );
});

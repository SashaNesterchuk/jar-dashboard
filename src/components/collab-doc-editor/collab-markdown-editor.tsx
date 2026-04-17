"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import remarkGfm from "remark-gfm";
import {
  getCommands,
  heading1,
  heading2,
  heading3,
  type ICommand,
} from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

/** Default toolbar nests H1–H6 in one dropdown; expose H1–H3 as separate buttons. */
function getCollabMdCommands(): ICommand[] {
  return getCommands().flatMap((cmd) => {
    if (
      cmd.keyCommand === "group" &&
      "groupName" in cmd &&
      (cmd as ICommand & { groupName?: string }).groupName === "title"
    ) {
      return [heading1, heading2, heading3];
    }
    return [cmd];
  });
}

export type CollabMdViewMode = "edit" | "live" | "preview";

export interface CollabMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPersistRequest?: (latestValue: string) => void;
  onEditorFocusChange?: (focused: boolean) => void;
  className?: string;
}

export function CollabMarkdownEditor({
  value,
  onChange,
  onPersistRequest,
  onEditorFocusChange,
  className,
}: CollabMarkdownEditorProps) {
  const [mode, setMode] = React.useState<CollabMdViewMode>("edit");
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState(480);
  const [colorMode, setColorMode] = React.useState<"light" | "dark">("light");
  const [draft, setDraft] = React.useState(value);
  const isFocusedRef = React.useRef(false);
  const latestDraftRef = React.useRef(value);
  const syncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const sync = () => {
      setColorMode(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, []);

  React.useEffect(() => {
    if (isFocusedRef.current) return;
    latestDraftRef.current = value;
    setDraft(value);
  }, [value]);

  React.useEffect(
    () => () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    },
    []
  );

  const syncDraftToParent = React.useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    onChange(latestDraftRef.current);
  }, [onChange]);

  React.useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setEditorHeight(Math.max(360, Math.floor(r.height)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const preview =
    mode === "preview" ? "preview" : mode === "live" ? "live" : "edit";

  const commands = React.useMemo(() => getCollabMdCommands(), []);

  return (
    <div
      className={cn(
        "collab-md-workspace flex min-h-0 flex-1 flex-col gap-2",
        className
      )}
      data-color-mode={colorMode}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => {
            if (v) setMode(v as CollabMdViewMode);
          }}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="edit" aria-label="Edit source">
            Edit
          </ToggleGroupItem>
          <ToggleGroupItem value="live" aria-label="Split view">
            Split
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" aria-label="Preview">
            Preview
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">
          H1–H3, lists, bold, code, links…
        </span>
      </div>

      <div
        ref={hostRef}
        className="flex min-h-[min(50vh,520px)] flex-1 flex-col lg:min-h-[calc(100vh-16rem)]"
        onFocusCapture={() => {
          isFocusedRef.current = true;
          onEditorFocusChange?.(true);
        }}
        onBlurCapture={(e) => {
          const next = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(next)) {
            isFocusedRef.current = false;
            syncDraftToParent();
            onEditorFocusChange?.(false);
            onPersistRequest?.(latestDraftRef.current);
          }
        }}
      >
        <MDEditor
          commands={commands}
          value={draft}
          onChange={(v) => {
            const next = v ?? "";
            latestDraftRef.current = next;
            setDraft(next);
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(syncDraftToParent, 160);
          }}
          preview={preview}
          visibleDragbar={mode === "live"}
          height={editorHeight}
          minHeight={editorHeight}
          highlightEnable={false}
          tabSize={2}
          previewOptions={{
            remarkPlugins: [remarkGfm],
          }}
          textareaProps={{
            placeholder: "Write Markdown…",
            spellCheck: false,
            style: {
              minHeight: editorHeight,
              height: editorHeight,
            },
          }}
          className={cn(
            "!overflow-hidden !rounded-md !border !border-border !shadow-none",
            "[&_.w-md-editor-toolbar]:border-b [&_.w-md-editor-toolbar]:border-border",
            "[&_.w-md-editor-content]:min-h-[280px]"
          )}
        />
      </div>
    </div>
  );
}

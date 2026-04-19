"use client";

import * as React from "react";
import { FileText, Folder as FolderIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CollabChatSkill,
  CollabDocumentFolder,
  CollabMentionItem,
} from "@/types/collab-docs";

export type MentionPickerDoc = { id: string; title: string | null };

export interface CollabChatMentionPickerProps {
  open: boolean;
  query: string;
  docs: MentionPickerDoc[];
  folders: CollabDocumentFolder[];
  skills: CollabChatSkill[];
  excludeDocIds: string[];
  excludeFolderIds: string[];
  /** If set, that skill is already attached — hide it from the Skills section. */
  selectedSkillId: string | null;
  onSelect: (item: CollabMentionItem) => void;
  onClose: () => void;
  /** Called by keyboard navigation handler attached by parent. */
  navigateRef?: React.MutableRefObject<MentionPickerKeyboardApi | null>;
}

export interface MentionPickerKeyboardApi {
  moveUp: () => void;
  moveDown: () => void;
  commit: () => boolean;
}

type FlatEntry =
  | {
      kind: "doc";
      doc: MentionPickerDoc;
      section: "Files";
    }
  | {
      kind: "folder";
      folder: CollabDocumentFolder;
      path: string;
      section: "Folders";
    }
  | {
      kind: "skill";
      skill: CollabChatSkill;
      section: "Skills";
    };

function buildFolderPathMap(
  folders: CollabDocumentFolder[]
): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const cache = new Map<string, string>();
  const visit = (id: string, guard: Set<string>): string => {
    if (cache.has(id)) return cache.get(id)!;
    if (guard.has(id)) return "";
    guard.add(id);
    const node = byId.get(id);
    if (!node) return "";
    if (!node.parent_id) {
      cache.set(id, node.name);
      return node.name;
    }
    const parentPath = visit(node.parent_id, guard);
    const full = parentPath ? `${parentPath} / ${node.name}` : node.name;
    cache.set(id, full);
    return full;
  };
  for (const f of folders) visit(f.id, new Set());
  return cache;
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return value.toLowerCase().includes(q);
}

export const CollabChatMentionPicker = React.forwardRef<
  HTMLDivElement,
  CollabChatMentionPickerProps
>(function CollabChatMentionPicker(props, ref) {
  const {
    open,
    query,
    docs,
    folders,
    skills,
    excludeDocIds,
    excludeFolderIds,
    selectedSkillId,
    onSelect,
    onClose,
    navigateRef,
  } = props;

  const folderPaths = React.useMemo(
    () => buildFolderPathMap(folders),
    [folders]
  );

  const entries = React.useMemo<FlatEntry[]>(() => {
    if (!open) return [];
    const q = query.trim();

    const docEntries: FlatEntry[] = docs
      .filter((d) => !excludeDocIds.includes(d.id))
      .filter((d) => matchesQuery(d.title ?? "Untitled", q))
      .slice(0, 8)
      .map((doc) => ({ kind: "doc", doc, section: "Files" }));

    const folderEntries: FlatEntry[] = folders
      .filter((f) => !excludeFolderIds.includes(f.id))
      .filter((f) =>
        matchesQuery(folderPaths.get(f.id) ?? f.name, q)
      )
      .slice(0, 8)
      .map((folder) => ({
        kind: "folder",
        folder,
        path: folderPaths.get(folder.id) ?? folder.name,
        section: "Folders",
      }));

    const skillEntries: FlatEntry[] = skills
      .filter((s) => s.id !== selectedSkillId)
      .filter(
        (s) =>
          matchesQuery(s.name, q) ||
          matchesQuery(s.description ?? "", q) ||
          matchesQuery(s.slug, q)
      )
      .slice(0, 8)
      .map((skill) => ({ kind: "skill", skill, section: "Skills" }));

    return [...docEntries, ...folderEntries, ...skillEntries];
  }, [
    open,
    query,
    docs,
    folders,
    skills,
    excludeDocIds,
    excludeFolderIds,
    selectedSkillId,
    folderPaths,
  ]);

  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  React.useEffect(() => {
    if (activeIndex >= entries.length) {
      setActiveIndex(entries.length === 0 ? 0 : entries.length - 1);
    }
  }, [activeIndex, entries.length]);

  const emit = React.useCallback(
    (entry: FlatEntry) => {
      if (entry.kind === "doc") {
        onSelect({
          kind: "doc",
          id: entry.doc.id,
          title: entry.doc.title ?? null,
        });
      } else if (entry.kind === "folder") {
        onSelect({
          kind: "folder",
          id: entry.folder.id,
          name: entry.folder.name,
          path: entry.path,
        });
      } else {
        onSelect({ kind: "skill", skill: entry.skill });
      }
    },
    [onSelect]
  );

  React.useEffect(() => {
    if (!navigateRef) return;
    navigateRef.current = {
      moveUp: () =>
        setActiveIndex((i) =>
          entries.length === 0 ? 0 : (i - 1 + entries.length) % entries.length
        ),
      moveDown: () =>
        setActiveIndex((i) =>
          entries.length === 0 ? 0 : (i + 1) % entries.length
        ),
      commit: () => {
        const e = entries[activeIndex];
        if (!e) return false;
        emit(e);
        return true;
      },
    };
    return () => {
      if (navigateRef.current) navigateRef.current = null;
    };
  }, [navigateRef, entries, activeIndex, emit]);

  if (!open) return null;

  const grouped: Record<"Files" | "Folders" | "Skills", FlatEntry[]> = {
    Files: [],
    Folders: [],
    Skills: [],
  };
  entries.forEach((entry) => grouped[entry.section].push(entry));

  return (
    <div
      ref={ref}
      role="listbox"
      className="absolute bottom-full left-0 right-0 z-40 mb-2 max-h-80 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md"
    >
      {entries.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          No matches for &ldquo;{query || "@"}&rdquo;
        </p>
      ) : (
        (["Files", "Folders", "Skills"] as const).map((section) => {
          const bucket = grouped[section];
          if (bucket.length === 0) return null;
          return (
            <div key={section} className="py-1">
              <div className="px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {section}
              </div>
              {bucket.map((entry) => {
                const flatIdx = entries.indexOf(entry);
                const active = flatIdx === activeIndex;
                const Icon =
                  entry.kind === "doc"
                    ? FileText
                    : entry.kind === "folder"
                      ? FolderIcon
                      : Sparkles;
                const primary =
                  entry.kind === "doc"
                    ? entry.doc.title?.trim() || "Untitled"
                    : entry.kind === "folder"
                      ? entry.folder.name
                      : entry.skill.name;
                const secondary =
                  entry.kind === "doc"
                    ? "Document"
                    : entry.kind === "folder"
                      ? entry.path
                      : entry.skill.description ?? entry.skill.slug;
                return (
                  <button
                    key={`${entry.kind}:${
                      entry.kind === "doc"
                        ? entry.doc.id
                        : entry.kind === "folder"
                          ? entry.folder.id
                          : entry.skill.id
                    }`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(flatIdx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      emit(entry);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                      active && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{primary}</span>
                      {secondary ? (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {secondary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onClick={onClose}
      />
    </div>
  );
});

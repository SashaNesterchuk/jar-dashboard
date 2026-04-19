"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Folder, FolderPlus, Trash2, Upload } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { normalizeDocumentListRow } from "@/lib/collab-docs-normalize";
import {
  COLLAB_IMPORT_MAX_BYTES,
  safeDownloadBasename,
} from "@/lib/collab-doc-files";
import { getDocsSupabaseBrowserClient } from "@/lib/docs-supabase";
import type {
  CollabDocumentFolder,
  CollabDocumentListRow,
} from "@/types/collab-docs";

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

function openChatForRow(row: CollabDocumentListRow): string | null {
  return row.primary_chat_id ?? row.chats?.id ?? null;
}

type AdminChatSkill = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  prompt: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function DocumentsPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<CollabDocumentListRow[]>([]);
  const [folders, setFolders] = React.useState<CollabDocumentFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = React.useState<string>("all");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null);
  const [movingDocId, setMovingDocId] = React.useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = React.useState(false);
  const [deletingFolderId, setDeletingFolderId] = React.useState<string | null>(
    null
  );
  const [listFileError, setListFileError] = React.useState<string | null>(null);
  const [configOk, setConfigOk] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const [mainTab, setMainTab] = React.useState<"documents" | "skills">("documents");
  const [adminSkills, setAdminSkills] = React.useState<AdminChatSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = React.useState(false);
  const [skillsError, setSkillsError] = React.useState<string | null>(null);
  const [skillSheetOpen, setSkillSheetOpen] = React.useState(false);
  const [editingSkillId, setEditingSkillId] = React.useState<string | null>(null);
  const [skillFormName, setSkillFormName] = React.useState("");
  const [skillFormDescription, setSkillFormDescription] = React.useState("");
  const [skillFormPrompt, setSkillFormPrompt] = React.useState("");
  const [skillFormIcon, setSkillFormIcon] = React.useState("");
  const [skillFormSort, setSkillFormSort] = React.useState(0);
  const [skillFormActive, setSkillFormActive] = React.useState(true);
  const [skillSaving, setSkillSaving] = React.useState(false);

  const refreshSkills = React.useCallback(async () => {
    setSkillsError(null);
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/collab-docs/skills");
      const json = (await res.json()) as {
        skills?: AdminChatSkill[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setAdminSkills(json.skills ?? []);
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : "Failed to load skills");
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (mainTab === "skills" && configOk) void refreshSkills();
  }, [mainTab, configOk, refreshSkills]);

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
      const [{ data: docsData, error: docsError }, { data: foldersData, error: foldersError }] =
        await Promise.all([
          supabase
            .from("documents")
            .select(
              "id, primary_chat_id, folder_id, title, content, updated_at, created_at, chats!chats_document_id_fkey(id, title, created_at, default_model)"
            )
            .order("updated_at", { ascending: false }),
          supabase
            .from("document_folders")
            .select("id, name, parent_id, created_at, updated_at")
            .order("name", { ascending: true }),
        ]);

      if (docsError) {
        setLoadError(docsError.message);
        return;
      }
      if (foldersError) {
        if (foldersError.code === "PGRST205") {
          setFolders([]);
          setLoadError(
            "Folders are not available yet. Apply the latest Supabase migration to enable them."
          );
        } else {
          setLoadError(foldersError.message);
          return;
        }
      }

      const list = Array.isArray(docsData)
        ? docsData.map((r) =>
            normalizeDocumentListRow(r as Record<string, unknown>)
          )
        : [];
      const folderList = Array.isArray(foldersData)
        ? (foldersData as CollabDocumentFolder[])
        : [];

      if (
        selectedFolderId !== "all" &&
        selectedFolderId !== "unfiled" &&
        !folderList.some((folder) => folder.id === selectedFolderId)
      ) {
        setSelectedFolderId("all");
      }

      setFolders(folderList);
      setRows(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, [configOk, selectedFolderId]);

  const filteredRows = React.useMemo(() => {
    if (selectedFolderId === "all") {
      return rows.filter((row) => !row.folder_id);
    }
    if (selectedFolderId === "unfiled") {
      return rows.filter((row) => !row.folder_id);
    }
    return rows.filter((row) => row.folder_id === selectedFolderId);
  }, [rows, selectedFolderId]);

  const visibleFolders = React.useMemo(() => {
    if (selectedFolderId === "all") {
      return folders.filter((folder) => !folder.parent_id);
    }
    if (selectedFolderId === "unfiled") return [];
    return folders.filter((folder) => folder.parent_id === selectedFolderId);
  }, [folders, selectedFolderId]);

  const folderById = React.useMemo(() => {
    return new Map(folders.map((folder) => [folder.id, folder]));
  }, [folders]);

  const breadcrumbs = React.useMemo(() => {
    const root = [{ id: "all", label: "Documents" }];
    if (selectedFolderId === "all" || selectedFolderId === "unfiled") {
      return root;
    }

    const chain: Array<{ id: string; label: string }> = [];
    const seen = new Set<string>();
    let currentId: string | null = selectedFolderId;
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const folder = folderById.get(currentId);
      if (!folder) break;
      chain.unshift({ id: folder.id, label: folder.name });
      currentId = folder.parent_id;
    }

    return [...root, ...chain];
  }, [folderById, selectedFolderId]);

  const handleCreateFolder = React.useCallback(async () => {
    const input = window.prompt("Folder name");
    const name = input?.trim();
    if (!name) return;

    setCreatingFolder(true);
    setLoadError(null);
    setListFileError(null);
    try {
      const supabase = getDocsSupabaseBrowserClient();
      const parentId =
        selectedFolderId === "all" || selectedFolderId === "unfiled"
          ? null
          : selectedFolderId;
      const { error } = await supabase
        .from("document_folders")
        .insert({ name, parent_id: parentId });
      if (error) {
        setLoadError(error.message);
        return;
      }
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }, [refresh, selectedFolderId]);

  const handleDeleteFolder = React.useCallback(
    async (folder: CollabDocumentFolder) => {
      const usedBy = rows.filter((row) => row.folder_id === folder.id).length;
      const ok = window.confirm(
        usedBy > 0
          ? `Delete folder "${folder.name}"? ${usedBy} document(s) will become unfiled.`
          : `Delete folder "${folder.name}"?`
      );
      if (!ok) return;

      setDeletingFolderId(folder.id);
      setLoadError(null);
      setListFileError(null);
      try {
        const supabase = getDocsSupabaseBrowserClient();
        const { error } = await supabase
          .from("document_folders")
          .delete()
          .eq("id", folder.id);
        if (error) {
          setLoadError(error.message);
          return;
        }
        if (selectedFolderId === folder.id) {
          setSelectedFolderId("all");
        }
        await refresh();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to delete folder");
      } finally {
        setDeletingFolderId(null);
      }
    },
    [refresh, rows, selectedFolderId]
  );

  const handleMoveDocument = React.useCallback(
    async (row: CollabDocumentListRow, targetFolderId: string) => {
      const nextFolderId = targetFolderId === "unfiled" ? null : targetFolderId;
      if (row.folder_id === nextFolderId) return;

      setMovingDocId(row.id);
      setLoadError(null);
      setListFileError(null);
      try {
        const supabase = getDocsSupabaseBrowserClient();
        const { error } = await supabase
          .from("documents")
          .update({ folder_id: nextFolderId })
          .eq("id", row.id);
        if (error) {
          setLoadError(error.message);
          return;
        }
        await refresh();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to move document");
      } finally {
        setMovingDocId(null);
      }
    },
    [refresh]
  );

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

  const handleDeleteRow = React.useCallback(
    async (row: CollabDocumentListRow) => {
      setLoadError(null);
      setListFileError(null);
      const label = row.title?.trim() || "Untitled";
      const ok = window.confirm(
        `Delete document "${label}"? This will remove all chats and messages for this document.`
      );
      if (!ok) return;

      setDeletingDocId(row.id);
      try {
        const res = await fetch(`/api/collab-docs/documents/${row.id}`, {
          method: "DELETE",
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          setLoadError(json.error || `HTTP ${res.status}`);
          return;
        }
        await refresh();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to delete document");
      } finally {
        setDeletingDocId(null);
      }
    },
    [refresh]
  );

  const openNewSkill = React.useCallback(() => {
    setEditingSkillId(null);
    setSkillFormName("");
    setSkillFormDescription("");
    setSkillFormPrompt("");
    setSkillFormIcon("");
    setSkillFormSort(0);
    setSkillFormActive(true);
    setSkillsError(null);
    setSkillSheetOpen(true);
  }, []);

  const openEditSkill = React.useCallback((s: AdminChatSkill) => {
    setEditingSkillId(s.id);
    setSkillFormName(s.name);
    setSkillFormDescription(s.description ?? "");
    setSkillFormPrompt(s.prompt);
    setSkillFormIcon(s.icon ?? "");
    setSkillFormSort(s.sort_order);
    setSkillFormActive(s.is_active);
    setSkillsError(null);
    setSkillSheetOpen(true);
  }, []);

  const saveSkill = React.useCallback(async () => {
    const name = skillFormName.trim();
    const prompt = skillFormPrompt.trim();
    if (!name || !prompt) return;
    setSkillSaving(true);
    setSkillsError(null);
    try {
      const body = {
        name,
        description: skillFormDescription.trim() || null,
        prompt,
        icon: skillFormIcon.trim() || null,
        sort_order: skillFormSort,
        is_active: skillFormActive,
      };
      if (editingSkillId) {
        const res = await fetch(`/api/collab-docs/skills/${editingSkillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      } else {
        const res = await fetch("/api/collab-docs/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      }
      setSkillSheetOpen(false);
      await refreshSkills();
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSkillSaving(false);
    }
  }, [
    editingSkillId,
    skillFormActive,
    skillFormDescription,
    skillFormIcon,
    skillFormName,
    skillFormPrompt,
    skillFormSort,
    refreshSkills,
  ]);

  const handleDeactivateSkill = React.useCallback(
    async (s: AdminChatSkill) => {
      const ok = window.confirm(
        `Deactivate "${s.name}"? It will disappear from the @ picker in chat. You can re-activate it from Edit.`
      );
      if (!ok) return;
      setSkillsError(null);
      try {
        const res = await fetch(`/api/collab-docs/skills/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: false }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        await refreshSkills();
      } catch (e) {
        setSkillsError(e instanceof Error ? e.message : "Deactivate failed");
      }
    },
    [refreshSkills]
  );

  const handleDeleteSkillPermanently = React.useCallback(
    async (s: AdminChatSkill) => {
      const ok = window.confirm(
        `Permanently delete "${s.name}"? This cannot be undone. Old chat messages may still reference this skill id.`
      );
      if (!ok) return;
      setSkillsError(null);
      try {
        const res = await fetch(`/api/collab-docs/skills/${s.id}`, {
          method: "DELETE",
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (skillSheetOpen && editingSkillId === s.id) {
          setSkillSheetOpen(false);
        }
        await refreshSkills();
      } catch (e) {
        setSkillsError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [editingSkillId, refreshSkills, skillSheetOpen]
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
              <div className="px-4 lg:px-6">
                <Tabs
                  value={mainTab}
                  onValueChange={(v) =>
                    setMainTab(v === "skills" ? "skills" : "documents")
                  }
                  className="w-full gap-4"
                >
                  <TabsList>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="skills">Skills</TabsTrigger>
                  </TabsList>
                  <TabsContent value="documents" className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Documents</h1>
                  <p className="text-muted-foreground max-w-2xl">
                    Open a session, start blank, or import a Markdown file. Export
                    any row as <code className="text-xs">.md</code> and organize
                    docs into folders.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!configOk || creatingFolder}
                    onClick={() => void handleCreateFolder()}
                  >
                    <FolderPlus className="size-4" />
                    {creatingFolder ? "Creating folder..." : "New folder"}
                  </Button>
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

              <div className="px-4 lg:px-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.id}>
                    {index > 0 ? <span>/</span> : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={index === breadcrumbs.length - 1 ? "secondary" : "ghost"}
                      onClick={() => setSelectedFolderId(crumb.id)}
                      disabled={index === breadcrumbs.length - 1}
                    >
                      {crumb.label}
                    </Button>
                  </React.Fragment>
                ))}
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
                    {filteredRows.length === 0 && visibleFolders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground text-center py-8"
                        >
                          {!configOk
                            ? "Configure Supabase env vars to load documents."
                            : selectedFolderId === "all"
                              ? "No documents yet. Create one with New document."
                              : "This folder is empty."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {visibleFolders.map((folder) => (
                          <TableRow
                            key={folder.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedFolderId(folder.id)}
                          >
                            <TableCell className="font-medium">
                              <div className="inline-flex items-center gap-2">
                                <Folder className="size-4 text-muted-foreground" />
                                <span>{folder.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(folder.updated_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  disabled={deletingFolderId === folder.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDeleteFolder(folder);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  {deletingFolderId === folder.id
                                    ? "Deleting…"
                                    : "Delete"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredRows.map((row) => {
                          const openChat = openChatForRow(row);
                          return (
                        <TableRow
                          key={row.id}
                          className={openChat ? "cursor-pointer" : "cursor-default"}
                          onClick={() => {
                            if (openChat) {
                              router.push(`/dashboard/documents/${openChat}`);
                            }
                          }}
                        >
                          <TableCell className="font-medium">
                            {openChat ? (
                              <Link
                                href={`/dashboard/documents/${openChat}`}
                                className="hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {row.title?.trim() || "Untitled"}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {row.title?.trim() || "Untitled"}
                              </span>
                            )}
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleExportRow(row);
                                }}
                                disabled={
                                  deletingDocId === row.id ||
                                  movingDocId === row.id
                                }
                              >
                                <Download className="size-4" />
                                Export
                              </Button>
                              <Select
                                value={row.folder_id ?? "unfiled"}
                                onValueChange={(value) =>
                                  void handleMoveDocument(row, value)
                                }
                                disabled={
                                  deletingDocId === row.id ||
                                  movingDocId === row.id
                                }
                              >
                                <SelectTrigger
                                  className="h-8 w-[160px]"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <SelectValue placeholder="Move to folder" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unfiled">Unfiled</SelectItem>
                                  {folders.map((folder) => (
                                    <SelectItem key={folder.id} value={folder.id}>
                                      {folder.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  href={
                                    openChat
                                      ? `/dashboard/documents/${openChat}`
                                      : "#"
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  aria-disabled={!openChat}
                                  className={
                                    !openChat ? "pointer-events-none opacity-50" : ""
                                  }
                                >
                                  Open
                                </Link>
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={
                                  deletingDocId === row.id ||
                                  movingDocId === row.id
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteRow(row);
                                }}
                              >
                                <Trash2 className="size-4" />
                                {deletingDocId === row.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                          );
                        })}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
                  </TabsContent>

                  <TabsContent value="skills" className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">Chat skills</h1>
                        <p className="text-muted-foreground max-w-2xl">
                          Preset personas for the document chat. Users attach one skill
                          per message via @. Deactivate hides a skill from the picker;
                          Delete removes it permanently.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={openNewSkill}
                        disabled={!configOk}
                      >
                        New skill
                      </Button>
                    </div>
                    {skillsError ? (
                      <div className="text-sm text-destructive">{skillsError}</div>
                    ) : null}
                    {skillsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead>Sort</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminSkills.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center text-muted-foreground py-8"
                              >
                                No skills yet. Create one for the @ picker.
                              </TableCell>
                            </TableRow>
                          ) : (
                            adminSkills.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="text-muted-foreground text-sm font-mono">
                                  {s.slug}
                                </TableCell>
                                <TableCell>{s.is_active ? "Yes" : "No"}</TableCell>
                                <TableCell>{s.sort_order}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(s.updated_at)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditSkill(s)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={!s.is_active}
                                      onClick={() => void handleDeactivateSkill(s)}
                                    >
                                      Deactivate
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => void handleDeleteSkillPermanently(s)}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </Tabs>

                <Sheet open={skillSheetOpen} onOpenChange={setSkillSheetOpen}>
                  <SheetContent className="overflow-y-auto sm:max-w-lg">
                    <SheetHeader>
                      <SheetTitle>
                        {editingSkillId ? "Edit skill" : "New skill"}
                      </SheetTitle>
                      <SheetDescription>
                        Name and prompt are required. Prompt is injected into the AI
                        system context; description helps intent routing.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="skill-name">Name</Label>
                        <Input
                          id="skill-name"
                          value={skillFormName}
                          onChange={(e) => setSkillFormName(e.target.value)}
                          placeholder="Product manager"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="skill-desc">Description</Label>
                        <Input
                          id="skill-desc"
                          value={skillFormDescription}
                          onChange={(e) => setSkillFormDescription(e.target.value)}
                          placeholder="Short hint for routing"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="skill-prompt">Prompt</Label>
                        <Textarea
                          id="skill-prompt"
                          className="min-h-[140px]"
                          value={skillFormPrompt}
                          onChange={(e) => setSkillFormPrompt(e.target.value)}
                          placeholder="You are an experienced product manager…"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="skill-icon">Icon (optional)</Label>
                        <Input
                          id="skill-icon"
                          value={skillFormIcon}
                          onChange={(e) => setSkillFormIcon(e.target.value)}
                          placeholder="briefcase"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="skill-sort">Sort order</Label>
                        <Input
                          id="skill-sort"
                          type="number"
                          value={skillFormSort}
                          onChange={(e) =>
                            setSkillFormSort(Number(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="skill-active"
                          checked={skillFormActive}
                          onCheckedChange={(c) => setSkillFormActive(c === true)}
                        />
                        <Label htmlFor="skill-active" className="font-normal">
                          Active (visible in @ picker)
                        </Label>
                      </div>
                    </div>
                    <SheetFooter className="gap-2 sm:justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSkillSheetOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          skillSaving ||
                          !skillFormName.trim() ||
                          !skillFormPrompt.trim()
                        }
                        onClick={() => void saveSkill()}
                      >
                        {skillSaving ? "Saving…" : "Save"}
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

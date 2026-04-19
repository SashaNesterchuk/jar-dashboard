"use client";

import * as React from "react";
import { diffLines, diffWordsWithSpace } from "diff";
import type { ChangeObject } from "diff";
import { cn } from "@/lib/utils";

export type CollabDocDiffMode = "unified" | "split";

export interface CollabDocDiffViewProps {
  base: string;
  candidate: string;
  className?: string;
  maxHeightClassName?: string;
  unifiedContext?: number;
  defaultMode?: CollabDocDiffMode;
}

type DiffRow =
  | {
      kind: "context";
      oldNumber: number;
      newNumber: number;
      content: string;
    }
  | {
      kind: "add";
      newNumber: number;
      content: string;
      wordParts?: ChangeObject<string>[];
    }
  | {
      kind: "remove";
      oldNumber: number;
      content: string;
      wordParts?: ChangeObject<string>[];
    }
  | {
      kind: "gap";
      skipped: number;
    };

type SplitRow =
  | {
      kind: "context";
      oldNumber: number;
      newNumber: number;
      content: string;
    }
  | {
      kind: "change";
      left: {
        number: number;
        content: string;
        wordParts?: ChangeObject<string>[];
      } | null;
      right: {
        number: number;
        content: string;
        wordParts?: ChangeObject<string>[];
      } | null;
    }
  | {
      kind: "gap";
      skipped: number;
    };

function splitIntoLines(value: string): string[] {
  const trimmed = value.endsWith("\n") ? value.slice(0, -1) : value;
  if (trimmed === "") return [];
  return trimmed.split("\n");
}

function buildRows(
  base: string,
  candidate: string,
  unifiedContext: number
): DiffRow[] {
  const parts = diffLines(base ?? "", candidate ?? "");

  type Segment =
    | { kind: "context"; lines: string[] }
    | { kind: "add"; lines: string[] }
    | { kind: "remove"; lines: string[] };

  const segments: Segment[] = [];
  for (const part of parts) {
    const lines = splitIntoLines(part.value);
    if (lines.length === 0) continue;
    if (part.added) {
      segments.push({ kind: "add", lines });
    } else if (part.removed) {
      segments.push({ kind: "remove", lines });
    } else {
      segments.push({ kind: "context", lines });
    }
  }

  const rows: DiffRow[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.kind === "context") {
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      const total = seg.lines.length;
      const keepTop = isFirst ? 0 : unifiedContext;
      const keepBottom = isLast ? 0 : unifiedContext;

      if (total <= keepTop + keepBottom) {
        for (const line of seg.lines) {
          rows.push({
            kind: "context",
            oldNumber: oldLine++,
            newNumber: newLine++,
            content: line,
          });
        }
      } else {
        for (let k = 0; k < keepTop; k++) {
          rows.push({
            kind: "context",
            oldNumber: oldLine++,
            newNumber: newLine++,
            content: seg.lines[k],
          });
        }

        const skipped = total - keepTop - keepBottom;
        if (skipped > 0) {
          rows.push({ kind: "gap", skipped });
          oldLine += skipped;
          newLine += skipped;
        }

        for (let k = total - keepBottom; k < total; k++) {
          rows.push({
            kind: "context",
            oldNumber: oldLine++,
            newNumber: newLine++,
            content: seg.lines[k],
          });
        }
      }
      continue;
    }

    if (seg.kind === "remove") {
      const next = segments[i + 1];
      if (next && next.kind === "add") {
        const pairCount = Math.min(seg.lines.length, next.lines.length);
        for (let k = 0; k < pairCount; k++) {
          const wordParts = diffWordsWithSpace(seg.lines[k], next.lines[k]);
          rows.push({
            kind: "remove",
            oldNumber: oldLine++,
            content: seg.lines[k],
            wordParts,
          });
          rows.push({
            kind: "add",
            newNumber: newLine++,
            content: next.lines[k],
            wordParts,
          });
        }
        for (let k = pairCount; k < seg.lines.length; k++) {
          rows.push({
            kind: "remove",
            oldNumber: oldLine++,
            content: seg.lines[k],
          });
        }
        for (let k = pairCount; k < next.lines.length; k++) {
          rows.push({
            kind: "add",
            newNumber: newLine++,
            content: next.lines[k],
          });
        }
        i++;
        continue;
      }

      for (const line of seg.lines) {
        rows.push({
          kind: "remove",
          oldNumber: oldLine++,
          content: line,
        });
      }
      continue;
    }

    for (const line of seg.lines) {
      rows.push({
        kind: "add",
        newNumber: newLine++,
        content: line,
      });
    }
  }

  return rows;
}

function toSplitRows(rows: DiffRow[]): SplitRow[] {
  const out: SplitRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.kind === "context") {
      out.push({
        kind: "context",
        oldNumber: row.oldNumber,
        newNumber: row.newNumber,
        content: row.content,
      });
      i++;
      continue;
    }
    if (row.kind === "gap") {
      out.push({ kind: "gap", skipped: row.skipped });
      i++;
      continue;
    }

    // Collect a block of consecutive changes (remove/add) and pair them up.
    const removes: Array<{
      number: number;
      content: string;
      wordParts?: ChangeObject<string>[];
    }> = [];
    const adds: Array<{
      number: number;
      content: string;
      wordParts?: ChangeObject<string>[];
    }> = [];
    while (i < rows.length && (rows[i].kind === "remove" || rows[i].kind === "add")) {
      const r = rows[i];
      if (r.kind === "remove") {
        removes.push({
          number: r.oldNumber,
          content: r.content,
          wordParts: r.wordParts,
        });
      } else if (r.kind === "add") {
        adds.push({
          number: r.newNumber,
          content: r.content,
          wordParts: r.wordParts,
        });
      }
      i++;
    }

    const pairCount = Math.max(removes.length, adds.length);
    for (let k = 0; k < pairCount; k++) {
      out.push({
        kind: "change",
        left: removes[k] ?? null,
        right: adds[k] ?? null,
      });
    }
  }
  return out;
}

function renderLineContent(
  kind: "add" | "remove",
  content: string,
  wordParts?: ChangeObject<string>[]
): React.ReactNode {
  if (!wordParts || wordParts.length === 0) {
    return content === "" ? <span>&nbsp;</span> : content;
  }

  const nodes: React.ReactNode[] = [];
  wordParts.forEach((part, idx) => {
    if (kind === "add") {
      if (part.removed) return;
      if (part.added) {
        nodes.push(
          <span
            key={idx}
            className="rounded-sm bg-emerald-500/35 text-emerald-950 dark:text-emerald-50"
          >
            {part.value}
          </span>
        );
      } else {
        nodes.push(<span key={idx}>{part.value}</span>);
      }
    } else {
      if (part.added) return;
      if (part.removed) {
        nodes.push(
          <span
            key={idx}
            className="rounded-sm bg-rose-500/35 text-rose-950 dark:text-rose-50"
          >
            {part.value}
          </span>
        );
      } else {
        nodes.push(<span key={idx}>{part.value}</span>);
      }
    }
  });

  return nodes.length ? nodes : content === "" ? <span>&nbsp;</span> : content;
}

const gutterClass =
  "select-none text-right tabular-nums text-[11px] leading-5 text-muted-foreground/70 px-2 border-r border-border/60 w-13";

function UnifiedView({ rows }: { rows: DiffRow[] }) {
  return (
    <table className="min-w-full border-collapse">
      <tbody>
        {rows.map((row, idx) => {
          if (row.kind === "gap") {
            return (
              <tr
                key={`gap-${idx}`}
                className="bg-muted/40 text-muted-foreground"
              >
                <td colSpan={4} className="px-3 py-1 text-center text-[11px]">
                  … {row.skipped} unchanged{" "}
                  {row.skipped === 1 ? "line" : "lines"} …
                </td>
              </tr>
            );
          }

          const bg =
            row.kind === "add"
              ? "bg-emerald-500/10"
              : row.kind === "remove"
                ? "bg-rose-500/10"
                : "";
          const sign =
            row.kind === "add" ? "+" : row.kind === "remove" ? "-" : " ";
          const signColor =
            row.kind === "add"
              ? "text-emerald-600 dark:text-emerald-400"
              : row.kind === "remove"
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground/60";
          const textColor =
            row.kind === "add"
              ? "text-emerald-900 dark:text-emerald-100"
              : row.kind === "remove"
                ? "text-rose-900 dark:text-rose-100"
                : "text-foreground/80";

          const oldNum =
            row.kind === "context" || row.kind === "remove"
              ? row.oldNumber
              : "";
          const newNum =
            row.kind === "context" || row.kind === "add"
              ? row.newNumber
              : "";

          return (
            <tr key={idx} className={cn(bg)}>
              <td className={gutterClass}>{oldNum}</td>
              <td className={gutterClass}>{newNum}</td>
              <td
                className={cn(
                  "select-none px-2 text-center w-6",
                  signColor
                )}
              >
                {sign}
              </td>
              <td
                className={cn(
                  "whitespace-pre px-2 py-0 align-top",
                  textColor
                )}
              >
                {row.kind === "context"
                  ? row.content === ""
                    ? "\u00A0"
                    : row.content
                  : renderLineContent(row.kind, row.content, row.wordParts)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SplitView({ rows }: { rows: SplitRow[] }) {
  return (
    <table className="min-w-full border-collapse table-fixed">
      <colgroup>
        <col className="w-13" />
        <col style={{ width: "50%" }} />
        <col className="w-13" />
        <col style={{ width: "50%" }} />
      </colgroup>
      <tbody>
        {rows.map((row, idx) => {
          if (row.kind === "gap") {
            return (
              <tr
                key={`gap-${idx}`}
                className="bg-muted/40 text-muted-foreground"
              >
                <td colSpan={4} className="px-3 py-1 text-center text-[11px]">
                  … {row.skipped} unchanged{" "}
                  {row.skipped === 1 ? "line" : "lines"} …
                </td>
              </tr>
            );
          }

          if (row.kind === "context") {
            return (
              <tr key={idx}>
                <td className={gutterClass}>{row.oldNumber}</td>
                <td className="whitespace-pre px-2 py-0 align-top text-foreground/80 border-r border-border/60">
                  {row.content === "" ? "\u00A0" : row.content}
                </td>
                <td className={gutterClass}>{row.newNumber}</td>
                <td className="whitespace-pre px-2 py-0 align-top text-foreground/80">
                  {row.content === "" ? "\u00A0" : row.content}
                </td>
              </tr>
            );
          }

          const leftBg = row.left ? "bg-rose-500/10" : "bg-muted/30";
          const rightBg = row.right ? "bg-emerald-500/10" : "bg-muted/30";
          const leftText = row.left
            ? "text-rose-900 dark:text-rose-100"
            : "text-muted-foreground/60";
          const rightText = row.right
            ? "text-emerald-900 dark:text-emerald-100"
            : "text-muted-foreground/60";

          return (
            <tr key={idx}>
              <td className={cn(gutterClass, leftBg)}>
                {row.left ? row.left.number : ""}
              </td>
              <td
                className={cn(
                  "whitespace-pre px-2 py-0 align-top border-r border-border/60",
                  leftBg,
                  leftText
                )}
              >
                {row.left
                  ? renderLineContent(
                      "remove",
                      row.left.content,
                      row.left.wordParts
                    )
                  : "\u00A0"}
              </td>
              <td className={cn(gutterClass, rightBg)}>
                {row.right ? row.right.number : ""}
              </td>
              <td
                className={cn(
                  "whitespace-pre px-2 py-0 align-top",
                  rightBg,
                  rightText
                )}
              >
                {row.right
                  ? renderLineContent(
                      "add",
                      row.right.content,
                      row.right.wordParts
                    )
                  : "\u00A0"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function CollabDocDiffView({
  base,
  candidate,
  className,
  maxHeightClassName = "max-h-72",
  unifiedContext = 3,
  defaultMode = "unified",
}: CollabDocDiffViewProps) {
  const [mode, setMode] = React.useState<CollabDocDiffMode>(defaultMode);

  const rows = React.useMemo(
    () => buildRows(base ?? "", candidate ?? "", unifiedContext),
    [base, candidate, unifiedContext]
  );

  const splitRows = React.useMemo(
    () => (mode === "split" ? toSplitRows(rows) : []),
    [mode, rows]
  );

  const { addedCount, removedCount } = React.useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const r of rows) {
      if (r.kind === "add") added++;
      else if (r.kind === "remove") removed++;
    }
    return { addedCount: added, removedCount: removed };
  }, [rows]);

  const isEmpty = rows.length === 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">
            +{addedCount}
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            −{removedCount}
          </span>
        </div>
        <div className="inline-flex rounded-md border bg-background p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("unified")}
            className={cn(
              "rounded-sm px-2 py-0.5 transition-colors",
              mode === "unified"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setMode("split")}
            className={cn(
              "rounded-sm px-2 py-0.5 transition-colors",
              mode === "split"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Split
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
          No changes.
        </div>
      ) : (
        <div
          className={cn(
            "overflow-auto rounded-md border bg-background font-mono text-xs leading-5",
            maxHeightClassName
          )}
        >
          {mode === "unified" ? (
            <UnifiedView rows={rows} />
          ) : (
            <SplitView rows={splitRows} />
          )}
        </div>
      )}
    </div>
  );
}

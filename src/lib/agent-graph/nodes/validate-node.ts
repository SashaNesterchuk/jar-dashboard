import type {
  AgentRunState,
  AgentValidation,
} from "@/lib/agent-graph/state";
import type { CollabDocumentChunk } from "@/types/collab-docs";

type PatchPayload = {
  chat_reply: string;
  patches: Array<{ target_chunk_index: number; new_text: string }>;
};

type ValidateNodeInput = {
  state: AgentRunState;
  payload: PatchPayload;
  userText: string;
  editableChunks: CollabDocumentChunk[];
  currentDocChunks: CollabDocumentChunk[];
  requireMultiDocCoverage: boolean;
};

type ValidateNodeOutput = {
  state: AgentRunState;
  validation: AgentValidation;
};

function textLooksLikeLanguage(text: string, lang: string): boolean {
  if (!text.trim() || lang === "unknown") return true;
  if (lang === "en") return /[a-zA-Z]/.test(text);
  if (lang === "ru") return /[а-яА-Я]/.test(text);
  if (lang === "uk") return /[іїєґІЇЄҐ]|[а-яА-Я]/.test(text);
  return true;
}

function hasSyntheticMarkers(text: string): boolean {
  return /chunk_index\s*:|^#{1,6}\s*chunk_index/i.test(text);
}

export function runValidateNode(input: ValidateNodeInput): ValidateNodeOutput {
  const editableIndexes = new Set(input.editableChunks.map((c) => c.chunk_index));
  const allIndexes = new Set(input.currentDocChunks.map((c) => c.chunk_index));
  const byIndex = new Map<number, CollabDocumentChunk>();
  for (const c of input.currentDocChunks) byIndex.set(c.chunk_index, c);
  for (const c of input.editableChunks) {
    if (!byIndex.has(c.chunk_index)) byIndex.set(c.chunk_index, c);
  }
  const issues: string[] = [];
  const totalChars = input.currentDocChunks.reduce(
    (sum, c) => sum + (c.content ?? "").trim().length,
    0
  );
  const isSmallOrEmptyDoc = totalChars <= 200;

  const structuralOk =
    input.payload.patches.length > 0 &&
    input.payload.patches.every((p) => Number.isInteger(p.target_chunk_index));
  if (!structuralOk) {
    issues.push("invalid-patch-structure");
  }

  const languageText = [
    input.payload.chat_reply,
    ...input.payload.patches.map((p) => p.new_text),
  ].join("\n");
  const languageOk = textLooksLikeLanguage(languageText, input.state.language);
  if (!languageOk) {
    issues.push("language-mismatch");
  }

  const safetyOk = !input.payload.patches.some((p) => hasSyntheticMarkers(p.new_text));
  if (!safetyOk) {
    issues.push("synthetic-markers-detected");
  }

  const targetCoverageOk =
    isSmallOrEmptyDoc ||
    input.payload.patches.every((p) => {
      return allIndexes.has(p.target_chunk_index) || editableIndexes.has(p.target_chunk_index);
    });
  if (!targetCoverageOk) {
    issues.push("patch-target-outside-scope");
  }

  const uniqueDocs = new Set(input.state.selected_sources.map((s) => s.document_id));
  const sourceCoverageOk = input.requireMultiDocCoverage ? uniqueDocs.size >= 2 : true;
  if (!sourceCoverageOk) {
    issues.push("insufficient-multi-doc-coverage");
  }

  const patchText = input.payload.patches.map((p) => p.new_text).join("\n");
  const userText = input.userText.toLowerCase();
  if (/(хелло|hello)/i.test(userText) && !/(хелло|hello)/i.test(patchText)) {
    issues.push("instruction-mismatch:hello-missing");
  }
  if (/(test diff|тест diff)/i.test(userText) && !/(test diff|тест diff)/i.test(patchText)) {
    issues.push("instruction-mismatch:test-diff-missing");
  }
  if (
    /(важное по двум документам|важливе по двом документам)/i.test(userText) &&
    !/(важное по двум документам|важливе по двом документам)/i.test(patchText)
  ) {
    issues.push("instruction-mismatch:section-heading-missing");
  }

  const changedAny = input.payload.patches.some((p) => {
    const target = byIndex.get(p.target_chunk_index);
    if (!target) return false;
    return target.content.trim() !== (p.new_text ?? "").trim();
  });
  if (!changedAny && input.state.intent !== "answer_only") {
    issues.push("no-op-change");
  }

  const validation: AgentValidation = {
    structural_ok: structuralOk,
    language_ok: languageOk,
    safety_ok: safetyOk,
    source_coverage_ok: sourceCoverageOk,
    issues,
  };

  return {
    state: {
      ...input.state,
      stage: "validate",
      validation,
    },
    validation,
  };
}

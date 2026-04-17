import {
  agentResearchStateSchema,
  pushAgentDiagnostic,
  type AgentResearchState,
  type AgentRunState,
} from "@/lib/agent-graph/state";

export type ResearchUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type InvokeResearchModel = (args: {
  systemPrompt: string;
  turns: ChatTurn[];
  maxTokens: number;
}) => Promise<{ text: string; usage: ResearchUsage }>;

type RunResearchNodeInput = {
  state: AgentRunState;
  userText: string;
  language: string;
  currentDocMarkdown: string;
  contextBlocks: string;
  maxTokens: number;
  invokeModel: InvokeResearchModel;
};

type RunResearchNodeOutput = {
  state: AgentRunState;
  research: AgentResearchState;
  usage: ResearchUsage;
  raw: string;
};

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return fence ? fence[1].trim() : t;
}

function buildResearchSystemPrompt(language: string): string {
  return `You are a senior research assistant working over user-provided markdown sources.

Goals:
- Extract concrete facts, numbers, quotations, contradictions, and notable signals.
- Stay faithful to the provided material. Do NOT invent facts.
- Keep each item short and verifiable against the sources.
- Respond in the user's language (detected: ${language}).

Output contract:
- Return ONLY a single JSON object. No markdown fences, no commentary.
- Shape (all keys required; arrays may be empty when nothing is found):
{
  "topic": string,
  "language": string,
  "key_facts": string[],
  "numbers": string[],
  "quotes": Array<{"text": string, "source_hint"?: string}>,
  "contradictions": string[],
  "source_refs": Array<{"doc_hint": string, "excerpt": string}>,
  "notes": string
}

Guidance:
- "key_facts" should be the most decision-relevant statements.
- "numbers" are metrics, percentages, dates, counts pulled verbatim.
- "quotes" are short verbatim excerpts (<= 200 chars each).
- "contradictions" capture tensions across sources when multiple are present.
- "source_refs" must point back to which source (by title or hint) supports the claims.
- "notes" is a single short paragraph with your cross-source observations.`;
}

function buildResearchUserTurn(params: {
  userText: string;
  currentDocMarkdown: string;
  contextBlocks: string;
}): string {
  const ctx = params.contextBlocks.trim() || "(no additional context documents)";
  const current = params.currentDocMarkdown.trim() || "(current document is empty)";
  return `User request:
${params.userText}

Current document (source):
---
${current}
---

Additional context documents:
---
${ctx}
---

Produce the research JSON now.`;
}

export async function runResearchNode(
  input: RunResearchNodeInput
): Promise<RunResearchNodeOutput> {
  let state = pushAgentDiagnostic(input.state, {
    stage: "research",
    code: "research.invoke",
    message: "Invoking research step for multi-source synthesis.",
  });

  const systemPrompt = buildResearchSystemPrompt(input.language);
  const userTurn = buildResearchUserTurn({
    userText: input.userText,
    currentDocMarkdown: input.currentDocMarkdown,
    contextBlocks: input.contextBlocks,
  });

  const llm = await input.invokeModel({
    systemPrompt,
    turns: [{ role: "user", content: userTurn }],
    maxTokens: input.maxTokens,
  });

  const rawStripped = stripJsonFences(llm.text);
  const parsed = JSON.parse(rawStripped);
  const research = agentResearchStateSchema.parse(parsed);

  state = {
    ...state,
    stage: "research",
    research,
  };
  state = pushAgentDiagnostic(state, {
    stage: "research",
    code: "research.ready",
    message: `key_facts=${research.key_facts.length}; numbers=${research.numbers.length}; quotes=${research.quotes.length}; source_refs=${research.source_refs.length}`,
  });

  return {
    state,
    research,
    usage: llm.usage,
    raw: llm.text,
  };
}

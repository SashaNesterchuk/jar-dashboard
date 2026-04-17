import {
  agentCritiqueSchema,
  pushAgentDiagnostic,
  type AgentCritique,
  type AgentIntent,
  type AgentResearchState,
  type AgentRunState,
} from "@/lib/agent-graph/state";

export type CritiqueUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type InvokeCritiqueModel = (args: {
  systemPrompt: string;
  turns: ChatTurn[];
  maxTokens: number;
}) => Promise<{ text: string; usage: CritiqueUsage }>;

type RunCritiqueNodeInput = {
  state: AgentRunState;
  userText: string;
  language: string;
  intent: AgentIntent;
  draftMarkdown: string;
  research?: AgentResearchState;
  maxTokens: number;
  invokeModel: InvokeCritiqueModel;
};

type RunCritiqueNodeOutput = {
  state: AgentRunState;
  critique: AgentCritique;
  usage: CritiqueUsage;
  raw: string;
};

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return fence ? fence[1].trim() : t;
}

function buildCritiqueSystemPrompt(language: string): string {
  return `You are a strict but fair editor evaluating a draft markdown document.

Evaluation criteria (judge using these qualitatively; do NOT count items mechanically):
1. Coverage: does the draft fully address what the user asked for?
2. Source use: when multiple sources are provided, are insights drawn from more than one, or is one source dominating without reason?
3. Concreteness: are there specific facts, numbers, dates, quotes — or is it generic boilerplate?
4. Insight depth: does the draft provide conclusions, tensions, or prioritized next steps — or just restate the sources?
5. Structure and coherence: does the structure fit the content, without forced templates or filler sections?
6. Language match: is the draft written in the user's language (hint: ${language})?
7. Honesty: does it avoid inventing facts not present in the research?

Output contract:
- Return ONLY a single JSON object. No markdown fences, no commentary.
- Shape:
{
  "quality_score": number,   // 0..1 overall quality
  "language_ok": boolean,    // true if draft is in the user's language
  "weaknesses": string[],    // short, specific, actionable items (empty if nothing meaningful)
  "coverage_notes": string,  // one short paragraph about source coverage and depth
  "summary": string          // one short sentence overall verdict
}

Guidance:
- Be concise. Each weakness should be a single actionable sentence (<= 200 chars).
- If quality is high, still include any real weaknesses, but keep the list short.
- Do NOT rewrite the document. Do NOT propose replacement text. Only critique.`;
}

function buildCritiqueUserTurn(params: {
  userText: string;
  intent: AgentIntent;
  draftMarkdown: string;
  research?: AgentResearchState;
}): string {
  const researchBlock = params.research
    ? `Research (authoritative material the draft should be grounded in):\n${JSON.stringify(params.research, null, 2)}\n`
    : "Research: (not available)\n";
  return `User request:
${params.userText}

Intent: ${params.intent}

${researchBlock}
Draft markdown to evaluate:
---
${params.draftMarkdown}
---

Produce the critique JSON now.`;
}

export async function runCritiqueNode(
  input: RunCritiqueNodeInput
): Promise<RunCritiqueNodeOutput> {
  let state = pushAgentDiagnostic(input.state, {
    stage: "critique",
    code: "critique.invoke",
    message: "Invoking self-critique step on draft.",
  });

  const systemPrompt = buildCritiqueSystemPrompt(input.language);
  const userTurn = buildCritiqueUserTurn({
    userText: input.userText,
    intent: input.intent,
    draftMarkdown: input.draftMarkdown,
    research: input.research,
  });

  const llm = await input.invokeModel({
    systemPrompt,
    turns: [{ role: "user", content: userTurn }],
    maxTokens: input.maxTokens,
  });

  const rawStripped = stripJsonFences(llm.text);
  const parsed = JSON.parse(rawStripped);
  const critique = agentCritiqueSchema.parse(parsed);

  state = {
    ...state,
    stage: "critique",
    critique,
  };
  state = pushAgentDiagnostic(state, {
    stage: "critique",
    code: "critique.ready",
    message: `score=${critique.quality_score.toFixed(2)}; weaknesses=${critique.weaknesses.length}; language_ok=${critique.language_ok}`,
  });

  return {
    state,
    critique,
    usage: llm.usage,
    raw: llm.text,
  };
}

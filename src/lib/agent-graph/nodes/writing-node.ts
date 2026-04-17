import {
  agentWritingOutputSchema,
  pushAgentDiagnostic,
  type AgentIntent,
  type AgentResearchState,
  type AgentRunState,
  type AgentWritingOutput,
} from "@/lib/agent-graph/state";

export type WritingUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type InvokeWritingModel = (args: {
  systemPrompt: string;
  turns: ChatTurn[];
  maxTokens: number;
}) => Promise<{ text: string; usage: WritingUsage }>;

type RunWritingNodeInput = {
  state: AgentRunState;
  userText: string;
  language: string;
  intent: AgentIntent;
  depth: "brief" | "normal" | "deep";
  research: AgentResearchState;
  existingDocMarkdown: string;
  maxTokens: number;
  invokeModel: InvokeWritingModel;
};

type RunWritingNodeOutput = {
  state: AgentRunState;
  writing: AgentWritingOutput;
  usage: WritingUsage;
  raw: string;
};

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return fence ? fence[1].trim() : t;
}

function intentInstructions(intent: AgentIntent): string {
  switch (intent) {
    case "compare":
      return "The user wants a comparison. Contrast the sources directly, surface differences and shared patterns, and draw conclusions.";
    case "multi_doc_summary":
      return "The user wants a single synthesized document built from the provided sources. Integrate insights across sources into one coherent, structured narrative.";
    default:
      return "Produce a high-quality synthesized document using the provided research material.";
  }
}

function buildWritingSystemPrompt(params: {
  language: string;
  intent: AgentIntent;
  depth: "brief" | "normal" | "deep";
}): string {
  return `You are a senior writer producing a polished markdown document.

Target language: ${params.language}
Depth mode: ${params.depth}
Intent: ${params.intent}

Operating rules:
- Use ONLY the research JSON and user request as material. Do not invent facts or numbers not present in research.
- Ground the writing in specific facts, numbers, and quotes from the research. Prefer concrete signals over generic statements.
- Structure naturally: use headings and sections that fit the content. Do NOT force a fixed template or minimum section count.
- Avoid filler, boilerplate, and shallow bullet lists. Every section must carry insight.
- Write in the target language. Match the user's register.
- Do NOT include service markers like "chunk_index", raw JSON, or code fences for the document body.

${intentInstructions(params.intent)}

Output contract:
- Return ONLY a single JSON object (no code fences, no commentary).
- Shape:
{
  "markdown": string,   // the final document content
  "chat_reply": string, // one short sentence describing what you produced (<= 200 chars)
  "language": string    // short language code actually used in markdown
}
- "markdown" must be non-empty and must contain the full final document.`;
}

function buildWritingUserTurn(params: {
  userText: string;
  research: AgentResearchState;
  existingDocMarkdown: string;
}): string {
  const existing = params.existingDocMarkdown.trim();
  const existingBlock = existing
    ? `Existing document (optional reference):\n---\n${existing}\n---\n`
    : "Existing document is empty — you are creating content from scratch.\n";
  return `User request:
${params.userText}

Research (authoritative material):
${JSON.stringify(params.research, null, 2)}

${existingBlock}
Produce the writing JSON now.`;
}

export async function runWritingNode(
  input: RunWritingNodeInput
): Promise<RunWritingNodeOutput> {
  let state = pushAgentDiagnostic(input.state, {
    stage: "writing",
    code: "writing.invoke",
    message: `Invoking writing step (depth=${input.depth}).`,
  });

  const systemPrompt = buildWritingSystemPrompt({
    language: input.language,
    intent: input.intent,
    depth: input.depth,
  });
  const userTurn = buildWritingUserTurn({
    userText: input.userText,
    research: input.research,
    existingDocMarkdown: input.existingDocMarkdown,
  });

  const llm = await input.invokeModel({
    systemPrompt,
    turns: [{ role: "user", content: userTurn }],
    maxTokens: input.maxTokens,
  });

  const rawStripped = stripJsonFences(llm.text);
  const parsed = JSON.parse(rawStripped);
  const writing = agentWritingOutputSchema.parse(parsed);

  state = {
    ...state,
    stage: "writing",
    writing,
  };
  state = pushAgentDiagnostic(state, {
    stage: "writing",
    code: "writing.ready",
    message: `markdown_chars=${writing.markdown.length}; language=${writing.language}`,
  });

  return {
    state,
    writing,
    usage: llm.usage,
    raw: llm.text,
  };
}

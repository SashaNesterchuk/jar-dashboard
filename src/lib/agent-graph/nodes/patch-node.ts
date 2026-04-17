import { pushAgentDiagnostic, type AgentRunState } from "@/lib/agent-graph/state";

export type AgentUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type InvokeModel = (args: {
  systemPrompt: string;
  turns: ChatTurn[];
  maxTokens: number;
}) => Promise<{ text: string; usage: AgentUsage }>;

type RunPatchNodeInput<TPayload> = {
  state: AgentRunState;
  systemPrompt: string;
  turns: ChatTurn[];
  primaryMaxTokens: number;
  repairMaxTokens: number;
  maxRepairRawChars: number;
  invokeModel: InvokeModel;
  parsePayload: (raw: string) => TPayload;
  truncate: (text: string, maxChars: number) => string;
};

type RunPatchNodeOutput<TPayload> = {
  state: AgentRunState;
  payload: TPayload;
  usage: AgentUsage;
  raw: string;
};

export async function runPatchNode<TPayload>(
  input: RunPatchNodeInput<TPayload>
): Promise<RunPatchNodeOutput<TPayload>> {
  let state = pushAgentDiagnostic(input.state, {
    stage: "propose_patch",
    code: "llm.invoke.primary",
    message: "Calling model for primary patch proposal.",
  });

  const primary = await input.invokeModel({
    systemPrompt: input.systemPrompt,
    turns: input.turns,
    maxTokens: input.primaryMaxTokens,
  });

  let raw = primary.text;
  let usage: AgentUsage = primary.usage;

  try {
    const payload = input.parsePayload(raw);
    return { state, payload, usage, raw };
  } catch {
    state = {
      ...state,
      stage: "repair",
      retries: state.retries + 1,
    };
    state = pushAgentDiagnostic(state, {
      stage: "repair",
      code: "patch.parse.failed",
      message: "Primary model output invalid JSON. Running repair attempt.",
    });
  }

  const repairSystemPrompt = `${input.systemPrompt}

IMPORTANT:
- Your previous response was invalid JSON.
- Return ONLY minified valid JSON with exactly keys "chat_reply" and "patches".
- Escape all newlines in JSON strings properly.
- No markdown fences, no comments, no extra keys.`;

  const repairTurns: ChatTurn[] = [
    ...input.turns,
    {
      role: "assistant",
      content: input.truncate(raw, input.maxRepairRawChars),
    },
    {
      role: "user",
      content:
        'Repair your previous output and return valid JSON only: {"chat_reply":"...","patches":[{"target_chunk_index":VALID_CHUNK_INDEX_FROM_EDITABLE_CHUNKS,"new_text":"..."}]}',
    },
  ];

  const repair = await input.invokeModel({
    systemPrompt: repairSystemPrompt,
    turns: repairTurns,
    maxTokens: input.repairMaxTokens,
  });
  raw = repair.text;
  usage = {
    prompt_tokens: (usage.prompt_tokens ?? 0) + (repair.usage.prompt_tokens ?? 0),
    completion_tokens:
      (usage.completion_tokens ?? 0) + (repair.usage.completion_tokens ?? 0),
  };

  const payload = input.parsePayload(raw);
  state = pushAgentDiagnostic(state, {
    stage: "propose_patch",
    code: "patch.repair.success",
    message: "Repair output parsed successfully.",
  });
  return { state, payload, usage, raw };
}

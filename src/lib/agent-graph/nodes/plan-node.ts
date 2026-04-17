import type { AgentPlan, AgentRunState } from "@/lib/agent-graph/state";

type PlanNodeInput = {
  state: AgentRunState;
  userText: string;
  editableSectionPaths: string[];
};

type PlanNodeOutput = {
  plan: AgentPlan;
  confidence: number;
  reasons: string[];
};

function detectDepth(text: string): AgentPlan["depth"] {
  const t = text.toLowerCase();
  if (
    t.includes("подроб") ||
    t.includes("деталь") ||
    t.includes("deep") ||
    t.includes("detailed") ||
    t.includes("розгорн")
  ) {
    return "deep";
  }
  if (
    t.includes("коротко") ||
    t.includes("кратко") ||
    t.includes("brief") ||
    t.includes("short")
  ) {
    return "brief";
  }
  return "normal";
}

function summarizeIntent(state: AgentRunState): string {
  switch (state.intent) {
    case "compare":
      return "Compare provided information and highlight key differences.";
    case "multi_doc_summary":
      return "Create a cross-document summary and synthesize key points.";
    case "edit_with_context":
      return "Edit current document using attached context documents.";
    case "edit_local":
      return "Edit current document based only on local content.";
    case "answer_only":
      return "Answer user request without broad document rewrites.";
    default:
      return "Resolve user request with minimal safe edits.";
  }
}

export function runPlanNode(input: PlanNodeInput): {
  state: AgentRunState;
  result: PlanNodeOutput;
} {
  const inferredDepth = detectDepth(input.userText);
  const depth =
    input.state.intent === "multi_doc_summary" && inferredDepth === "normal"
      ? "deep"
      : inferredDepth;
  const targets = input.editableSectionPaths.slice(0, 20);
  const reasons: string[] = [];
  reasons.push(`intent:${input.state.intent}`);
  reasons.push(`depth:${depth}`);
  if (targets.length > 0) {
    reasons.push(`targets:${targets.length}`);
  } else {
    reasons.push("targets:fallback-first-chunks");
  }

  const plan: AgentPlan = {
    summary: summarizeIntent(input.state),
    depth,
    targets,
  };

  const nextState: AgentRunState = {
    ...input.state,
    stage: "draft_plan",
    plan,
  };

  return {
    state: nextState,
    result: {
      plan,
      confidence: 0.79,
      reasons,
    },
  };
}

export type CollabProvider = "openai" | "anthropic";

export interface CollabModelDefinition {
  id: string;
  label: string;
  provider: CollabProvider;
  /** USD per 1M input tokens (approximate; refresh from provider pricing). */
  usdPer1MInput: number;
  /** USD per 1M output tokens */
  usdPer1MOutput: number;
}

/** v1 catalog — align API ids with your provider dashboards. */
export const COLLAB_MODELS: CollabModelDefinition[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    usdPer1MInput: 2.5,
    usdPer1MOutput: 10,
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    usdPer1MInput: 0.15,
    usdPer1MOutput: 0.6,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
    usdPer1MInput: 3,
    usdPer1MOutput: 15,
  },
  {
    id: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku",
    provider: "anthropic",
    usdPer1MInput: 1,
    usdPer1MOutput: 5,
  },
];

export function getCollabModel(modelId: string): CollabModelDefinition | undefined {
  return COLLAB_MODELS.find((m) => m.id === modelId);
}

export const COLLAB_DEFAULT_MODEL_ID = "gpt-4o-mini";

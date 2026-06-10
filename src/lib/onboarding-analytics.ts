/**
 * Onboarding flow analytics — aligned with jar `pagesSteps` and
 * `onboarding_version` in onboarding events (not global `analytics_version`).
 */

export type OnboardingFlowVersion = "v1" | "v2";

/** Matches jar/components/common/v2/Onboarding/Onboarding.tsx `pagesSteps`. */
export const ONBOARDING_V2_PAGE_ORDER = [
  "helloFirst",
  "name",
  "1",
  "2",
  "summaryConclusion",
  "summaryConclusionQuestion",
  "summaryAI",
  "1.2",
  "noPremium1",
  "tasks",
  "notification",
  "ps3",
] as const;

export const ONBOARDING_V2_PAGE_LABELS: Record<string, string> = {
  helloFirst: "Welcome",
  name: "Name",
  "1": "Mood",
  "2": "Emotions",
  summaryConclusion: "Summary",
  summaryConclusionQuestion: "Summary Q",
  summaryAI: "AI summary",
  "1.2": "Jar",
  noPremium1: "Time goal",
  tasks: "Tasks",
  notification: "Notifications",
  ps3: "Paywall (PS3)",
};

/** Legacy v1 funnels (pre–onboarding_version). */
export const ONBOARDING_V1_PAGES = {
  noPremium: [
    "hello",
    "1",
    "1.2",
    "2",
    "3",
    "ps1",
    "noPremium1",
    "noPremium2",
    "practice",
    "notification",
    "ps2",
  ],
  premium: [
    "hello",
    "1",
    "1.2",
    "2",
    "3",
    "ps1",
    "premium1",
    "premium2",
    "premium3",
    "summary",
    "noPremium1",
    "notification",
  ],
} as const;

export function getOnboardingFlowFilter(version: OnboardingFlowVersion): string {
  if (version === "v2") {
    return `JSONExtractString(properties,'onboarding_version') = 'v2'`;
  }
  return `(JSONExtractString(properties,'onboarding_version') != 'v2' OR JSONExtractString(properties,'onboarding_version') = '')`;
}

export function parseOnboardingFlowVersion(
  value: string | null
): OnboardingFlowVersion {
  return value === "v1" ? "v1" : "v2";
}

export const ONBOARDING_TASK_PRACTICE_LABELS: Record<string, string> = {
  breathing: "Breathing",
  question: "Question",
  journaling: "Journal",
};

export type TaskPracticeOpens = {
  totalSessions: number;
  byType: Record<string, number>;
};

export function formatTaskPracticeOpensNote(
  opens: TaskPracticeOpens | null | undefined
): string | undefined {
  if (!opens || opens.totalSessions === 0) return undefined;

  const lines = Object.entries(opens.byType)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([type, count]) =>
        `${ONBOARDING_TASK_PRACTICE_LABELS[type] ?? type}: ${count}`
    );

  if (lines.length === 0) return undefined;

  return [
    `Opened practice from Tasks (${opens.totalSessions} sessions) — did not continue funnel:`,
    ...lines,
  ].join("\n");
}

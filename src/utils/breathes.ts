const convertToMs = (time: number) => time * 60 * 1000;

export const onboarding = {
  id: "3f2a1b8c-9d5f-4a2d-92ea-4b0b8e6a3c5f",
  tKey: "energy",
  title: "energy.",
  description: "Gentle pick-me-up with steady nasal breathing.",
  slot: "morning",
  times: [0.5],
  moodDependents: "good",
  type: "breathing",
  ball: "breathing",
  slotsForAIGeneration: ["morning", "day", "evening"],
  techniques: [
    { description: "Inhale through your nose", time: "3 sec" },
    { description: "Hold", time: "4 sec" },
    { description: "Exhale through your nose", time: "4 sec" },
    { description: "Hold", time: "4 sec" },
  ],
  phases: [
    { kind: "inhale", durationMs: 4000 },
    { kind: "hold", durationMs: 4000 },
    { kind: "exhale", durationMs: 4000 },
    { kind: "hold", durationMs: 4000 },
  ],
};

export const breathes = [
  // ENERGY — slightly inhale-biased to feel more alert, but still safe
  {
    id: "3f2a1b8c-9d5f-4a2d-92ea-4b0b8e6a3c5f",
    tKey: "energy",
    title: "energy.",
    description: "Boost alertness with a light, steady nasal cadence.",
    slot: "morning",
    times: [1, 2, 4],
    type: "breathing",
    moodDependents: "good",
    ball: "breathing",
    category: "morning",
    slotsForAIGeneration: ["morning"],
    techniques: [
      { description: "Inhale through your nose", time: "3 sec" },
      { description: "Exhale through your nose", time: "2 sec" },
    ],
    phases: [
      { kind: "inhale", durationMs: 3000 },
      { kind: "exhale", durationMs: 2000 },
    ],
  },

  // FOCUS — beginner box: shorter holds (progress later to 4-4-4-4)
  {
    id: "a6c7f1e2-4d3b-45a9-97fc-bc4f3a12d789",
    tKey: "focus",
    title: "focus.",
    description:
      "Calm-and-center box breathing with shorter, beginner-friendly holds.",
    slot: "morning",
    category: "morning",
    premium: true,
    times: [1, 2, 4],
    moodDependents: "ok",
    ball: "breathing",
    type: "breathing",
    slotsForAIGeneration: ["morning"],
    label: { label: "popular", type: "secondary" },
    techniques: [
      { description: "Inhale through your nose", time: "4 sec" },
      { description: "Hold", time: "2 sec" },
      { description: "Exhale through your nose", time: "4 sec" },
      { description: "Hold", time: "2 sec" },
    ],
    phases: [
      { kind: "inhale", durationMs: 4000 },
      { kind: "hold", durationMs: 2000 },
      { kind: "exhale", durationMs: 4000 },
      { kind: "hold", durationMs: 2000 },
    ],
  },

  // RELAX — physiological sigh (no explicit holds; long exhale)
  {
    id: "d9b8e4a1-6c2f-48d5-a7eb-19c3f5a87d62",
    tKey: "relax",
    title: "relax.",
    premium: true,
    description:
      "Physiological sigh: double nasal inhale, long exhale — fast, reliable downshift.",
    slot: "day",
    category: "duringTheDay",
    times: [1, 2, 4],
    type: "breathing",
    moodDependents: "bad",
    slotsForAIGeneration: ["day"],
    ball: "breathing",
    techniques: [
      { description: "Inhale through your nose", time: "2 sec" },
      { description: "Second short inhale (top-off)", time: "1 sec" },
      { description: "Exhale slowly (nose or mouth)", time: "6 sec" },
    ],
    phases: [
      { kind: "inhale", durationMs: 2000 },
      { kind: "inhale", durationMs: 1000 },
      { kind: "exhale", durationMs: 6000 },
    ],
  },

  // EXERCISES — warm-up cadence avoids rapid venting (hyperventilation)
  {
    id: "f4a7d8e9-3c2b-41f6-85d2-6a1b9c7e5d38",
    tKey: "exercises",
    title: "exercises.",
    description:
      "Steady nasal warm-up: slightly longer exhale to prep without dizziness.",
    slot: "day",
    category: "duringTheDay",
    times: [1, 2, 4],
    type: "breathing",
    premium: true,
    slotsForAIGeneration: ["day"],
    moodDependents: "good",
    ball: "breathing",
    techniques: [
      { description: "Inhale through your nose", time: "3 sec" },
      { description: "Exhale through your nose", time: "4 sec" },
    ],
    phases: [
      { kind: "inhale", durationMs: 3000 },
      { kind: "exhale", durationMs: 4000 },
    ],
  },

  // SLEEP — beginner 4-6 (resonant-ish), with optional later progress to 4-7-8
  {
    id: "b5c9d3a7-8e4f-4f6a-91d2-2a7b8c5f3e16",
    tKey: "sleep",
    title: "sleep.",
    description:
      "Gentle 4-6 cadence for sleep (progress to 4-7-8 later if comfortable).",
    times: [1, 2, 4],
    slot: "evening",
    category: "evening",
    type: "breathing",
    slotsForAIGeneration: ["evening"],
    moodDependents: "good",
    ball: "breathing",
    techniques: [
      { description: "Inhale through your nose", time: "4 sec" },
      {
        description: "Exhale through your nose (or pursed lips)",
        time: "6 sec",
      },
    ],
    phases: [
      { kind: "inhale", durationMs: 4000 },
      { kind: "exhale", durationMs: 6000 },
    ],
  },
];

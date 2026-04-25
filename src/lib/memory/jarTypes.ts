/**
 * Mirror of types from `jar/types/index.ts`.
 *
 * Reason for duplication: portal (`mindjar-dashboard/`) and mobile app
 * (`jar/`) are separate TypeScript projects. `jar/types/index.ts`
 * transitively imports React Native / Expo modules (RichTextValue,
 * QuizTrait, React) that cannot be resolved in the portal's tsconfig.
 *
 * Spec §0.3 requires that memory logic reuses canonical shapes from
 * `jar/types/index.ts`. This file keeps them identical at the shape
 * level. Any change in `jar/types/index.ts` for these specific types
 * MUST be reflected here until cross-project type sharing is set up.
 *
 * On port to `jar/`: delete this file; replace imports with
 * `import { ... } from "@/types"`.
 */

export type Mood = "awful" | "bad" | "ok" | "good" | "great";

export type TimeSlot = "morning" | "day" | "evening" | "night";

export type User = {
  id: string;
  name?: string;
  timezone?: string;
  synced?: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export interface Emotion {
  tKey: string;
  label: string;
  icon?: string;
  moodDependencies?: Mood[];
  isCustom?: boolean;
  isAI?: boolean;
  isVisible?: boolean;
}

export interface TagCategory {
  id: string;
  tKey: string;
  label: string;
  icon?: string;
}

export interface Tag {
  tKey: string;
  label: string;
  icon?: string;
  isCustom?: boolean;
  isAI?: boolean;
  categoryId: string;
}

/**
 * Mirror of `EventType` (`jar/types/index.ts`). Kept here because the
 * portal cannot import the jar-side file directly (see module header).
 */
export type EventType =
  | "streak"
  | "journaling"
  | "meditation"
  | "reflection"
  | "todo"
  | "affirmations"
  | "mood"
  | "question"
  | "review"
  | "summary"
  | "breathing"
  | "letter";

/**
 * Mirror of `CheckIn` (`jar/types/index.ts`).
 */
export interface CheckIn {
  mood: Mood;
  emotion?: string;
  actions?: string[];
  reflection?: string;
}

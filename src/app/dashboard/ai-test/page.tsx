"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useMemoryFeedback } from "@/lib/memory/hooks/useMemoryFeedback";
import {
  useMemoryStorage,
  useMemorySubscription,
  useMemoryTelemetry,
} from "@/lib/memory/hooks/useMemoryContext";
import {
  useSessionSubmit,
  type SessionSubmitInput,
  type SessionSubmitResult,
} from "@/lib/memory/hooks/useSessionSubmit";
import {
  useReflectionSubmit,
  type ReflectionSubmitInput,
} from "@/lib/memory/hooks/useReflectionSubmit";
import { useOnboardingSubmit } from "@/lib/memory/hooks/useOnboardingSubmit";
import type { Emotion, Tag } from "@/lib/memory/jarTypes";
import type {
  MemoryItem,
  SessionSummaryV1Sync,
  StableProfile,
} from "@/lib/memory/types";
import type {
  OnboardingAnswers,
  OnboardingTimeBudget,
  OnboardingTimingPreference,
} from "@/lib/memory/onboarding/types";
import {
  projectMemoryScreen,
  type MemoryCardProjection,
} from "@/lib/memory/ui/memoryView";
import {
  pickSummaryFieldText,
  SummaryCardBlock,
} from "@/components/custom/summary-card-block";
import { journals } from "@/utils/journalEvents";
import { questionsNe } from "@/utils/questions";
import {
  getSelfDiscoveryPageEn,
  getSelfDiscoveryQuestionLabelEn,
  getSelfDiscoveryTitleEn,
  getSelfDiscoveryTraitEn,
} from "@/utils/selfDiscoveryEn";
import {
  checkInTagCategories,
  emotionsForMood,
  emotionsPrimaryThenOthers,
  tagsForCategory,
} from "@/utils/checkInCatalog";
import {
  SIM_CLIENT_METADATA,
  formatJson,
  generateUuid,
  useSimUserId,
} from "../_sim/sim-helpers";

// --- Practice Types ---

type PracticeType = "journaling" | "self-discovery" | "reflection" | "check-in" | "";

type RichTextValue = { question: string; answer?: string };

interface QuizTrait {
  id: string;
  title: string;
  description: string;
}

interface QuestionAnswer {
  questionId: string;
  weights: Record<string, number>;
  label: string;
}

interface ChatMessage {
  role: "ai" | "user";
  text: string;
  feedback?: "like" | "dislike" | null;
}

const PRACTICE_CARDS: {
  type: PracticeType;
  title: string;
  description: string;
  icon: string;
  count: string;
}[] = [
    {
      type: "journaling",
      title: "Journaling",
      description: "Guided journal prompts for self-reflection",
      icon: "📝",
      count: `${journals.length} practices`,
    },
    {
      type: "self-discovery",
      title: "Self-Discovery",
      description: "Quiz-based personality & trait assessments",
      icon: "🔍",
      count: `${questionsNe.length} tests`,
    },
    {
      type: "reflection",
      title: "Reflection",
      description: "Chat-style AI reflection conversations",
      icon: "💬",
      count: "40 prompts",
    },
    {
      type: "check-in",
      title: "Mood Check-in",
      description: "Quick mood tracking with emotions & tags",
      icon: "🎯",
      count: "5 moods + emotions",
    },
  ];

// --- Reflection questions (from jar/events/reflection.ts) ---

interface ReflectionQuestion {
  id: string;
  title: string;
  slot: string;
  moodCategory: "resourceful" | "challenge";
}

const reflectionQuestions: ReflectionQuestion[] = [
  { id: "r-m-r1", title: "Hey, how are you feeling this morning?", slot: "morning", moodCategory: "resourceful" },
  { id: "r-m-r2", title: "What are you actually looking forward to today?", slot: "morning", moodCategory: "resourceful" },
  { id: "r-m-r3", title: "Tell me about your morning vibe", slot: "morning", moodCategory: "resourceful" },
  { id: "r-m-r4", title: "Hope today treats you well — got any plans?", slot: "morning", moodCategory: "resourceful" },
  { id: "r-m-r5", title: "How's the energy this morning, honestly?", slot: "morning", moodCategory: "resourceful" },
  { id: "r-m-c1", title: "What's on your mind this morning?", slot: "morning", moodCategory: "challenge" },
  { id: "r-m-c2", title: "Something feels off — walk me through it", slot: "morning", moodCategory: "challenge" },
  { id: "r-m-c3", title: "What's making it hard to get going this morning?", slot: "morning", moodCategory: "challenge" },
  { id: "r-m-c4", title: "What's hard to shake off this morning?", slot: "morning", moodCategory: "challenge" },
  { id: "r-m-c5", title: "Tell me what's weighing on you today", slot: "morning", moodCategory: "challenge" },
  { id: "r-d-r1", title: "Anything unexpectedly good happen today?", slot: "day", moodCategory: "resourceful" },
  { id: "r-d-r2", title: "Tell me one good thing from today", slot: "day", moodCategory: "resourceful" },
  { id: "r-d-r3", title: "Any little win today worth a smile?", slot: "day", moodCategory: "resourceful" },
  { id: "r-d-r4", title: "Something gave you a boost today? Tell me!", slot: "day", moodCategory: "resourceful" },
  { id: "r-d-r5", title: "What's the best part of your day so far?", slot: "day", moodCategory: "resourceful" },
  { id: "r-d-c1", title: "What's taking up most of your headspace?", slot: "day", moodCategory: "challenge" },
  { id: "r-d-c2", title: "What's bothering you right now?", slot: "day", moodCategory: "challenge" },
  { id: "r-d-c3", title: "Tell me what's been tough today", slot: "day", moodCategory: "challenge" },
  { id: "r-d-c4", title: "What's not letting you relax right now?", slot: "day", moodCategory: "challenge" },
  { id: "r-d-c5", title: "What feels hard to carry right now?", slot: "day", moodCategory: "challenge" },
  { id: "r-e-r1", title: "Tell me the best moment of your day", slot: "evening", moodCategory: "resourceful" },
  { id: "r-e-r2", title: "What are you most grateful for today?", slot: "evening", moodCategory: "resourceful" },
  { id: "r-e-r3", title: "Anything today that made you feel good?", slot: "evening", moodCategory: "resourceful" },
  { id: "r-e-r4", title: "What from today do you want more of tomorrow?", slot: "evening", moodCategory: "resourceful" },
  { id: "r-e-r5", title: "What pleasantly surprised you today?", slot: "evening", moodCategory: "resourceful" },
  { id: "r-e-c1", title: "How are you really doing tonight?", slot: "evening", moodCategory: "challenge" },
  { id: "r-e-c2", title: "If you could redo one thing today, what'd it be?", slot: "evening", moodCategory: "challenge" },
  { id: "r-e-c3", title: "Who or what helped you get through today?", slot: "evening", moodCategory: "challenge" },
  { id: "r-e-c4", title: "Tell me what's still spinning in your head", slot: "evening", moodCategory: "challenge" },
  { id: "r-e-c5", title: "What would make tonight feel a bit easier?", slot: "evening", moodCategory: "challenge" },
  { id: "r-n-r1", title: "Still up. What's the story tonight?", slot: "night", moodCategory: "resourceful" },
  { id: "r-n-r2", title: "Late nights have their own magic — what's yours?", slot: "night", moodCategory: "resourceful" },
  { id: "r-n-r3", title: "What's good about being awake right now?", slot: "night", moodCategory: "resourceful" },
  { id: "r-n-r4", title: "Too good to sleep? What's going on?", slot: "night", moodCategory: "resourceful" },
  { id: "r-n-r5", title: "What's giving tonight a good vibe?", slot: "night", moodCategory: "resourceful" },
  { id: "r-n-c1", title: "Can't sleep? Tell me what's going on", slot: "night", moodCategory: "challenge" },
  { id: "r-n-c2", title: "What's hard to stop thinking about tonight?", slot: "night", moodCategory: "challenge" },
  { id: "r-n-c3", title: "What's harder to ignore tonight?", slot: "night", moodCategory: "challenge" },
  { id: "r-n-c4", title: "Can't quiet your mind? Tell me", slot: "night", moodCategory: "challenge" },
  { id: "r-n-c5", title: "What's making it hard to sleep?", slot: "night", moodCategory: "challenge" },
];

const MOODS = ["great", "good", "ok", "bad", "awful"] as const;
type Mood = (typeof MOODS)[number];

const MOOD_LABELS: Record<Mood, string> = {
  great: "Great 😊",
  good: "Good 🙂",
  ok: "OK 😐",
  bad: "Bad 😞",
  awful: "Awful 😢",
};

// --- Onboarding Profile Types & Config ---
// Canonical spec: MindJar consolidated documentation v1.3 — section C.1.9 (Q1–Q7).
// Q1, Q3, Q4, Q5 — mandatory; Q2, Q6, Q7 — optional.

interface OnboardingProfile {
  name: string;
  primary_motivation: string[]; // Q1 — mandatory
  pain_map: string[]; // Q2 — optional
  focus_areas: string[]; // Q3 — mandatory, max 2
  support_style: string; // Q4 — mandatory (declared preference)
  realistic_action_modes: string[]; // Q5 section A — mandatory
  daily_time_budget: string; // Q5 section B — mandatory
  support_timing_preference: string; // Q6 — optional
  avoided_topics: string[]; // Q7 — optional, privacy-sensitive
}

const STORAGE_KEY = "ai-test-onboarding-profile";
const MEMORY_STORAGE_KEY = "mindjar_memory_portal_store:v1";
const SIM_USER_ID_KEY = "mindjar.sim.user_id:v1";

const defaultProfile: OnboardingProfile = {
  name: "",
  primary_motivation: [],
  pain_map: [],
  focus_areas: [],
  support_style: "",
  realistic_action_modes: [],
  daily_time_budget: "",
  support_timing_preference: "",
  avoided_topics: [],
};

const TIME_BUDGET_BY_LABEL: Record<string, OnboardingTimeBudget> = {
  "Less than 10 min": "lt_10_min",
  "10–30 min": "10_30_min",
  "30–60 min": "30_60_min",
  "Over 1 hour": "gt_60_min",
};

const TIMING_BY_LABEL: Record<string, OnboardingTimingPreference> = {
  Morning: "morning",
  Midday: "midday",
  Evening: "evening",
  "Late at night": "late_night",
  "When things get overwhelming": "when_overwhelming",
  "No specific time": "no_specific_time",
};

function buildOnboardingAnswers(
  profile: OnboardingProfile,
): OnboardingAnswers {
  return {
    user_name: profile.name.trim() || undefined,
    primary_motivation: profile.primary_motivation,
    pain_map: profile.pain_map,
    focus_areas: profile.focus_areas,
    support_style: profile.support_style || undefined,
    realistic_action_modes: profile.realistic_action_modes,
    daily_time_budget: TIME_BUDGET_BY_LABEL[profile.daily_time_budget],
    support_timing_preference: TIMING_BY_LABEL[profile.support_timing_preference],
    avoided_topics: profile.avoided_topics,
  };
}

function readTelemetrySnapshot(telemetry: unknown): unknown[] {
  if (!telemetry || typeof telemetry !== "object") return [];
  const history = (telemetry as { history?: unknown }).history;
  return Array.isArray(history) ? history.slice(-20).reverse() : [];
}

function clearTelemetrySnapshot(telemetry: unknown): void {
  if (!telemetry || typeof telemetry !== "object") return;
  const history = (telemetry as { history?: unknown }).history;
  if (Array.isArray(history)) history.length = 0;
}

interface ResettableMemoryStorage {
  __reset?: () => void;
}

function downloadTextFile(filename: string, text: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildMemoryDebugText(input: {
  exportedAt: string;
  userId: string | null;
  stableProfile: StableProfile | null;
  summaries: SessionSummaryV1Sync[];
  items: MemoryItem[];
  telemetry: unknown[];
  storageDump: unknown;
}): string {
  const sections: Array<[string, unknown]> = [
    [
      "metadata",
      {
        exported_at: input.exportedAt,
        user_id: input.userId,
      },
    ],
    ["stable_profile", input.stableProfile],
    ["recent_summaries", input.summaries],
    ["memory_items", input.items],
    ["telemetry_tail", input.telemetry],
    ["storage_dump", input.storageDump],
  ];

  return sections
    .map(([title, value]) => `## ${title}\n${formatJson(value)}`)
    .join("\n\n");
}

type SingleQuestion = {
  type: "single";
  title: string;
  subtitle?: string;
  optional?: boolean;
  options: readonly string[];
};

type MultiQuestion = {
  type: "multi";
  title: string;
  subtitle?: string;
  optional?: boolean;
  maxSelect?: number;
  options: readonly string[];
};

type OnboardingQuestion = SingleQuestion | MultiQuestion;

const onboardingQuestions: Record<
  Exclude<keyof OnboardingProfile, "name">,
  OnboardingQuestion
> = {
  // Q1 — mandatory
  primary_motivation: {
    type: "multi",
    title: "Q1. Що привело тебе сюди?",
    subtitle: "Можна обрати кілька (mandatory)",
    options: [
      "I feel anxious or overwhelmed",
      "I want to understand my emotions better",
      "I'm going through a difficult time",
      "I want to build healthier habits",
      "I'm just curious / exploring",
    ],
  },
  // Q2 — optional
  pain_map: {
    type: "multi",
    title: "Q2. Що зараз дається найважче?",
    subtitle: "Можна обрати кілька або пропустити (optional)",
    optional: true,
    options: [
      "Stress",
      "Overthinking",
      "Low energy",
      "Sleep",
      "Anxiety",
      "Relationships",
      "Motivation",
      "Burnout",
      "Prefer not to say",
    ],
  },
  // Q3 — mandatory, max 2
  focus_areas: {
    type: "multi",
    title: "Q3. На чому ти хочеш сфокусуватися в першу чергу?",
    subtitle: "До 2 варіантів (mandatory)",
    maxSelect: 2,
    options: [
      "Managing stress and anxiety",
      "Understanding my patterns",
      "Building self-compassion",
      "Improving sleep",
      "Processing difficult feelings",
      "Just checking in with myself daily",
    ],
  },
  // Q4 — mandatory
  support_style: {
    type: "single",
    title: "Q4. Який тип підтримки тобі зараз ближчий?",
    subtitle: "Один варіант (mandatory)",
    options: [
      "Gentle and calming",
      "Direct and practical",
      "Reflective and thoughtful",
      "Short and simple",
      "A mix of these",
    ],
  },
  // Q5 section A — mandatory
  realistic_action_modes: {
    type: "multi",
    title: "Q5a. Які формати дій для тебе реалістичні?",
    subtitle: "Можна обрати кілька (mandatory)",
    options: [
      "Quick check-ins",
      "Short breathing exercises",
      "A short chat with AI",
      "Journaling",
      "Self-discovery quizzes",
      "Just one small step a day",
    ],
  },
  // Q5 section B — mandatory
  daily_time_budget: {
    type: "single",
    title: "Q5b. Скільки часу на день готовий приділяти?",
    subtitle: "Один варіант (mandatory)",
    options: ["Less than 10 min", "10–30 min", "30–60 min", "Over 1 hour"],
  },
  // Q6 — optional
  support_timing_preference: {
    type: "single",
    title: "Q6. Коли підтримка найчастіше потрібна?",
    subtitle: "Один варіант (optional)",
    optional: true,
    options: [
      "Morning",
      "Midday",
      "Evening",
      "Late at night",
      "When things get overwhelming",
      "No specific time",
    ],
  },
  // Q7 — optional, privacy-sensitive
  avoided_topics: {
    type: "multi",
    title: "Q7. Чи є теми, до яких краще підходити дуже обережно?",
    subtitle:
      "Privacy-sensitive — повністю optional. Не рахується як одне з шести обов'язкових питань.",
    optional: true,
    options: [
      "Loss / grief",
      "Family conflict",
      "Trauma",
      "Body / appearance",
      "Money / work pressure",
      "Romantic relationships",
      "Health concerns",
      "None / I'll tell you later",
    ],
  },
};

const questionOrder: (keyof OnboardingProfile)[] = [
  "name",
  "primary_motivation",
  "pain_map",
  "focus_areas",
  "support_style",
  "realistic_action_modes",
  "daily_time_budget",
  "support_timing_preference",
  "avoided_topics",
];

function loadProfile(): OnboardingProfile {
  if (typeof window === "undefined") return defaultProfile;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultProfile, ...JSON.parse(raw) };
  } catch { }
  return defaultProfile;
}

const stripHtmlTags = (text: string): string => {
  return text.replace(/<[^>]*>/g, "");
};

const toMemoryTags = (labels: readonly string[]): Tag[] => {
  const seen = new Set<string>();
  return labels
    .map((label) => stripHtmlTags(label).trim())
    .filter((label) => label.length > 0)
    .filter((label) => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map((label) => ({
      tKey: `practice.${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      label,
      categoryId: "practice",
    }));
};

const PRACTICE_HISTORY_KEY = "ai-test-practice-history";
const PRACTICE_HISTORY_LIMIT = 50;

type CompletedPracticeEntry = {
  id: string;
  at: string;
  practiceType: Exclude<PracticeType, "">;
  practiceLabel: string;
  aiResponse: unknown;
  practiceInput?: unknown;
  memoryRequest?: unknown;
  memoryBefore?: unknown;
  memoryAfter?: unknown;
  memoryResult?: unknown;
};

type PracticeMemorySnapshot = {
  capturedAt: string;
  userId: string | null;
  stableProfile: StableProfile | null;
  summaries: SessionSummaryV1Sync[];
  items: MemoryItem[];
  telemetry: unknown[];
  storageDump: unknown;
};

function newPracticeHistoryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
}

function loadPracticeHistory(): CompletedPracticeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRACTICE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: CompletedPracticeEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const e = item as Partial<CompletedPracticeEntry>;
      if (
        typeof e.id !== "string" ||
        typeof e.at !== "string" ||
        typeof e.practiceType !== "string" ||
        typeof e.practiceLabel !== "string"
      ) {
        continue;
      }
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        at: e.at,
        practiceType: e.practiceType as CompletedPracticeEntry["practiceType"],
        practiceLabel: e.practiceLabel,
        aiResponse: e.aiResponse,
        practiceInput: e.practiceInput,
        memoryRequest: e.memoryRequest,
        memoryBefore: e.memoryBefore,
        memoryAfter: e.memoryAfter,
        memoryResult: e.memoryResult,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function savePracticeHistory(entries: CompletedPracticeEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify(entries));
}

function buildCompletedPracticeDebugText(input: {
  exportedAt: string;
  entries: CompletedPracticeEntry[];
}): string {
  return [
    `# MindJar completed practices debug`,
    `exported_at: ${input.exportedAt}`,
    `entry_count: ${input.entries.length}`,
    "",
    ...input.entries.flatMap((entry, index) => [
      `## Practice ${index + 1}: ${entry.practiceType} · ${entry.practiceLabel}`,
      `id: ${entry.id}`,
      `completed_at: ${entry.at}`,
      "",
      `### practice_input`,
      formatJson(entry.practiceInput ?? null),
      "",
      `### memory_request`,
      formatJson(entry.memoryRequest ?? null),
      "",
      `### memory_before`,
      formatJson(entry.memoryBefore ?? null),
      "",
      `### memory_result`,
      formatJson(entry.memoryResult ?? null),
      "",
      `### memory_after`,
      formatJson(entry.memoryAfter ?? null),
      "",
      `### ai_response`,
      formatJson(entry.aiResponse),
      "",
    ]),
  ].join("\n");
}

function completedPracticeFilename(
  prefix: string,
  value: string,
  exportedAt: string,
): string {
  const safeValue = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${prefix}-${safeValue || "practice"}-${exportedAt.replace(/[:.]/g, "-")}.txt`;
}

// ======================================================================

export default function AITestPage() {
  const [simUserId, setSimUserId] = useSimUserId();
  const memoryStorage = useMemoryStorage();
  const memorySubscription = useMemorySubscription();
  const memoryTelemetry = useMemoryTelemetry();
  const { submit: submitSession, isSubmitting: isSubmittingSession } =
    useSessionSubmit(simUserId);
  const { submit: submitReflection, isSubmitting: isSubmittingReflection } =
    useReflectionSubmit(simUserId);
  const {
    submit: submitOnboarding,
    isSubmitting: isSubmittingOnboarding,
    error: onboardingSubmitError,
  } = useOnboardingSubmit(simUserId);
  const { submit: submitMemoryFeedback, isSubmitting: isApplyingFeedback } =
    useMemoryFeedback(simUserId);

  // --- Profile ---
  const [profile, setProfile] = useState<OnboardingProfile>(defaultProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lastOnboardingItems, setLastOnboardingItems] = useState<
    MemoryItem[] | null
  >(null);
  const [lastOnboardingProfile, setLastOnboardingProfile] =
    useState<StableProfile | null>(null);

  useEffect(() => {
    const loaded = loadProfile();
    setProfile(loaded);
    const hasAnyAnswer = Object.values(loaded).some((v) =>
      Array.isArray(v) ? v.length > 0 : v !== ""
    );
    if (!hasAnyAnswer) setProfileOpen(true);
  }, []);

  const [practiceHistory, setPracticeHistory] = useState<CompletedPracticeEntry[]>([]);

  useEffect(() => {
    const next = loadPracticeHistory();
    setPracticeHistory(next);
    savePracticeHistory(next);
  }, []);

  const updateProfile = useCallback(
    (key: keyof OnboardingProfile, value: string | string[]) => {
      setProfile((prev) => {
        const next = { ...prev, [key]: value };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const toggleMulti = useCallback(
    (key: keyof OnboardingProfile, option: string, maxSelect?: number) => {
      setProfile((prev) => {
        const current = prev[key] as string[];
        let next: string[];
        if (current.includes(option)) {
          next = current.filter((v) => v !== option);
        } else if (maxSelect && current.length >= maxSelect) {
          // Drop the oldest selection to keep cap (mirrors C.1.9 Q3 max-2 rule).
          next = [...current.slice(1), option];
        } else {
          next = [...current, option];
        }
        const updated = { ...prev, [key]: next };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const resetProfile = useCallback(() => {
    setProfile(defaultProfile);
    localStorage.removeItem(STORAGE_KEY);
    setLastOnboardingItems(null);
    setLastOnboardingProfile(null);
  }, []);

  // --- Practice state ---
  const [practiceType, setPracticeType] = useState<PracticeType>("");
  const [selectedPractice, setSelectedPractice] = useState<any>(null);
  const [journalAnswers, setJournalAnswers] = useState<RichTextValue[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);

  // --- Reflection state ---
  const [selectedReflection, setSelectedReflection] = useState<ReflectionQuestion | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [checkInResult, setCheckInResult] = useState<SessionSubmitResult | null>(
    null,
  );
  const [checkInItems, setCheckInItems] = useState<MemoryItem[]>([]);
  const [memoryInspectorOpen, setMemoryInspectorOpen] = useState(false);
  const [memoryDebugOpen, setMemoryDebugOpen] = useState(false);
  const [memoryProfileSnapshot, setMemoryProfileSnapshot] =
    useState<StableProfile | null>(null);
  const [memorySummaries, setMemorySummaries] = useState<
    SessionSummaryV1Sync[]
  >([]);
  const [memoryStorageDump, setMemoryStorageDump] = useState<unknown>(null);
  const [memoryTelemetrySnapshot, setMemoryTelemetrySnapshot] = useState<
    unknown[]
  >([]);
  const [chatInput, setChatInput] = useState("");

  // --- Check-in state ---
  const [checkInMood, setCheckInMood] = useState<Mood | "">("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [checkInNote, setCheckInNote] = useState("");

  const refreshCheckInItems = useCallback(async () => {
    if (!simUserId) return;
    const all = await memoryStorage.getMemoryItems(simUserId);
    setCheckInItems(all.filter((i) => i.status !== "removed_by_user"));
  }, [memoryStorage, simUserId]);

  const refreshInlineMemory = useCallback(async () => {
    if (!simUserId) return;
    const [items, stableProfile, summaries] = await Promise.all([
      memoryStorage.getMemoryItems(simUserId),
      memoryStorage.getStableProfile(simUserId),
      memoryStorage.getRecentSessionSummaries(simUserId, 10),
    ]);
    setCheckInItems(items.filter((i) => i.status !== "removed_by_user"));
    setMemoryProfileSnapshot(stableProfile);
    setMemorySummaries(summaries);
    setMemoryTelemetrySnapshot(readTelemetrySnapshot(memoryTelemetry));

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
      try {
        setMemoryStorageDump(raw ? JSON.parse(raw) : null);
      } catch {
        setMemoryStorageDump(raw);
      }
    }
  }, [memoryStorage, memoryTelemetry, simUserId]);

  const capturePracticeMemorySnapshot = useCallback(async (): Promise<
    PracticeMemorySnapshot
  > => {
    let storageDump: unknown = null;
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
      try {
        storageDump = raw ? JSON.parse(raw) : null;
      } catch {
        storageDump = raw;
      }
    }

    if (!simUserId) {
      return {
        capturedAt: new Date().toISOString(),
        userId: null,
        stableProfile: null,
        summaries: [],
        items: [],
        telemetry: readTelemetrySnapshot(memoryTelemetry),
        storageDump,
      };
    }

    const [items, stableProfile, summaries] = await Promise.all([
      memoryStorage.getMemoryItems(simUserId),
      memoryStorage.getStableProfile(simUserId),
      memoryStorage.getRecentSessionSummaries(simUserId, 10),
    ]);

    return {
      capturedAt: new Date().toISOString(),
      userId: simUserId,
      stableProfile,
      summaries,
      items,
      telemetry: readTelemetrySnapshot(memoryTelemetry),
      storageDump,
    };
  }, [memoryStorage, memoryTelemetry, simUserId]);

  const handleSubmitOnboarding = useCallback(async () => {
    if (!simUserId) return;
    const result = await submitOnboarding(buildOnboardingAnswers(profile));
    setLastOnboardingItems(result.items);
    setLastOnboardingProfile(result.stable_profile);
    await refreshInlineMemory();
  }, [profile, refreshInlineMemory, simUserId, submitOnboarding]);

  const toggleMemoryInspector = useCallback(() => {
    setMemoryInspectorOpen((current) => {
      const next = !current;
      if (next) void refreshInlineMemory();
      return next;
    });
  }, [refreshInlineMemory]);

  const toggleMemoryDebug = useCallback(() => {
    setMemoryDebugOpen((current) => {
      const next = !current;
      if (next) void refreshInlineMemory();
      return next;
    });
  }, [refreshInlineMemory]);

  const handleDownloadMemoryDebug = useCallback(async () => {
    const exportedAt = new Date().toISOString();
    let items = checkInItems;
    let stableProfile = memoryProfileSnapshot;
    let summaries = memorySummaries;
    let storageDump = memoryStorageDump;
    const telemetry = readTelemetrySnapshot(memoryTelemetry);

    if (simUserId) {
      [items, stableProfile, summaries] = await Promise.all([
        memoryStorage.getMemoryItems(simUserId),
        memoryStorage.getStableProfile(simUserId),
        memoryStorage.getRecentSessionSummaries(simUserId, 10),
      ]);
    }

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
      try {
        storageDump = raw ? JSON.parse(raw) : null;
      } catch {
        storageDump = raw;
      }
    }

    setCheckInItems(items.filter((i) => i.status !== "removed_by_user"));
    setMemoryProfileSnapshot(stableProfile);
    setMemorySummaries(summaries);
    setMemoryTelemetrySnapshot(telemetry);
    setMemoryStorageDump(storageDump);

    downloadTextFile(
      `mindjar-memory-debug-${exportedAt.replace(/[:.]/g, "-")}.txt`,
      buildMemoryDebugText({
        exportedAt,
        userId: simUserId,
        stableProfile,
        summaries,
        items,
        telemetry,
        storageDump,
      }),
    );
  }, [
    checkInItems,
    memoryProfileSnapshot,
    memoryStorage,
    memoryStorageDump,
    memorySummaries,
    memoryTelemetry,
    simUserId,
  ]);

  const checkInEmotionGroups = useMemo((): ReturnType<
    typeof emotionsPrimaryThenOthers
  > => {
    if (!checkInMood) return { primary: [], others: [] };
    return emotionsPrimaryThenOthers(checkInMood);
  }, [checkInMood]);

  useEffect(() => {
    if (!checkInMood) return;
    const allowed = new Set(emotionsForMood(checkInMood).map((e) => e.label));
    setSelectedEmotions((prev) => prev.filter((l) => allowed.has(l)));
  }, [checkInMood]);

  useEffect(() => {
    if (!checkInResult) return;
    void refreshCheckInItems();
  }, [checkInResult, refreshCheckInItems]);

  // --- Shared state ---
  const [aiResponseData, setAiResponseData] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const parsedAiSummary = useMemo(() => {
    if (!aiResponseData || typeof aiResponseData !== "object") return null;
    const result = (aiResponseData as { result?: Record<string, unknown> })
      .result;
    if (!result || typeof result !== "object") return null;
    const summary =
      typeof result.summary === "string" && result.summary.trim()
        ? result.summary.trim()
        : null;
    return {
      summary,
      insight: pickSummaryFieldText(result.insight),
      advice: pickSummaryFieldText(result.advice),
      affirmation: pickSummaryFieldText(result.affirmation),
    };
  }, [aiResponseData]);

  const hasParsedSummaryBlocks =
    !!parsedAiSummary &&
    !!(
      parsedAiSummary.summary ||
      parsedAiSummary.insight ||
      parsedAiSummary.advice ||
      parsedAiSummary.affirmation
    );

  const resetPracticeState = useCallback(() => {
    setSelectedPractice(null);
    setJournalAnswers([]);
    setQuestionAnswers([]);
    setSelectedReflection(null);
    setChatMessages([]);
    setChatInput("");
    setCheckInMood("");
    setSelectedEmotions([]);
    setSelectedTags([]);
    setCheckInNote("");
    setCheckInResult(null);
    setCheckInItems([]);
    setAiResponseData(null);
    setError("");
  }, []);

  const handleCleanEverything = useCallback(() => {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        "Clean everything? This removes all local memory, onboarding profile, completed practice history, telemetry tail, and resets the simulator user.",
      );
    if (!confirmed) return;

    (memoryStorage as ResettableMemoryStorage).__reset?.();
    clearTelemetrySnapshot(memoryTelemetry);

    const nextUserId = generateUuid();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(MEMORY_STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(PRACTICE_HISTORY_KEY);
      window.localStorage.setItem(SIM_USER_ID_KEY, nextUserId);
    }

    setSimUserId(nextUserId);
    setProfile(defaultProfile);
    setProfileOpen(true);
    setLastOnboardingItems(null);
    setLastOnboardingProfile(null);
    setPracticeHistory([]);
    setPracticeType("");
    resetPracticeState();
    setCheckInItems([]);
    setMemoryProfileSnapshot(null);
    setMemorySummaries([]);
    setMemoryStorageDump(null);
    setMemoryTelemetrySnapshot([]);
  }, [memoryStorage, memoryTelemetry, resetPracticeState, setSimUserId]);

  const handlePracticeTypeChange = (type: PracticeType) => {
    if (type === practiceType) {
      setPracticeType("");
      resetPracticeState();
      return;
    }
    setPracticeType(type);
    resetPracticeState();
  };

  const handlePracticeChange = (practiceId: string) => {
    let practice = null;
    if (practiceType === "journaling") {
      practice = journals.find((j) => j.id === practiceId);
    } else if (practiceType === "self-discovery") {
      practice = questionsNe.find((q) => q.id === practiceId);
    }
    setSelectedPractice(practice);
    setJournalAnswers([]);
    setQuestionAnswers([]);
    setAiResponseData(null);
    setError("");
  };

  const handleJournalAnswerChange = (index: number, answer: string) => {
    const newAnswers = [...journalAnswers];
    const templates = selectedPractice?.pages?.[0]?.templates || [];
    const question =
      templates.length > 0
        ? stripHtmlTags(templates[index])
        : stripHtmlTags(selectedPractice?.title || "Journal Entry");
    newAnswers[index] = { question, answer };
    setJournalAnswers(newAnswers);
  };

  const handleQuestionAnswerChange = (
    questionId: string,
    weights: Record<string, number>,
    label: string
  ) => {
    const pageIndex = selectedPractice?.pages?.findIndex((page: any) =>
      page.questions?.some((q: any) => q.id === questionId)
    );
    if (pageIndex === -1) return;
    const pageQuestionIds =
      selectedPractice.pages[pageIndex].questions?.map((q: any) => q.id) || [];
    const newAnswers = questionAnswers.filter(
      (a) => !pageQuestionIds.includes(a.questionId)
    );
    newAnswers.push({ questionId, weights, label });
    setQuestionAnswers(newAnswers);
  };

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const calculateQuizTrait = (): QuizTrait | null => {
    if (!selectedPractice?.traits || questionAnswers.length === 0) return null;
    const scores: Record<string, number> = {};
    selectedPractice.traits.forEach((t: QuizTrait) => (scores[t.id] = 0));
    questionAnswers.forEach((answer) => {
      Object.entries(answer.weights).forEach(([traitId, weight]) => {
        if (scores[traitId] !== undefined) scores[traitId] += weight;
      });
    });
    let maxScore = -Infinity;
    let bestTraitId: string | null = null;
    Object.entries(scores).forEach(([traitId, score]) => {
      if (score > maxScore) {
        maxScore = score;
        bestTraitId = traitId;
      }
    });
    if (bestTraitId) {
      const base =
        selectedPractice.traits.find((t: QuizTrait) => t.id === bestTraitId) || null;
      if (!base) return null;
      const tKey = String(selectedPractice.tKey || "");
      const traitIdx = selectedPractice.traits.findIndex(
        (t: QuizTrait) => t.id === bestTraitId
      );
      const locTrait =
        traitIdx >= 0 ? getSelfDiscoveryTraitEn(tKey, traitIdx) : null;
      return {
        ...base,
        title: (locTrait?.title || base.id).trim(),
        description: locTrait?.description ?? base.description ?? "",
      };
    }
    return null;
  };

  const filteredReflections = reflectionQuestions;

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { role: "user", text: chatInput.trim() }]);
    setChatInput("");
  }, [chatInput]);

  const regenerateLastAI = useCallback(() => {
    setChatMessages((prev) => {
      const lastAiIdx = prev.findLastIndex((m) => m.role === "ai");
      if (lastAiIdx === -1) return prev;
      const random = filteredReflections[Math.floor(Math.random() * filteredReflections.length)];
      if (!random) return prev;
      const updated = [...prev];
      updated[lastAiIdx] = { ...updated[lastAiIdx], text: random.title, feedback: null };
      return updated;
    });
  }, [filteredReflections]);

  const setFeedback = useCallback((index: number, fb: "like" | "dislike") => {
    setChatMessages((prev) => {
      const updated = [...prev];
      const current = updated[index];
      updated[index] = { ...current, feedback: current.feedback === fb ? null : fb };
      return updated;
    });
  }, []);

  // --- Analyze ---

  const canAnalyze = (() => {
    if (loading) return false;
    switch (practiceType) {
      case "journaling":
        return !!selectedPractice && journalAnswers.some((a) => a.answer?.trim());
      case "self-discovery":
        return !!selectedPractice && questionAnswers.length > 0;
      case "reflection":
        return chatMessages.some((m) => m.role === "user" && m.text.trim());
      case "check-in":
        return !!checkInMood;
      default:
        return false;
    }
  })();

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    try {
      setLoading(true);
      setError("");
      setAiResponseData(null);
      setCheckInResult(null);

      const getPracticeLabel = () => {
        if (practiceType === "journaling" || practiceType === "self-discovery") {
          if (!selectedPractice) return practiceType;
          if (practiceType === "self-discovery") {
            const enTitle = getSelfDiscoveryTitleEn(
              String(selectedPractice.tKey || "")
            );
            if (enTitle) return enTitle;
          }
          const title =
            selectedPractice.title ?? selectedPractice.tKey ?? selectedPractice.id ?? "";
          return stripHtmlTags(String(title));
        }
        if (practiceType === "reflection") return "Reflection";
        if (practiceType === "check-in") return `Check-in (${checkInMood})`;
        return String(practiceType);
      };

      const buildAiData = (
        functionName: string,
        result: SessionSubmitResult,
        extra?: Record<string, unknown>,
      ) => {
        const output = result.smart_summary?.output;
        return {
          success: true,
          function: functionName,
          result: output
            ? {
                insight: output.insight,
                advice: output.advice,
                affirmation: output.affirmation,
                summary: output.summary,
              }
            : {
                summary:
                  "No smart summary generated for this session (skip/fallback).",
              },
          raw_session_result: result,
          ...extra,
        };
      };

      const recordPractice = (
        practiceLabel: string,
        aiResponse: unknown,
        debug: Omit<
          CompletedPracticeEntry,
          "id" | "at" | "practiceType" | "practiceLabel" | "aiResponse"
        > = {},
      ) => {
        const entry: CompletedPracticeEntry = {
          id: newPracticeHistoryId(),
          at: new Date().toISOString(),
          practiceType: practiceType as Exclude<PracticeType, "">,
          practiceLabel,
          aiResponse,
          ...debug,
        };
        setPracticeHistory((prev) => {
          const base = prev.length > 0 ? prev : loadPracticeHistory();
          const next = [entry, ...base].slice(0, PRACTICE_HISTORY_LIMIT);
          savePracticeHistory(next);
          return next;
        });
      };

      // Use canonical memory check-in flow (local-first):
      // submit session via memory hooks, then render summary.
      if (practiceType === "check-in") {
        if (!simUserId || !checkInMood) {
          setError("Missing user or mood for memory check-in flow.");
          return;
        }
        const now = new Date();
        const emotions: Emotion[] = selectedEmotions.map((label) => ({
          tKey: `emotion.${label}`,
          label,
        }));
        const triggers: Tag[] = selectedTags.map((label) => ({
          tKey: `trigger.${label}`,
          label,
          categoryId: "sim",
        }));
        const memoryRequest: SessionSubmitInput = {
          session_id: generateUuid(),
          user_id: simUserId,
          started_at: new Date(now.getTime() - 60_000),
          completed_at: now,
          event_type: "mood",
          check_in: {
            mood: checkInMood,
            reflection: checkInNote || undefined,
          },
          selected_emotions: emotions,
          selected_triggers: triggers,
          client_metadata: SIM_CLIENT_METADATA,
        };
        const memoryBefore = await capturePracticeMemorySnapshot();
        const result = await submitSession(memoryRequest);
        setCheckInResult(result);
        await refreshCheckInItems();
        await refreshInlineMemory();
        const memoryAfter = await capturePracticeMemorySnapshot();

        const aiData = buildAiData("memory_session_submit", result);
        setAiResponseData(aiData);
        recordPractice(getPracticeLabel(), aiData, {
          practiceInput: {
            mood: checkInMood,
            emotions: selectedEmotions,
            tags: selectedTags,
            note: checkInNote,
          },
          memoryRequest,
          memoryBefore,
          memoryAfter,
          memoryResult: result,
        });
        return;
      }

      if (practiceType === "journaling") {
        if (!simUserId || !selectedPractice) {
          setError("Missing user or journal for memory journaling flow.");
          return;
        }
        const answered = journalAnswers.filter((a) => a.answer?.trim());
        const practiceLabel = getPracticeLabel();
        const userText = answered
          .map((entry) => `Q: ${entry.question}\nA: ${entry.answer?.trim()}`)
          .join("\n\n");
        const now = new Date();
        const memoryRequest: SessionSubmitInput = {
          session_id: generateUuid(),
          user_id: simUserId,
          started_at: new Date(now.getTime() - 60_000),
          completed_at: now,
          event_type: "journaling",
          check_in: {
            mood: "ok",
            reflection: userText,
          },
          user_stated_text: userText,
          selected_triggers: toMemoryTags([
            practiceLabel,
            ...answered.map((entry) => entry.question),
          ]),
          practice_specific: {
            practice_id: String(selectedPractice.id ?? practiceLabel),
            effectiveness_self_report: null,
            duration_seconds: null,
          },
          client_metadata: SIM_CLIENT_METADATA,
        };
        const memoryBefore = await capturePracticeMemorySnapshot();
        const result = await submitSession(memoryRequest);
        await refreshInlineMemory();
        const memoryAfter = await capturePracticeMemorySnapshot();
        const aiData = buildAiData("memory_session_submit_journal", result, {
          journal_entries: answered,
        });
        setAiResponseData(aiData);
        recordPractice(practiceLabel, aiData, {
          practiceInput: {
            selectedPractice,
            journalAnswers: answered,
            userText,
          },
          memoryRequest,
          memoryBefore,
          memoryAfter,
          memoryResult: result,
        });
        return;
      }

      if (practiceType === "self-discovery") {
        if (!simUserId || !selectedPractice) {
          setError("Missing user or quiz for memory self-discovery flow.");
          return;
        }
        const quizTrait = calculateQuizTrait();
        if (!quizTrait) {
          setError("Missing quiz result for memory self-discovery flow.");
          return;
        }
        const practiceLabel = getPracticeLabel();
        const answerText = questionAnswers
          .map((answer) => `Answer: ${answer.label}`)
          .join("\n");
        const userText = [
          `Self-discovery practice: ${practiceLabel}`,
          `Result: ${quizTrait.title}`,
          quizTrait.description ? `Interpretation: ${quizTrait.description}` : "",
          answerText,
        ]
          .filter(Boolean)
          .join("\n");
        const now = new Date();
        const memoryRequest: SessionSubmitInput = {
          session_id: generateUuid(),
          user_id: simUserId,
          started_at: new Date(now.getTime() - 60_000),
          completed_at: now,
          event_type: "question",
          check_in: {
            mood: "ok",
            reflection: userText,
          },
          user_stated_text: userText,
          selected_triggers: toMemoryTags([practiceLabel, quizTrait.title]),
          practice_specific: {
            practice_id: String(selectedPractice.id ?? practiceLabel),
            effectiveness_self_report: null,
            duration_seconds: null,
          },
          client_metadata: SIM_CLIENT_METADATA,
        };
        const memoryBefore = await capturePracticeMemorySnapshot();
        const result = await submitSession(memoryRequest);
        await refreshInlineMemory();
        const memoryAfter = await capturePracticeMemorySnapshot();
        const aiData = buildAiData("memory_session_submit_self_discovery", result, {
          quiz_result: quizTrait,
          answers: questionAnswers,
        });
        setAiResponseData(aiData);
        recordPractice(practiceLabel, aiData, {
          practiceInput: {
            selectedPractice,
            quizTrait,
            answers: questionAnswers,
            userText,
          },
          memoryRequest,
          memoryBefore,
          memoryAfter,
          memoryResult: result,
        });
        return;
      }

      if (practiceType === "reflection") {
        if (!simUserId) {
          setError("Missing user for memory reflection flow.");
          return;
        }
        const chatPairs: { question: string; answer: string }[] = [];
        for (let i = 0; i < chatMessages.length; i++) {
          const msg = chatMessages[i];
          if (msg.role === "ai") {
            const userMsg = chatMessages[i + 1];
            chatPairs.push({
              question: msg.text,
              answer: userMsg?.role === "user" ? userMsg.text : "",
            });
          }
        }
        const answered = chatPairs.filter((p) => p.answer.trim());
        const userText = answered
          .map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`)
          .join("\n\n");
        const feedback = chatMessages
          .filter((m) => m.role === "ai" && m.feedback)
          .map((m) => ({ question: m.text, feedback: m.feedback }));
        const now = new Date();
        const memoryRequest: ReflectionSubmitInput = {
          session_id: generateUuid(),
          user_id: simUserId,
          started_at: new Date(now.getTime() - 60_000),
          completed_at: now,
          event_type: "reflection",
          check_in: {
            mood: "ok",
            reflection: userText,
          },
          user_stated_text: userText,
          selected_triggers: toMemoryTags([
            selectedReflection?.title ?? "Reflection",
            ...answered.map((pair) => pair.question),
          ]),
          practice_specific: {
            practice_id: selectedReflection?.id ?? "reflection",
            effectiveness_self_report: null,
            duration_seconds: null,
          },
          client_metadata: SIM_CLIENT_METADATA,
        };
        const memoryBefore = await capturePracticeMemorySnapshot();
        const reflection = await submitReflection(memoryRequest);
        await refreshInlineMemory();
        const memoryAfter = await capturePracticeMemorySnapshot();
        const aiData = buildAiData(
          "memory_reflection_submit",
          reflection.session,
          {
            reflection_summary: { chat: answered, feedback },
            reinforced_items: reflection.reinforced_items,
            signal_results: reflection.signal_results,
          },
        );
        setAiResponseData(aiData);
        recordPractice("Reflection", aiData, {
          practiceInput: {
            selectedReflection,
            chatMessages,
            chat: answered,
            feedback,
            userText,
          },
          memoryRequest,
          memoryBefore,
          memoryAfter,
          memoryResult: reflection,
        });
        return;
      }

      setError("Unsupported practice type for canonical memory flow.");
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInResonance = useCallback(
    async (kind: "like" | "dislike" | "echo_save") => {
      if (!checkInResult) return;
      const card = {
        ...checkInResult.session_card,
        reaction_to_output: {
          ...checkInResult.session_card.reaction_to_output,
          liked:
            kind === "like"
              ? true
              : checkInResult.session_card.reaction_to_output.liked,
          disliked:
            kind === "dislike"
              ? true
              : checkInResult.session_card.reaction_to_output.disliked,
          echo_saved:
            kind === "echo_save"
              ? true
              : checkInResult.session_card.reaction_to_output.echo_saved,
        },
      };
      await memoryStorage.saveSessionCard(card);
      setCheckInResult({ ...checkInResult, session_card: card });
    },
    [checkInResult, memoryStorage],
  );

  const handleCheckInTruthReaction = useCallback(
    async (
      item: MemoryItem,
      action: "yes_that_fits" | "not_quite" | "not_anymore" | "hide",
    ) => {
      await submitMemoryFeedback({
        item,
        action,
        context_surface: "smart_summary",
      });
      await refreshCheckInItems();
    },
    [submitMemoryFeedback, refreshCheckInItems],
  );

  // --- Render forms ---

  const renderJournalingForm = () => {
    if (!selectedPractice) return null;
    const templates = selectedPractice.pages?.[0]?.templates || [];
    if (templates.length === 0) {
      return (
        <div className="space-y-2">
          <Label htmlFor="journal-freeform">
            {stripHtmlTags(selectedPractice.title || "Write your journal entry")}
          </Label>
          <Textarea
            id="journal-freeform"
            placeholder="Type your journal entry here..."
            value={journalAnswers[0]?.answer || ""}
            onChange={(e) => handleJournalAnswerChange(0, e.target.value)}
            className="min-h-[200px]"
          />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {templates.map((template: string, index: number) => (
          <div key={index} className="space-y-2">
            <Label htmlFor={`journal-${index}`}>{stripHtmlTags(template)}</Label>
            <Textarea
              id={`journal-${index}`}
              placeholder="Type your answer here..."
              value={journalAnswers[index]?.answer || ""}
              onChange={(e) => handleJournalAnswerChange(index, e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderSelfDiscoveryForm = () => {
    if (!selectedPractice) return null;
    const tKey = String(selectedPractice.tKey || "");
    return (
      <div className="space-y-6">
        {selectedPractice.pages?.map((page: any, pageIndex: number) => {
          if (page.component !== "question") return null;
          const loc = getSelfDiscoveryPageEn(tKey, pageIndex);
          const descriptionDisplay =
            loc?.description?.trim() ||
            (page.description ? stripHtmlTags(page.description) : "");
          const selectedAnswerForPage = questionAnswers.find((a) =>
            page.questions?.some((q: any) => q.id === a.questionId)
          );
          return (
            <div key={pageIndex} className="space-y-3 rounded-lg border p-4">
              {descriptionDisplay ? (
                <p className="text-sm font-medium mb-3 whitespace-pre-wrap">
                  {descriptionDisplay}
                </p>
              ) : null}
              <RadioGroup
                value={selectedAnswerForPage?.questionId || ""}
                onValueChange={(value) => {
                  const question = page.questions?.find((q: any) => q.id === value);
                  if (question) {
                    const qIdx =
                      page.questions?.findIndex((q: any) => q.id === value) ?? -1;
                    const labelText =
                      (qIdx >= 0
                        ? getSelfDiscoveryQuestionLabelEn(tKey, pageIndex, qIdx)
                        : null) ?? stripHtmlTags(question.label || question.id);
                    handleQuestionAnswerChange(question.id, question.weights, labelText);
                  }
                }}
              >
                <div className="space-y-2">
                  {page.questions?.map((question: any, qIdx: number) => {
                    const labelText =
                      getSelfDiscoveryQuestionLabelEn(tKey, pageIndex, qIdx) ??
                      stripHtmlTags(question.label || question.id);
                    return (
                      <div key={question.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={question.id} id={question.id} />
                        <Label htmlFor={question.id} className="cursor-pointer font-normal">
                          {labelText}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>
          );
        })}
      </div>
    );
  };

  const initReflectionChat = useCallback(() => {
    const pool = reflectionQuestions;
    if (pool.length === 0) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    setSelectedReflection(random);
    setChatMessages([
      { role: "ai", text: "Hi, it's always a pleasure to see you!" },
      { role: "ai", text: random.title },
    ]);
    setChatInput("");
  }, []);

  // Auto-start chat when reflection is selected
  useEffect(() => {
    if (practiceType === "reflection" && chatMessages.length === 0) {
      initReflectionChat();
    }
  }, [practiceType, chatMessages.length, initReflectionChat]);

  const renderReflectionForm = () => {
    const regenerateFirstQuestion = () => {
      const pool = filteredReflections.filter((q) => q.id !== selectedReflection?.id);
      const source = pool.length > 0 ? pool : filteredReflections;
      const random = source[Math.floor(Math.random() * source.length)];
      setSelectedReflection(random);
      setChatMessages([
        { role: "ai", text: "Hi, it's always a pleasure to see you!" },
        { role: "ai", text: random.title },
      ]);
      setChatInput("");
    };

    return (
      <div className="space-y-4">
        {/* Chat thread */}
        {chatMessages.length > 0 && (
          <div className="rounded-lg border">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`px-4 py-3 ${msg.role === "ai" ? "bg-muted/30" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${msg.role === "ai" ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground"
                      }`}>
                      {msg.role === "ai" ? "AI" : "You"}
                    </span>
                    <p className="text-sm flex-1">{msg.text}</p>
                  </div>
                  {msg.role === "ai" && i > 0 && (
                    <div className="flex items-center gap-1 mt-2 ml-8">
                      <button
                        type="button"
                        onClick={() => setFeedback(i, "like")}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${msg.feedback === "like" ? "bg-green-100 text-green-700" : "hover:bg-muted text-muted-foreground"
                          }`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedback(i, "dislike")}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${msg.feedback === "dislike" ? "bg-red-100 text-red-700" : "hover:bg-muted text-muted-foreground"
                          }`}
                      >
                        👎
                      </button>
                      {i === chatMessages.findLastIndex((m) => m.role === "ai") && (
                        <button
                          type="button"
                          onClick={i === 1 ? regenerateFirstQuestion : regenerateLastAI}
                          className="px-2 py-0.5 rounded text-xs hover:bg-muted text-muted-foreground transition-colors"
                        >
                          🔄 Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                placeholder="Type your message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                className="flex-1"
              />
              <Button size="sm" onClick={sendChatMessage} disabled={!chatInput.trim()}>
                Send
              </Button>
            </div>

            {/* Actions */}
            <div className="border-t px-3 py-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={initReflectionChat}
              >
                Reset chat
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCheckInForm = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>memory user:</span>
        <code className="rounded bg-muted px-2 py-0.5">{simUserId ?? "…"}</code>
        <Badge variant={memorySubscription.isPremiumActive ? "default" : "outline"}>
          premium {memorySubscription.isPremiumActive ? "ON" : "OFF"}
        </Badge>
      </div>
      <div className="space-y-2">
        <Label>How are you feeling?</Label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => setCheckInMood(mood)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${checkInMood === mood
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border hover:border-primary/50"
                }`}
            >
              {MOOD_LABELS[mood]}
            </button>
          ))}
        </div>
      </div>

      {checkInMood && (
        <>
          <div className="space-y-3">
            <Label>Emotions <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <p className="text-xs text-muted-foreground">
              First: emotions for this mood, then all others (same catalog as the app).
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">For this mood</p>
                <div className="flex flex-wrap gap-2">
                  {checkInEmotionGroups.primary.map((emotion) => (
                    <button
                      key={emotion.tKey}
                      type="button"
                      onClick={() => toggleEmotion(emotion.label)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${selectedEmotions.includes(emotion.label)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/50"
                        } ${!emotion.isVisible ? "opacity-80" : ""}`}
                      title={emotion.isVisible ? undefined : "Extra emotion (hidden chip in app)"}
                    >
                      {emotion.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Other moods</p>
                <div className="flex flex-wrap gap-2">
                  {checkInEmotionGroups.others.map((emotion) => (
                    <button
                      key={emotion.tKey}
                      type="button"
                      onClick={() => toggleEmotion(emotion.label)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${selectedEmotions.includes(emotion.label)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/50"
                        } ${!emotion.isVisible ? "opacity-80" : ""}`}
                      title={emotion.isVisible ? undefined : "Extra emotion (hidden chip in app)"}
                    >
                      {emotion.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Tags <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {checkInTagCategories.map((category) => {
              const catTags = tagsForCategory(category.id);
              return (
                <div key={category.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{category.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {catTags.map((tag) => (
                      <button
                        key={tag.tKey}
                        type="button"
                        onClick={() => toggleTag(tag.label)}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${selectedTags.includes(tag.label)
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:border-primary/50"
                          }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="check-in-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="check-in-note"
              placeholder="Anything you want to add..."
              value={checkInNote}
              onChange={(e) => setCheckInNote(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </>
      )}
    </div>
  );

  // --- Profile summary ---

  const profileSummary = (() => {
    const parts: string[] = [];
    if (profile.name) parts.push(profile.name);
    if (profile.primary_motivation.length)
      parts.push(profile.primary_motivation.join(", "));
    if (profile.pain_map.length) parts.push(profile.pain_map.join(", "));
    if (profile.focus_areas.length) parts.push(profile.focus_areas.join(", "));
    if (profile.support_style) parts.push(profile.support_style);
    if (profile.realistic_action_modes.length)
      parts.push(profile.realistic_action_modes.join(", "));
    if (profile.daily_time_budget) parts.push(profile.daily_time_budget);
    if (profile.support_timing_preference)
      parts.push(profile.support_timing_preference);
    if (profile.avoided_topics.length)
      parts.push(profile.avoided_topics.join(", "));
    return parts.length > 0 ? parts.join(" · ") : "Not configured";
  })();

  const memoryScreenView = useMemo(
    () => projectMemoryScreen({ items: checkInItems, now: new Date() }),
    [checkInItems],
  );

  const handleInlineMemoryReaction = useCallback(
    async (
      projection: MemoryCardProjection,
      action: "yes_that_fits" | "not_quite" | "not_anymore" | "hide",
    ) => {
      await submitMemoryFeedback({
        item: projection.item,
        action,
        context_surface: "memory_screen",
      });
      await refreshInlineMemory();
    },
    [refreshInlineMemory, submitMemoryFeedback],
  );

  const renderMemoryProjection = (projection: MemoryCardProjection) => (
    <div
      key={projection.item.id}
      className="rounded-md border bg-background p-3 text-sm"
      style={{ opacity: projection.opacity }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {projection.tier_label ? (
          <Badge variant="outline">{projection.tier_label}</Badge>
        ) : null}
        <Badge variant="secondary">{projection.item.type}</Badge>
      </div>
      <p className="mt-2 font-medium">
        {projection.softener ? `${projection.softener}: ` : ""}
        {projection.item.statement_user_facing ??
          projection.item.statement_internal}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isApplyingFeedback}
          onClick={() =>
            handleInlineMemoryReaction(projection, "yes_that_fits")
          }
        >
          Yes, that fits
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isApplyingFeedback}
          onClick={() => handleInlineMemoryReaction(projection, "not_quite")}
        >
          Not quite
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isApplyingFeedback}
          onClick={() => handleInlineMemoryReaction(projection, "not_anymore")}
        >
          Not anymore
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isApplyingFeedback}
          onClick={() => handleInlineMemoryReaction(projection, "hide")}
        >
          Hide
        </Button>
      </div>
    </div>
  );

  // ======================================================================
  // RENDER
  // ======================================================================

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">AI Practice Tester</h1>
            <p className="text-muted-foreground">
              Test AI summary generation with all practice types
            </p>
          </div>

          {/* Onboarding Profile */}
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setProfileOpen((v) => !v)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    User Profile (Onboarding)
                    <span className="text-xs font-normal text-muted-foreground">
                      saved to localStorage
                    </span>
                  </CardTitle>
                  {!profileOpen && (
                    <CardDescription className="mt-1 truncate max-w-[600px]">
                      {profileSummary}
                    </CardDescription>
                  )}
                </div>
                <span className="text-muted-foreground text-sm">
                  {profileOpen ? "▲ Collapse" : "▼ Expand"}
                </span>
              </div>
            </CardHeader>

            {profileOpen && (
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="text-sm font-semibold">
                    Як тебе звати?
                  </Label>
                  <Input
                    id="profile-name"
                    placeholder="Введи своє ім'я"
                    value={profile.name}
                    onChange={(e) => updateProfile("name", e.target.value)}
                    className="max-w-xs"
                  />
                </div>

                {questionOrder.filter((k) => k !== "name").map((key) => {
                  const q =
                    onboardingQuestions[key as Exclude<keyof OnboardingProfile, "name">];
                  if (q.type === "single") {
                    return (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm font-semibold">{q.title}</Label>
                        {q.subtitle && (
                          <p className="text-xs text-muted-foreground">{q.subtitle}</p>
                        )}
                        <RadioGroup
                          value={(profile[key] as string) || ""}
                          onValueChange={(val) => updateProfile(key, val)}
                          className="flex flex-wrap gap-2"
                        >
                          {q.options.map((opt) => (
                            <div key={opt} className="flex items-center gap-1.5">
                              <RadioGroupItem value={opt} id={`${key}-${opt}`} />
                              <Label
                                htmlFor={`${key}-${opt}`}
                                className="cursor-pointer font-normal text-sm"
                              >
                                {opt}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    );
                  }
                  const selected = profile[key] as string[];
                  const atCap =
                    typeof q.maxSelect === "number" && selected.length >= q.maxSelect;
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm font-semibold">{q.title}</Label>
                      {q.subtitle && (
                        <p className="text-xs text-muted-foreground">{q.subtitle}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => {
                          const checked = selected.includes(opt);
                          const disabled = !checked && atCap;
                          return (
                            <div key={opt} className="flex items-center gap-1.5">
                              <Checkbox
                                id={`${key}-${opt}`}
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={() =>
                                  toggleMulti(key, opt, q.maxSelect)
                                }
                              />
                              <Label
                                htmlFor={`${key}-${opt}`}
                                className={`cursor-pointer font-normal text-sm ${disabled ? "text-muted-foreground/60" : ""
                                  }`}
                              >
                                {opt}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Submit runs canonical onboarding memory flow:
                      <code className="ml-1 rounded bg-muted px-1">
                        useOnboardingSubmit
                      </code>
                    </p>
                    <p>
                      sim user:{" "}
                      <code className="rounded bg-muted px-1">
                        {simUserId ?? "loading..."}
                      </code>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onboardingSubmitError ? (
                      <Badge variant="destructive">
                        Error: {onboardingSubmitError.message}
                      </Badge>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={handleSubmitOnboarding}
                      disabled={isSubmittingOnboarding || !simUserId}
                    >
                      {isSubmittingOnboarding
                        ? "Submitting..."
                        : "Submit onboarding to memory"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetProfile}>
                      Reset Profile
                    </Button>
                  </div>
                </div>

                {lastOnboardingItems ? (
                  <div className="rounded-md border bg-muted/10 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          Persisted memory items · {lastOnboardingItems.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created from onboarding answers via SSOT D.1.2.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {lastOnboardingItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border bg-background p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{item.type}</Badge>
                            <Badge variant="outline">
                              conf {item.confidence.toFixed(2)}
                            </Badge>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                          <p className="mt-2 font-medium">
                            {item.statement_user_facing}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.statement_internal}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {lastOnboardingProfile ? (
                  <div className="rounded-md border bg-muted/10 p-3">
                    <p className="mb-2 text-sm font-medium">
                      Stable profile snapshot
                    </p>
                    <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {formatJson(lastOnboardingProfile)}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            )}
          </Card>

          {/* Memory screen + debug inline accordions */}
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={toggleMemoryInspector}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Your Personalization
                    <span className="text-xs font-normal text-muted-foreground">
                      inline memory screen
                    </span>
                  </CardTitle>
                  {!memoryInspectorOpen && (
                    <CardDescription className="mt-1">
                      {checkInItems.length} memory items available for this sim user
                    </CardDescription>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {memoryInspectorOpen ? "▲ Collapse" : "▼ Expand"}
                </span>
              </div>
            </CardHeader>
            {memoryInspectorOpen && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>sim user:</span>
                    <code className="rounded bg-muted px-2 py-0.5">
                      {simUserId ?? "loading..."}
                    </code>
                    <Badge
                      variant={
                        memorySubscription.isPremiumActive ? "default" : "outline"
                      }
                    >
                      premium {memorySubscription.isPremiumActive ? "ON" : "OFF"}
                    </Badge>
                    {memoryProfileSnapshot ? (
                      <Badge variant="outline">
                        level {memoryProfileSnapshot.confidence_level}
                      </Badge>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      void refreshInlineMemory();
                    }}
                  >
                    Refresh memory
                  </Button>
                </div>

                {checkInItems.length === 0 ? (
                  <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    No memory yet. Submit onboarding above, then run a check-in.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Basics</p>
                        <p className="text-xs text-muted-foreground">
                          Facts, preferences, constraints and boundaries.
                        </p>
                      </div>
                      {[
                        ...memoryScreenView.basics.facts,
                        ...memoryScreenView.basics.declared_preferences,
                        ...memoryScreenView.boundaries,
                      ].length > 0 ? (
                        [
                          ...memoryScreenView.basics.facts,
                          ...memoryScreenView.basics.declared_preferences,
                          ...memoryScreenView.boundaries,
                        ].map(renderMemoryProjection)
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No visible basics yet.
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">What tends to help</p>
                        <p className="text-xs text-muted-foreground">
                          Confirmed insights and active hypotheses.
                        </p>
                      </div>
                      {memoryScreenView.helps.length > 0 ? (
                        memoryScreenView.helps.map(renderMemoryProjection)
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No help patterns yet.
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 lg:col-span-2">
                      <div>
                        <p className="text-sm font-medium">Patterns I&apos;m noticing</p>
                        <p className="text-xs text-muted-foreground">
                          Recent observations shown with soft language.
                        </p>
                      </div>
                      {memoryScreenView.patterns.length > 0 ? (
                        memoryScreenView.patterns.map(renderMemoryProjection)
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No recent patterns yet.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {memoryScreenView.hidden_count > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {memoryScreenView.hidden_count} low-confidence or hidden item(s)
                    are excluded from this user-facing projection.
                  </p>
                ) : null}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={toggleMemoryDebug}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Memory debug
                    <span className="text-xs font-normal text-muted-foreground">
                      inline state/logs
                    </span>
                  </CardTitle>
                  {!memoryDebugOpen && (
                    <CardDescription className="mt-1">
                      Raw memory state, recent summaries, stable profile and telemetry.
                    </CardDescription>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {memoryDebugOpen ? "▲ Collapse" : "▼ Expand"}
                </span>
              </div>
            </CardHeader>
            {memoryDebugOpen && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">items {checkInItems.length}</Badge>
                    <Badge variant="secondary">
                      summaries {memorySummaries.length}
                    </Badge>
                    <Badge variant="secondary">
                      telemetry {memoryTelemetrySnapshot.length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCleanEverything();
                      }}
                    >
                      Clean everything
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownloadMemoryDebug();
                      }}
                    >
                      Download .txt
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void refreshInlineMemory();
                      }}
                    >
                      Refresh debug
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Stable profile</p>
                    <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {formatJson(memoryProfileSnapshot)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent summaries</p>
                    <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {formatJson(memorySummaries)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Active memory items</p>
                    <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {formatJson(checkInItems)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Telemetry tail</p>
                    <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {formatJson(memoryTelemetrySnapshot)}
                    </pre>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium">Storage dump</p>
                    <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                      {formatJson(memoryStorageDump)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Practice type (this page only — uses canonical local-first memory flow) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Practice type</CardTitle>
              <CardDescription>
                Choose what to send to the AI tester below. Click again to clear.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {PRACTICE_CARDS.map((card) => (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => handlePracticeTypeChange(card.type)}
                  title={card.description}
                  className={cn(
                    "flex min-w-[140px] flex-1 flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition-colors sm:min-w-[160px]",
                    practiceType === card.type
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:bg-muted/60",
                  )}
                >
                  <span className="text-lg leading-none">{card.icon}</span>
                  <span className="mt-1 font-medium">{card.title}</span>
                  <span className="text-[11px] text-muted-foreground">{card.count}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Practice Setup + Response */}
          {practiceType && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                {(practiceType === "journaling" || practiceType === "self-discovery") && (
                  <CardHeader>
                    <CardTitle>
                      {PRACTICE_CARDS.find((c) => c.type === practiceType)?.title}
                    </CardTitle>
                    <CardDescription>
                      {practiceType === "journaling" && "Select a journal and fill in the prompts"}
                      {practiceType === "self-discovery" && "Select a quiz and answer the questions"}
                    </CardDescription>
                  </CardHeader>
                )}
                <CardContent className="space-y-4">
                  {/* Practice selector for journaling & self-discovery */}
                  {(practiceType === "journaling" || practiceType === "self-discovery") && (
                    <div className="space-y-2">
                      <Label>
                        {practiceType === "journaling" ? "Journal" : "Quiz"}
                      </Label>
                      <Select
                        value={selectedPractice?.id || ""}
                        onValueChange={handlePracticeChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a practice..." />
                        </SelectTrigger>
                        <SelectContent>
                          {practiceType === "journaling"
                            ? journals.map((journal) => (
                              <SelectItem key={journal.id} value={journal.id}>
                                {stripHtmlTags(journal.title)}
                              </SelectItem>
                            ))
                            : questionsNe.map((question) => (
                              <SelectItem key={question.id} value={question.id}>
                                {getSelfDiscoveryTitleEn(String(question.tKey || "")) ||
                                  stripHtmlTags(question.title || question.tKey)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Forms */}
                  <div className="max-h-[500px] overflow-y-auto">
                    {practiceType === "journaling" && selectedPractice && renderJournalingForm()}
                    {practiceType === "self-discovery" && selectedPractice && renderSelfDiscoveryForm()}
                    {practiceType === "reflection" && renderReflectionForm()}
                    {practiceType === "check-in" && renderCheckInForm()}
                  </div>

                  <Button
                    onClick={handleAnalyze}
                    disabled={
                      !canAnalyze ||
                      isSubmittingSession ||
                      isSubmittingReflection
                    }
                    className="w-full"
                  >
                    {practiceType === "check-in"
                      ? isSubmittingSession
                        ? "Submitting check-in..."
                        : "Submit check-in (Memory flow)"
                      : isSubmittingSession || isSubmittingReflection
                        ? "Submitting to memory..."
                      : loading
                        ? "Analyzing..."
                        : "Submit via Memory flow"}
                  </Button>
                </CardContent>
              </Card>

              {/* Response Section */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Response</CardTitle>
                  <CardDescription>
                    {practiceType === "check-in"
                      ? "Canonical memory check-in flow (session submit -> smart summary -> memory feedback)."
                      : "Canonical memory session flow (session submit -> retrieval -> smart summary)."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="rounded-md bg-destructive/10 p-4 text-destructive mb-4">
                      <p className="text-sm font-medium">Error</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  {practiceType === "check-in" && checkInResult && (
                    <div className="mb-6 space-y-4">
                      {!checkInResult.smart_summary ? (
                        <p className="text-sm text-muted-foreground">
                          No smart summary was produced for this session.
                        </p>
                      ) : (
                        <>
                          <SummaryCardBlock
                            subTitle="Insight"
                            title={checkInResult.smart_summary.output.insight}
                            isFocused
                          />
                          <SummaryCardBlock
                            subTitle="Advice"
                            title={checkInResult.smart_summary.output.advice}
                            isFocused
                          />
                          <SummaryCardBlock
                            subTitle="Affirmation"
                            title={checkInResult.smart_summary.output.affirmation}
                            isFocused
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCheckInResonance("like")}
                            >
                              Like
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCheckInResonance("dislike")}
                            >
                              Dislike
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCheckInResonance("echo_save")}
                            >
                              Echo save
                            </Button>
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Active memory items ({checkInItems.length})
                        </p>
                        {checkInItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No items yet. Run onboarding first.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {checkInItems.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-md border bg-muted/20 p-3 text-sm"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{item.type}</Badge>
                                  <Badge variant="outline">
                                    conf {item.confidence.toFixed(2)}
                                  </Badge>
                                  <Badge variant="outline">{item.status}</Badge>
                                </div>
                                <p className="mt-2">
                                  {item.statement_user_facing ?? item.statement_internal}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isApplyingFeedback}
                                    onClick={() =>
                                      handleCheckInTruthReaction(item, "yes_that_fits")
                                    }
                                  >
                                    Yes
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isApplyingFeedback}
                                    onClick={() =>
                                      handleCheckInTruthReaction(item, "not_quite")
                                    }
                                  >
                                    Not quite
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isApplyingFeedback}
                                    onClick={() =>
                                      handleCheckInTruthReaction(item, "not_anymore")
                                    }
                                  >
                                    Not anymore
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isApplyingFeedback}
                                    onClick={() => handleCheckInTruthReaction(item, "hide")}
                                  >
                                    Hide
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {hasParsedSummaryBlocks &&
                    parsedAiSummary &&
                    !(practiceType === "check-in" && checkInResult) && (
                    <div className="space-y-3 mb-6">
                      {parsedAiSummary.summary ? (
                        <SummaryCardBlock
                          subTitle="Summary"
                          title={parsedAiSummary.summary}
                          isFocused
                        />
                      ) : (
                        <>
                          {parsedAiSummary.insight && (
                            <SummaryCardBlock
                              subTitle="Insight"
                              title={parsedAiSummary.insight}
                              isFocused
                            />
                          )}
                          {parsedAiSummary.advice && (
                            <SummaryCardBlock
                              subTitle="Advice"
                              title={parsedAiSummary.advice}
                              isFocused
                            />
                          )}
                          {parsedAiSummary.affirmation && (
                            <SummaryCardBlock
                              subTitle="Affirmation"
                              title={parsedAiSummary.affirmation}
                              isFocused
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {aiResponseData != null ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Full JSON response
                      </p>
                      <pre className="rounded-md bg-muted p-4 overflow-auto max-h-[360px] text-sm font-mono">
                        {JSON.stringify(aiResponseData, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  {aiResponseData == null && !error && !loading && (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <p className="text-center">
                        Fill out the practice form and click &quot;Analyze with AI&quot; to see results
                      </p>
                    </div>
                  )}

                  {loading && (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p>Processing...</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Completed practices</CardTitle>
                <CardDescription>
                  Full AI + memory debug history (localStorage, max {PRACTICE_HISTORY_LIMIT})
                </CardDescription>
              </div>
              {practiceHistory.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const exportedAt = new Date().toISOString();
                      downloadTextFile(
                        completedPracticeFilename(
                          "mindjar-completed-practices",
                          "all",
                          exportedAt,
                        ),
                        buildCompletedPracticeDebugText({
                          exportedAt,
                          entries: practiceHistory,
                        }),
                      );
                    }}
                  >
                    Download all .txt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      savePracticeHistory([]);
                      setPracticeHistory([]);
                    }}
                  >
                    Clear list
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {practiceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet — run Analyze with AI.</p>
              ) : (
                <ul className="space-y-4 text-sm">
                  {practiceHistory.map((h) => (
                    <li
                      key={h.id}
                      className="border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.at).toLocaleString()}
                      </div>
                      <div className="font-medium">
                        {h.practiceType}
                        {h.practiceLabel ? ` · ${h.practiceLabel}` : ""}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          const exportedAt = new Date().toISOString();
                          downloadTextFile(
                            completedPracticeFilename(
                              "mindjar-completed-practice",
                              `${h.practiceType}-${h.practiceLabel || h.id}`,
                              exportedAt,
                            ),
                            buildCompletedPracticeDebugText({
                              exportedAt,
                              entries: [h],
                            }),
                          );
                        }}
                      >
                        Download this .txt
                      </Button>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          AI response (JSON)
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                          {JSON.stringify(h.aiResponse, null, 2)}
                        </pre>
                      </details>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Full practice + memory debug (JSON)
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                          {JSON.stringify(
                            {
                              practiceInput: h.practiceInput,
                              memoryRequest: h.memoryRequest,
                              memoryBefore: h.memoryBefore,
                              memoryResult: h.memoryResult,
                              memoryAfter: h.memoryAfter,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

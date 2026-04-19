"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
  } catch {}
  return defaultProfile;
}

const stripHtmlTags = (text: string): string => {
  return text.replace(/<[^>]*>/g, "");
};

const PRACTICE_HISTORY_KEY = "ai-test-practice-history";
const PRACTICE_HISTORY_LIMIT = 50;

type CompletedPracticeEntry = {
  id: string;
  at: string;
  practiceType: Exclude<PracticeType, "">;
  practiceLabel: string;
  aiResponse: unknown;
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

// ======================================================================

export default function AITestPage() {
  // --- Profile ---
  const [profile, setProfile] = useState<OnboardingProfile>(defaultProfile);
  const [profileOpen, setProfileOpen] = useState(false);

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
  }, []);

  // --- Practice state ---
  const [practiceType, setPracticeType] = useState<PracticeType>("");
  const [selectedPractice, setSelectedPractice] = useState<any>(null);
  const [journalAnswers, setJournalAnswers] = useState<RichTextValue[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);

  // --- Reflection state ---
  const [selectedReflection, setSelectedReflection] = useState<ReflectionQuestion | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  // --- Check-in state ---
  const [checkInMood, setCheckInMood] = useState<Mood | "">("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [checkInNote, setCheckInNote] = useState("");

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
    setAiResponseData(null);
    setError("");
  }, []);

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

      const userId = `test-user-${Date.now()}`;
      const eventId = `test-event-${Date.now()}`;

      const hasProfile = Object.values(profile).some((v) =>
        Array.isArray(v) ? v.length > 0 : v !== ""
      );

      const payload: any = {
        userId,
        eventId,
        testMode: true,
        practiceType,
        ...(hasProfile && { onboardingProfile: profile }),
      };

      if (practiceType === "journaling") {
        payload.journalSummary = {
          journal: journalAnswers.filter((a) => a.answer?.trim()),
        };
      } else if (practiceType === "self-discovery") {
        const quizTrait = calculateQuizTrait();
        if (quizTrait) {
          payload.quizSummary = { quizEvaluation: quizTrait };
        }
      } else if (practiceType === "reflection") {
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
        payload.reflectionSummary = {
          chat: chatPairs.filter((p) => p.answer.trim()),
          feedback: chatMessages
            .filter((m) => m.role === "ai" && m.feedback)
            .map((m) => ({ question: m.text, feedback: m.feedback })),
        };
      } else if (practiceType === "check-in") {
        payload.checkInSummary = {
          mood: checkInMood,
          emotions: selectedEmotions,
          tags: selectedTags,
          note: checkInNote || undefined,
        };
      }

      const res = await fetch("/api/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: "generate_ai_summary", payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }

      const practiceLabel = (() => {
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
        if (practiceType === "check-in") {
          return checkInMood ? `Check-in (${checkInMood})` : "Check-in";
        }
        return String(practiceType);
      })();

      const entry: CompletedPracticeEntry = {
        id: newPracticeHistoryId(),
        at: new Date().toISOString(),
        practiceType: practiceType as Exclude<PracticeType, "">,
        practiceLabel,
        aiResponse: data,
      };
      setPracticeHistory((prev) => {
        const base = prev.length > 0 ? prev : loadPracticeHistory();
        const next = [entry, ...base].slice(0, PRACTICE_HISTORY_LIMIT);
        savePracticeHistory(next);
        return next;
      });

      setAiResponseData(data);
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

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
                    <span className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      msg.role === "ai" ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground"
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
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${
                          msg.feedback === "like" ? "bg-green-100 text-green-700" : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedback(i, "dislike")}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${
                          msg.feedback === "dislike" ? "bg-red-100 text-red-700" : "hover:bg-muted text-muted-foreground"
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
      <div className="space-y-2">
        <Label>How are you feeling?</Label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => setCheckInMood(mood)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                checkInMood === mood
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
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        selectedEmotions.includes(emotion.label)
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
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        selectedEmotions.includes(emotion.label)
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
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                          selectedTags.includes(tag.label)
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

  // ======================================================================
  // RENDER
  // ======================================================================

  return (
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
                            className={`cursor-pointer font-normal text-sm ${
                              disabled ? "text-muted-foreground/60" : ""
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

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={resetProfile}>
                Reset Profile
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Practice Type Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {PRACTICE_CARDS.map((card) => (
          <button
            key={card.type}
            type="button"
            onClick={() => handlePracticeTypeChange(card.type)}
            className={`text-left rounded-xl border-2 p-4 transition-all ${
              practiceType === card.type
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
            }`}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="font-semibold text-sm">{card.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.description}</div>
            <div className="text-xs text-muted-foreground mt-2 font-medium">{card.count}</div>
          </button>
        ))}
      </div>

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
                disabled={!canAnalyze}
                className="w-full"
              >
                {loading ? "Analyzing..." : "Analyze with AI"}
              </Button>
            </CardContent>
          </Card>

          {/* Response Section */}
          <Card>
            <CardHeader>
              <CardTitle>AI Response</CardTitle>
              <CardDescription>Generated insight, advice, and affirmation</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="rounded-md bg-destructive/10 p-4 text-destructive mb-4">
                  <p className="text-sm font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {hasParsedSummaryBlocks && parsedAiSummary && (
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
              Simple list with full AI response (localStorage, max {PRACTICE_HISTORY_LIMIT})
            </CardDescription>
          </div>
          {practiceHistory.length > 0 && (
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
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      AI response (JSON)
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                      {JSON.stringify(h.aiResponse, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

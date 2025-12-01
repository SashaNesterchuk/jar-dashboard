import { journals, questionJournals } from "./journalEvents";

export const onboardingDiary = {
  id: "onboardingJournal",
  title: "Onboarding Journal",
  ball: "diary",
  tKey: "onboardingJournal",
  categoryId: "onboarding",
  type: "journaling",
  slotsForAIGeneration: ["morning"],
  pages: [
    {
      component: "editor",
      questionOneByOne: [
        "What do I want to focus on today?",
        "What could get in the way today, and how can I respond?",
        "What could make today feel better?",
      ],
    },
  ],
};

export const onboardingQuestions = {
  id: "onboardingShadowSelf",
  title: "Who's really in charge inside you?",
  ball: "questions",
  tKey: "onboardingShadowSelf",
  type: "question",
  slotsForAIGeneration: ["morning"],
  pages: [
    {
      component: "selector",
      description: "When things get stressful, what do you usually do?",
      itemsPerRow: 2,
      max: 1,
      questions: [
        {
          id: "stress_control",
          label: "Try to control everything",
          icon: "🎯",
        },
        {
          id: "stress_hide",
          label: "Shut down and stay quiet",
          icon: "🫥",
        },
        {
          id: "stress_mask",
          label: "Act fine and move on",
          icon: "🎭",
        },
        {
          id: "stress_react",
          label: "Get irritated or defensive",
          icon: "⚡",
        },
      ],
    },
    {
      component: "selector",
      description: "Which role feels familiar to you?",
      itemsPerRow: 2,
      max: 1,
      questions: [
        {
          id: "role_saver",
          label: "I fix, help, or carry others",
          icon: "🛟",
        },
        {
          id: "role_controller",
          label: "I stay in charge — always",
          icon: "🎯",
        },
        {
          id: "role_adapting",
          label: "I adapt to others to feel accepted",
          icon: "🦋",
        },
        {
          id: "role_freeze",
          label: "I go numb to protect myself",
          icon: "🧊",
        },
      ],
    },
    {
      component: "multiYesNoMaybe",
      description: "Do any of these feel true right now?",
      questions: [
        {
          id: "truth_exhausted",
          label: "I feel emotionally tired",
        },
        {
          id: "truth_hidden_anger",
          label: "I keep in a lot of frustration",
        },
        {
          id: "truth_not_seen",
          label: "I don't feel fully seen for who I am",
        },
        {
          id: "truth_strong_outside",
          label: "I look strong but don't feel that way inside",
        },
      ],
    },
    {
      component: "final",
    },
  ],
};

export const happyOnboarding = {
  id: "happyOnboarding",
  title: "What's one small thing you feel grateful for - right now?",
  ball: "authenticity",
  tKey: "happyOnboarding",
  categoryId: "-44",
  slotsForAIGeneration: ["morning"],
  isReviewed: true,
  type: "journaling",
  pages: [
    {
      description: "What's one small thing you feel grateful for - right now?",
      component: "editor",
    },
    {
      component: "final",
    },
  ],
};

export const sadOnboarding = {
  id: "sadOnboarding",
  title: "What do you wish someone would say or do for you right now?",
  ball: "authenticity",
  tKey: "sadOnboarding",
  categoryId: "-44",
  slotsForAIGeneration: ["morning"],
  isReviewed: true,
  type: "journaling",
  pages: [
    {
      description:
        "What do you wish someone would say or do for you right now?",
      component: "editor",
    },
    {
      component: "final",
    },
  ],
};

export const morningReflection = {
  id: "morningReflection",
  title: "Morning Reflection",
  ball: "morning",
  tKey: "morningReflection",
  categoryId: "-44",
  slotsForAIGeneration: ["morning"],
  isReviewed: true,
  type: "journaling",
  pages: [
    {
      description: "How are you waking up today?",
      min: 0,
      max: 4,
      step: 1,
      initialValue: 0,
      markTexts: [
        "Very tense",
        "A little anxious",
        "Neutral",
        "Calm",
        "Energized",
      ],
      marks: [0, 1, 2, 3, 4],
      component: "slider",
    },
    {
      description: "Today I want to…",
      questions: [
        { id: "rest", icon: "🛌", label: "Rest" },
        { id: "calm", icon: "🧘‍♀️", label: "Feel calm" },
        { id: "focus", icon: "💪", label: "Focus" },
        { id: "tidy", icon: "🧹", label: "Tidy up" },
        { id: "create", icon: "✍️", label: "Create" },
        { id: "slow_down", icon: "☕", label: "Slow down" },
        { id: "finish_tasks", icon: "🗂️", label: "Finish tasks" },
        { id: "connect", icon: "❤️", label: "Connect with someone" },
        { id: "silence", icon: "🤫", label: "Be in silence" },
        { id: "move", icon: "🏃", label: "Move my body" },
        { id: "learn", icon: "📚", label: "Learn something" },
        { id: "give", icon: "🎁", label: "Do something kind" },
        { id: "treat", icon: "🍳", label: "Treat myself" },
        { id: "no_screen", icon: "📵", label: "Avoid screens" },
        { id: "reset", icon: "🔄", label: "Start over" },
        { id: "nature", icon: "🌳", label: "Be in nature" },
        { id: "feel_alive", icon: "💫", label: "Feel alive" },
        { id: "lightness", icon: "🪶", label: "Feel light" },
        { id: "control", icon: "🧭", label: "Feel in control" },
        { id: "presence", icon: "👣", label: "Be present" },
      ],
      max: 3,
      min: 0,
      itemsPerRow: 3,
      component: "selector",
    },
    {
      description: "How do you want to show up today?",
      placeholder: "How you'd like to move through your day — write it here.",
      background: "morning",
      component: "editor",
    },
    {
      component: "finalMorning",
    },
  ],
};

export const moonReflection = {
  id: "moonReflection",
  title: "Moon Reflection",
  ball: "moon",
  tKey: "moonReflection",
  categoryId: "-44",
  slotsForAIGeneration: ["morning"],
  isReviewed: true,
  type: "journaling",
  pages: [
    {
      description: "How are you feeling tonight?",
      min: 0,
      max: 4,
      step: 1,
      initialValue: 0,
      markTexts: ["Drained", "Restless", "Neutral", "Content", "Peaceful"],
      marks: [0, 1, 2, 3, 4],
      component: "slider",
    },

    {
      description: "What are you grateful for today?",
      placeholder: "A person, a feeling, a small detail — anything",
      background: "moon",
      component: "editor",
    },
    {
      description: "Is there anything you’d like to let go of before sleep?",
      placeholder:
        "Write and release it here. You don’t need to carry it into tomorrow.",
      background: "moon",
      component: "editor",
    },
    {
      component: "finalMorning",
      type: "evening",
    },
  ],
};

export const categories = [
  {
    id: "-1",
    title: "All",
    description: "All Journalings",
    backgroundImage: "",
    ball: "face",
    tKey: "all",
  },
  {
    id: "-2",
    title: "Saved",
    description: "Favories Journalings",
    backgroundImage: "",
    ball: "face",
    tKey: "favorites",
  },
  {
    id: "0",
    title: "Self-Awareness",
    ball: "selfAwareness",
    backgroundImage: "selfAwareness",
    description: "Reflect on your emotions and how they shape your life.",
    tKey: "selfAwareness",
    premium: true,
  },
  {
    id: "1",
    title: "Identity & Values",
    ball: "identityAndValues",
    backgroundImage: "identityAndValues",
    description: "Explore your identity and the essence of who you are.",
    tKey: "identityAndValues",
    premium: true,
  },
  {
    id: "2",
    title: "Growth Mindset",
    ball: "growthMindset",
    backgroundImage: "growthMindset",
    description: "Reflect on honesty and the truth in your life.",
    tKey: "growthMindset",
  },
  {
    id: "3",
    title: "Emotional Resilience",
    ball: "etemotionalResilience",
    backgroundImage: "etemotionalResilience",
    description: "Process grief and cherish memories of loved ones.",
    tKey: "emotionalResilience",
  },
  {
    id: "4",
    title: "Authenticity",
    ball: "authenticity",
    backgroundImage: "authenticity",
    description: "Explore your family relationships and their significance.",
    tKey: "authenticity",
    premium: true,
  },
  {
    id: "5",
    title: "Inner Child",
    ball: "inner",
    backgroundImage: "innerChild",
    description: "Address regrets and find closure with past mistakes.",
    tKey: "innerChild",
    premium: true,
  },
  {
    id: "6",
    title: "Purpose & Vision",
    ball: "purposeAndVision",
    backgroundImage: "purposeAndVision",
    description: "Reconnect with your childhood memories and friendships.",
    tKey: "purposeAndVision",
  },
  {
    id: "7",
    title: "Memories & Milestones",
    ball: "memoriesAndMilestones",
    backgroundImage: "memoriesAndMilestones",
    description:
      "Reflect on past relationships and the impact they had on you.",
    tKey: "memoriesAndMilestones",
  },
  {
    id: "8",
    title: "Relationships & Emotions",
    ball: "relationshipsAndEmotions",
    backgroundImage: "relationshipsAndEmotions",
    description: "Contemplate life, death, and the legacy you leave behind.",
    tKey: "relationshipsAndEmotions",
    premium: true,
  },
  {
    id: "9",
    title: "Aspirations & Action",
    ball: "aspirationsAndAction",
    backgroundImage: "aspirationsAndAction",
    description:
      "Explore your inner self through deep questions and scenarios.",
    tKey: "aspirationsAndAction",
  },
];

export const journeysNew = journals;

export const questionJournalsNew = questionJournals;

export const emptyJournal = {
  id: "empty",
  title: "Empty",
  description: "Empty",
  categoryId: "empty",
  tKey: "empty",
  slotsForAIGeneration: ["morning"],
  ball: "diary",
  icon: "icon1",
  color: "#FF0000",
  type: "journaling",
  premium: false,
  isReviewed: true,
  pages: [
    {
      component: "editor",
    },
    {
      description: "relationships",
      component: "final",
    },
  ],
};

const helpFunction = (
  ob: any,
  id: string,
  premium: boolean = false,
  moodDependents?: string
) => {
  return {
    id,
    title: ob.title,
    categoryId: "0",
    tKey: ob.tKey,
    type: "journaling",
    premium,
    isReviewed: true,
    moodDependents,
    ball: "diary",
    slotsForAIGeneration: ob.slotsForAIGeneration,
    pages: [
      {
        description: ob.title,
        component: "editor",
      },
      {
        component: "final",
      },
    ],
  };
};
export const selfAwareness = [
  helpFunction(
    {
      title:
        "What truly brings me <bold>joy</bold> and makes me feel <bold>alive</bold>?",
      tKey: "selfAwareness.joy",
      slotsForAIGeneration: ["morning", "evening"], // Joy discovery works well for morning motivation and evening reflection
    },
    "joy-1",
    true
  ),
  helpFunction(
    {
      title:
        "What is my <bold>deepest fear</bold>, and where might it come from?",
      tKey: "selfAwareness.fear",
      slotsForAIGeneration: ["evening"], // Deep fear exploration requires safe evening reflection
    },
    "fear-2",
    true
  ),
  helpFunction(
    {
      title:
        "What's been <bold>holding me back</bold> lately - and how can I start letting go?",
      tKey: "selfAwareness.holdingBack",
      slotsForAIGeneration: ["evening"], // Letting go work is perfect for evening reflection
    },
    "holding-back-3",
    false
  ),
  helpFunction(
    {
      title:
        "What gives me the <bold>strength</bold> to keep moving forward, even on hard days?",
      tKey: "selfAwareness.strength",
      slotsForAIGeneration: ["morning"], // Strength identification is perfect for morning motivation
    },
    "strength-4",
    true
  ),
  helpFunction(
    {
      title:
        "When do I feel the most <bold>vibrant</bold> and <bold>connected</bold> to life?",
      tKey: "selfAwareness.vibrant",
      slotsForAIGeneration: ["morning", "evening"], // Connection awareness works for both morning intention and evening reflection
    },
    "vibrant-5"
  ),
  helpFunction(
    {
      title:
        "What do I need to <bold>forgive myself</bold> for to feel more at peace?",
      tKey: "selfAwareness.forgiveness",
      slotsForAIGeneration: ["evening"], // Self-forgiveness is ideal for evening reflection
    },
    "forgiveness-6"
  ),
  helpFunction(
    {
      title:
        "What does <bold>self-love</bold> look like for me in this <bold>season</bold> of life?",
      tKey: "selfAwareness.selfLove",
      slotsForAIGeneration: ["morning", "evening"], // Self-love reflection is valuable for both morning intention and evening contemplation
    },
    "self-love-7"
  ),
  helpFunction(
    {
      title: "In what ways have I <bold>surprised</bold> myself recently?",
      tKey: "selfAwareness.surprises",
      slotsForAIGeneration: ["evening"], // Reflecting on self-surprises is perfect for evening contemplation
    },
    "surprises-8"
  ),
  helpFunction(
    {
      title: "What <bold>belief</bold> about myself have I outgrown?",
      tKey: "selfAwareness.outgrownBeliefs",
      slotsForAIGeneration: ["evening"], // Belief evolution reflection is ideal for evening contemplation
    },
    "outgrown-beliefs-9"
  ),
  helpFunction(
    {
      title:
        "How does the way I <bold>talk to myself</bold> shape how others see me?",
      tKey: "selfAwareness.selfTalk",
      slotsForAIGeneration: ["morning", "day", "evening"], // Self-talk awareness is valuable throughout the day
    },
    "self-talk-10",
    true
  ),
  helpFunction(
    {
      title:
        "How has my understanding of <bold>self-love</bold> changed over the <bold>years</bold>?",
      tKey: "selfAwareness.selfLoveEvolution",
      slotsForAIGeneration: ["evening"], // Long-term self-love evolution is perfect for evening reflection
    },
    "self-love-evolution-11",
    true
  ),
  helpFunction(
    {
      title:
        "What parts of myself do I tend to <bold>hide</bold>, and what's behind that?",
      tKey: "selfAwareness.hiddenParts",
      slotsForAIGeneration: ["evening"], // Exploring hidden parts requires deep, safe evening reflection
    },
    "hidden-parts-12"
  ),
  helpFunction(
    {
      title:
        "What <bold>traits</bold> do I judge in others - and what might that say about me?",
      tKey: "selfAwareness.judgment",
      slotsForAIGeneration: ["evening"], // Judgment pattern analysis is ideal for evening self-reflection
    },
    "judgment-13"
  ),
  helpFunction(
    {
      title:
        "When do I feel most <bold>insecure</bold>, and what tends to <bold>trigger</bold> that?",
      tKey: "selfAwareness.insecurity",
      slotsForAIGeneration: ["evening"], // Insecurity exploration is best for safe evening reflection
    },
    "insecurity-14"
  ),
  helpFunction(
    {
      title:
        "How do I handle <bold>criticism</bold>, and what does that reveal about my <bold>self-worth</bold>?",
      tKey: "selfAwareness.criticism",
      slotsForAIGeneration: ["evening"], // Criticism processing and self-worth reflection is ideal for evening
    },
    "criticism-15"
  ),
  helpFunction(
    {
      title:
        "What past <bold>experiences</bold> still feel hard to talk about - and why?",
      tKey: "selfAwareness.pastExperiences",
      slotsForAIGeneration: ["evening"], // Processing difficult past experiences requires safe evening reflection
    },
    "past-experiences-16"
  ),
  helpFunction(
    {
      title: "What would my <bold>future self</bold> gently tell me right now?",
      tKey: "selfAwareness.futureSelf",
      slotsForAIGeneration: ["morning", "evening"], // Future self guidance works for both morning intention and evening reflection
    },
    "future-self-17"
  ),
  helpFunction(
    {
      title: "What <bold>truth</bold> about myself have I been avoiding?",
      tKey: "selfAwareness.avoidedTruth",
      slotsForAIGeneration: ["evening"], // Facing avoided truths requires deep, safe evening reflection
    },
    "avoided-truth-18"
  ),
  helpFunction(
    {
      title:
        "Are my daily <bold>choices</bold> aligned with my own desires - or someone else's <bold>expectations</bold>?",
      tKey: "selfAwareness.choices",
      slotsForAIGeneration: ["evening"], // Choice alignment reflection is perfect for evening contemplation
    },
    "choices-19",
    true
  ),
  helpFunction(
    {
      title:
        "What's receiving too much of my <bold>energy</bold>, and what might need more of my <bold>attention</bold>?",
      tKey: "selfAwareness.energy",
      slotsForAIGeneration: ["evening"], // Energy assessment is ideal for evening reflection
    },
    "energy-20"
  ),
  helpFunction(
    {
      title:
        "If my life were a book, what would the <bold>one-page summary</bold> say today?",
      tKey: "selfAwareness.lifeSummary",
      slotsForAIGeneration: ["evening"], // Life summary reflection is perfect for evening contemplation
    },
    "life-summary-21"
  ),
];

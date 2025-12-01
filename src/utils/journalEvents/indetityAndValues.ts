const helpFunction = (ob: any, id: string) => {
  return {
    id,
    title: ob.title,
    categoryId: "1",
    tKey: ob.tKey,
    type: "journaling",
    ball: "diary",
    isReviewed: true,
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

export const identityAndValues = [
  helpFunction(
    {
      title:
        "What are my <bold>core values</bold>, and how do they guide my life?",
      tKey: "identityAndValues.coreValues",
      slotsForAIGeneration: ["morning", "evening"], // Core values reflection works for both morning intention and evening contemplation
    },
    "core-values-1"
  ),
  helpFunction(
    {
      title:
        "How do I personally define <bold>success</bold>, beyond what others expect?",
      tKey: "identityAndValues.success",
      slotsForAIGeneration: ["morning", "evening"], // Success definition works for both morning motivation and evening reflection
    },
    "success-2"
  ),
  helpFunction(
    {
      title:
        "What does <bold>freedom</bold> truly mean to me - emotionally, mentally, and physically?",
      tKey: "identityAndValues.freedom",
      slotsForAIGeneration: ["evening"], // Freedom reflection is perfect for evening contemplation
    },
    "freedom-3"
  ),
  helpFunction(
    {
      title:
        "What is my current <bold>relationship with fear</bold>, and how can I better understand it?",
      tKey: "identityAndValues.fear",
      slotsForAIGeneration: ["evening"], // Fear relationship exploration requires safe evening reflection
    },
    "fear-4"
  ),
  helpFunction(
    {
      title:
        "How do I feel about my <bold>relationship with money</bold>, and what beliefs shape it?",
      tKey: "identityAndValues.money",
      slotsForAIGeneration: ["evening"], // Money relationship reflection is ideal for evening contemplation
    },
    "money-5"
  ),
  helpFunction(
    {
      title:
        "What would my most <bold>nurturing</bold> and <bold>loving</bold> relationship with myself feel like?",
      tKey: "identityAndValues.selfLove",
      slotsForAIGeneration: ["morning", "evening"], // Self-love visioning works for both morning intention and evening reflection
    },
    "self-love-6"
  ),
  helpFunction(
    {
      title:
        "How would life change if I fully embraced my <bold>uniqueness</bold>?",
      tKey: "identityAndValues.uniqueness",
      slotsForAIGeneration: ["morning", "evening"], // Uniqueness embracement works for both morning confidence and evening reflection
    },
    "uniqueness-7"
  ),
  helpFunction(
    {
      title:
        "When do I feel most <bold>aligned</bold> with who I truly am and what I believe?",
      tKey: "identityAndValues.alignment",
      slotsForAIGeneration: ["morning", "evening"], // Alignment awareness works for both morning intention and evening reflection
    },
    "alignment-8"
  ),
  helpFunction(
    {
      title:
        "What <bold>self-imposed limitations</bold> have I outgrown - and how can I challenge them?",
      tKey: "identityAndValues.limitations",
      slotsForAIGeneration: ["evening"], // Limitation reflection and challenging is perfect for evening contemplation
    },
    "limitations-9"
  ),
  helpFunction(
    {
      title: "What do I genuinely <bold>love</bold> about my life right now?",
      tKey: "identityAndValues.lifeLove",
      slotsForAIGeneration: ["morning", "evening"], // Life appreciation works for both morning gratitude and evening reflection
    },
    "life-love-10"
  ),
  helpFunction(
    {
      title:
        "In what ways can I show myself more <bold>active love</bold> and <bold>kindness</bold>?",
      tKey: "identityAndValues.activeLove",
      slotsForAIGeneration: ["morning", "day", "evening"], // Active self-love is valuable throughout the day
    },
    "active-love-11"
  ),
  helpFunction(
    {
      title:
        "What are <bold>five things</bold> I truly <bold>love</bold> about myself?",
      tKey: "identityAndValues.selfLoveList",
      slotsForAIGeneration: ["morning", "evening"], // Self-love list works for both morning confidence and evening appreciation
    },
    "self-love-list-12"
  ),
  helpFunction(
    {
      title:
        "What are <bold>three limiting beliefs</bold> or <bold>negative mindsets</bold> I'm ready to let go of?",
      tKey: "identityAndValues.limitingBeliefs",
      slotsForAIGeneration: ["evening"], // Letting go of limiting beliefs is perfect for evening reflection
    },
    "limiting-beliefs-13"
  ),
  helpFunction(
    {
      title:
        "What brings me the most <bold>happiness</bold> and fills me with joy?",
      tKey: "identityAndValues.happiness",
      slotsForAIGeneration: ["morning", "evening"], // Happiness reflection works for both morning joy and evening gratitude
    },
    "happiness-14"
  ),
  helpFunction(
    {
      title:
        "What are <bold>five little things</bold> that make me <bold>smile</bold>?",
      tKey: "identityAndValues.smileTriggers",
      slotsForAIGeneration: ["morning", "day", "evening"], // Smile triggers are valuable throughout the day for joy
    },
    "smile-triggers-15"
  ),
];

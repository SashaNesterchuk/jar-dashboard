const helpFunction = (ob: any, id: string) => {
  return {
    id,
    title: ob.title,
    categoryId: "3",
    tKey: ob.tKey,
    type: "journaling",
    slotsForAIGeneration: ob.slotsForAIGeneration,
    ball: "diary",
    isReviewed: true,
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

export const emotionalResilience = [
  helpFunction(
    {
      title:
        "What's making today feel especially <bold>challenging</bold>, and how can I meet it with <bold>grace</bold>?",
      tKey: "emotionalResilience.challenges",
      slotsForAIGeneration: ["morning"],
    },
    "challenges-1"
  ),
  helpFunction(
    {
      title:
        "What <bold>sensations</bold> do I notice in my <bold>body</bold>, and what might they be telling me?",
      tKey: "emotionalResilience.bodySensations",
      slotsForAIGeneration: ["morning", "evening"], // Body awareness is good for morning check-in and evening reflection
    },
    "body-sensations-2"
  ),
  helpFunction(
    {
      title:
        "What <bold>emotions</bold> am I feeling right now - and can I name them without judgment?",
      tKey: "emotionalResilience.emotions",
      slotsForAIGeneration: ["morning", "day", "evening"], // Emotional check-ins are valuable throughout the day
    },
    "emotions-3"
  ),
  helpFunction(
    {
      title:
        "What <bold>story</bold> are my emotions trying to <bold>tell me</bold> today?",
      tKey: "emotionalResilience.emotionalStory",
      slotsForAIGeneration: ["evening"], // Deep emotional story analysis is best for evening reflection
    },
    "emotional-story-4"
  ),
  helpFunction(
    {
      title:
        "What <bold>words of kindness</bold> can I offer myself in this moment?",
      tKey: "emotionalResilience.kindness",
      slotsForAIGeneration: ["morning", "day", "evening"], // Self-kindness is valuable at any time
    },
    "kindness-5"
  ),
  helpFunction(
    {
      title:
        "What <bold>tools</bold> or practices help me feel <bold>reconnected</bold> with myself?",
      tKey: "emotionalResilience.tools",
      slotsForAIGeneration: ["morning", "evening"], // Tool discovery works well for morning planning and evening reflection
    },
    "tools-6"
  ),
  helpFunction(
    {
      title:
        "What's one small act of <bold>care</bold> I can give myself right now?",
      tKey: "emotionalResilience.selfCare",
      slotsForAIGeneration: ["morning", "day", "evening"], // Self-care is valuable throughout the day
    },
    "self-care-7"
  ),
  helpFunction(
    {
      title:
        "What am I <bold>afraid</bold> to do, and what's underneath that fear?",
      tKey: "emotionalResilience.fear",
      slotsForAIGeneration: ["evening"], // Fear exploration requires deep, safe evening reflection
    },
    "fear-8"
  ),
  helpFunction(
    {
      title:
        "What tends to make me feel <bold>upset</bold>, and how can I soothe myself through it?",
      tKey: "emotionalResilience.upset",
      slotsForAIGeneration: ["evening"], // Understanding triggers and soothing strategies is best for evening reflection
    },
    "upset-9"
  ),
  helpFunction(
    {
      title:
        "How do I <bold>recharge</bold> and find emotional balance after a <bold>tough day</bold>?",
      tKey: "emotionalResilience.recharge",
      slotsForAIGeneration: ["evening"], // Recharging strategies are perfect for evening reflection
    },
    "recharge-10"
  ),
];

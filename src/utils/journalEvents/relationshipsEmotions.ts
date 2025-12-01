import { EventJourney, Mood } from "@/types";

export const helpFunction = (
  ob: any,
  id: string,
  moodDependents?: Mood
): EventJourney => {
  return {
    id,
    title: ob.title,
    categoryId: "8",
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

export const relationshipsEmotions = [
  helpFunction(
    {
      title:
        "Who do I <bold>trust</bold> the most, and what makes that connection feel <bold>safe</bold>?",
      tKey: "relationships.trust.connection",
      slotsForAIGeneration: ["evening"], // Trust reflection is perfect for evening contemplation
    },
    "trust-connection-1",
    "good"
  ),
  helpFunction(
    {
      title:
        "Who <bold>inspires</bold> me the most, and what qualities in them do I admire?",
      tKey: "relationships.inspiration.qualities",
      slotsForAIGeneration: ["morning", "evening"], // Inspiration works for both morning motivation and evening reflection
    },
    "inspiration-qualities-2",
    "good"
  ),
  helpFunction(
    {
      title:
        "How do I naturally <bold>express love</bold>, and how do I feel most loved in return?",
      tKey: "relationships.love.expression",
      slotsForAIGeneration: ["evening"], // Love expression reflection is ideal for evening contemplation
    },
    "love-expression-3",
    "good"
  ),
  helpFunction(
    {
      title:
        "What is my current <bold>relationship with love</bold>, and how has it evolved over time?",
      tKey: "relationships.love.evolution",
      slotsForAIGeneration: ["evening"], // Love evolution reflection is perfect for evening contemplation
    },
    "love-evolution-4",
    "good"
  ),
  helpFunction(
    {
      title:
        "What <bold>role</bold> do I often play in my relationships - and where did that pattern begin?",
      tKey: "relationships.role.pattern",
      slotsForAIGeneration: ["evening"], // Role pattern analysis requires deep evening reflection
    },
    "role-pattern-5",
    "good"
  ),
  helpFunction(
    {
      title:
        "What <bold>unmet needs</bold> from my <bold>childhood</bold> might I still be carrying today?",
      tKey: "relationships.childhood.needs",
      slotsForAIGeneration: ["evening"], // Childhood needs exploration requires safe evening reflection
    },
    "childhood-needs-6",
    "bad"
  ),
  helpFunction(
    {
      title:
        "Who in my life consistently brings out the <bold>best</bold> version of me?",
      tKey: "relationships.best.version",
      slotsForAIGeneration: ["morning", "evening"], // Best version reflection works for both morning motivation and evening gratitude
    },
    "best-version-7",
    "good"
  ),
  helpFunction(
    {
      title:
        "Who do I feel I <bold>owe an apology</bold> to, and what would I say if I could speak from the heart?",
      tKey: "relationships.apology.heart",
      slotsForAIGeneration: ["evening"], // Apology reflection is perfect for evening contemplation
    },
    "apology-heart-8"
  ),
];

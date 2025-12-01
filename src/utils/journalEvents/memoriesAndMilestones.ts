import { EventJourney } from "@/types";

const helpFunction = (ob: any, id: string): EventJourney => {
  return {
    id,
    title: ob.title,
    categoryId: "7",
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
export const memoriesAndMilestones: Array<EventJourney> = [
  helpFunction(
    {
      title:
        "What's a <bold>memory</bold> that deeply <bold>shaped</bold> who I am today?",
      tKey: "memoriesAndMilestones.memoryShaped",
      slotsForAIGeneration: ["evening"], // Deep memory reflection is perfect for evening contemplation
    },
    "memory-shaped-1"
  ),
  helpFunction(
    {
      title:
        "What is my <bold>proudest achievement</bold>, and how did it change me?",
      tKey: "memoriesAndMilestones.proudestAchievement",
      slotsForAIGeneration: ["morning", "evening"], // Achievement reflection works for both morning motivation and evening pride
    },
    "proudest-achievement-2"
  ),
  helpFunction(
    {
      title:
        "What's my <bold>happiest memory</bold>, and what made it so special?",
      tKey: "memoriesAndMilestones.happiestMemory",
      slotsForAIGeneration: ["morning", "evening"], // Happy memories work for both morning joy and evening gratitude
    },
    "happiest-memory-3"
  ),
  helpFunction(
    {
      title:
        "What's a <bold>risk</bold> I'm truly glad I <bold>took</bold> - and what did I learn from it?",
      tKey: "memoriesAndMilestones.riskTook",
      slotsForAIGeneration: ["evening"], // Risk reflection and learning is perfect for evening contemplation
    },
    "risk-took-4"
  ),
  helpFunction(
    {
      title:
        "What's the <bold>hardest decision</bold> I've ever made, and how did it help me grow?",
      tKey: "memoriesAndMilestones.hardestDecision",
      slotsForAIGeneration: ["evening"], // Processing difficult decisions and growth is ideal for evening reflection
    },
    "hardest-decision-5"
  ),
];

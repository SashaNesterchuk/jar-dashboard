const helpFunction = (ob: any, id: string) => {
  return {
    id,
    title: ob.title,
    categoryId: "6",
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

export const purposeVision = [
  helpFunction(
    {
      title:
        "What are my true <bold>passions</bold>, and how do they show up in my life?",
      tKey: "purposeVision.passions",
      slotsForAIGeneration: ["morning", "evening"], // Passion discovery works for both morning motivation and evening reflection
    },
    "passions-1"
  ),
  helpFunction(
    {
      title:
        "What does my most fulfilling and <bold>dream life</bold> look and feel like?",
      tKey: "purposeVision.dreamLife",
      slotsForAIGeneration: ["evening"], // Dream life visioning is perfect for evening contemplation
    },
    "dream-life-2"
  ),
  helpFunction(
    {
      title:
        "What kind of <bold>legacy</bold> do I want to leave behind, and who do I hope it touches?",
      tKey: "purposeVision.legacy",
      slotsForAIGeneration: ["evening"], // Legacy reflection is ideal for evening contemplation
    },
    "legacy-3"
  ),
  helpFunction(
    {
      title: "What do I hope to be <bold>remembered</bold> for, at my core?",
      tKey: "purposeVision.remembered",
      slotsForAIGeneration: ["evening"], // Being remembered reflection is perfect for evening contemplation
    },
    "remembered-4"
  ),
  helpFunction(
    {
      title:
        "What would my <bold>ideal week</bold> look like if it reflected my values, energy, and joy?",
      tKey: "purposeVision.idealWeek",
      slotsForAIGeneration: ["morning"], // Ideal week planning is perfect for morning intention setting
    },
    "ideal-week-5"
  ),
  helpFunction(
    {
      title:
        "Where in my life do I need to set <bold>stronger boundaries</bold> to protect my time and well-being?",
      tKey: "purposeVision.boundaries",
      slotsForAIGeneration: ["evening"], // Boundary setting reflection is ideal for evening contemplation
    },
    "boundaries-6"
  ),
  helpFunction(
    {
      title:
        "What's something I <bold>loved</bold> but let go of — and is there a way I can <bold>return</bold> to it?",
      tKey: "purposeVision.returnToLoved",
      slotsForAIGeneration: ["evening"], // Returning to loved activities reflection is perfect for evening contemplation
    },
    "return-to-loved-7"
  ),
  helpFunction(
    {
      title:
        "What was the <bold>best day</bold> I've had this month — and how can I <bold>create more</bold> moments like that?",
      tKey: "purposeVision.bestDay",
      slotsForAIGeneration: ["morning", "evening"], // Best day reflection works for both morning motivation and evening gratitude
    },
    "best-day-8"
  ),
];

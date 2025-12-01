export const helpFunction = (ob: any, id: string) => {
  return {
    id,
    title: ob.title,
    categoryId: "9",
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
export const aspirationAction = [
  helpFunction(
    {
      title:
        "What's a <bold>skill</bold> I truly wish I had - and what's one small step I can take toward learning it?",
      tKey: "aspirationsAction.skill",
      slotsForAIGeneration: ["morning", "day", "evening"], // Skill learning can be planned at any time
    },
    "skill-1"
  ),

  helpFunction(
    {
      title:
        "What would my <bold>ideal daily routine</bold> look like if it supported my energy, focus, and joy?",
      tKey: "aspirationsAction.routine",
      slotsForAIGeneration: ["morning"], // Daily routine planning is best done in the morning
    },
    "routine-2"
  ),

  helpFunction(
    {
      title:
        "What's the <bold>best advice</bold> I've ever received - and how can I apply it to my life now?",
      tKey: "aspirationsAction.advice",
      slotsForAIGeneration: ["evening"], // Reflection on advice is perfect for evening contemplation
    },
    "advice-3"
  ),

  helpFunction(
    {
      title:
        "What's one <bold>goal</bold> I feel excited to pursue <bold>next</bold>, and why does it matter to me?",
      tKey: "aspirationsAction.nextGoal",
      slotsForAIGeneration: ["morning", "day"], // Goal setting works well in morning or during the day
    },
    "next-goal-4"
  ),
];

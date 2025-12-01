const helpFunction = (ob: any, id: string, templates: Array<string>) => {
  return {
    id,
    title: ob.title,
    categoryId: "999",
    tKey: ob.tKey,
    type: "journaling",
    slotsForAIGeneration: ob.slotsForAIGeneration,
    ball: "diary",
    isReviewed: true,
    pages: [
      {
        description: ob.title,
        templates,
        component: "editor",
      },
      {
        component: "final",
      },
    ],
  };
};

const getQuestionsArray = (templateKey: string): Array<string> => {
  const questionsMap: Record<string, Array<string>> = {
    quickSnapshot: [
      "journeysDefault.quickSnapshot.pages.0.templates.0",
      "journeysDefault.quickSnapshot.pages.0.templates.1",
      "journeysDefault.quickSnapshot.pages.0.templates.2",
    ],
    dailyReflection: [
      "journeysDefault.dailyReflection.pages.0.templates.0",
      "journeysDefault.dailyReflection.pages.0.templates.1",
      "journeysDefault.dailyReflection.pages.0.templates.2",
    ],
    gratitude: [
      "journeysDefault.gratitude.pages.0.templates.0",
      "journeysDefault.gratitude.pages.0.templates.1",
      "journeysDefault.gratitude.pages.0.templates.2",
      "journeysDefault.gratitude.pages.0.templates.3",
    ],
    goals: [
      "journeysDefault.goals.pages.0.templates.0",
      "journeysDefault.goals.pages.0.templates.1",
      "journeysDefault.goals.pages.0.templates.2",
      "journeysDefault.goals.pages.0.templates.3",
    ],
    feelings: [
      "journeysDefault.feelings.pages.0.templates.0",
      "journeysDefault.feelings.pages.0.templates.1",
      "journeysDefault.feelings.pages.0.templates.2",
      "journeysDefault.feelings.pages.0.templates.3",
    ],
    dream: [
      "journeysDefault.dream.pages.0.templates.0",
      "journeysDefault.dream.pages.0.templates.1",
      "journeysDefault.dream.pages.0.templates.2",
      "journeysDefault.dream.pages.0.templates.3",
    ],
    relationships: [
      "journeysDefault.relationships.pages.0.templates.0",
      "journeysDefault.relationships.pages.0.templates.1",
      "journeysDefault.relationships.pages.0.templates.2",
    ],
    travel: [
      "journeysDefault.travel.pages.0.templates.0",
      "journeysDefault.travel.pages.0.templates.1",
      "journeysDefault.travel.pages.0.templates.2",
      "journeysDefault.travel.pages.0.templates.3",
    ],
  };

  return questionsMap[templateKey] || [];
};

export const templates = [
  helpFunction(
    {
      title: "journeysDefault.quickSnapshot.title",
      description: "journeysDefault.quickSnapshot.description",
      tKey: "quickSnapshot",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "quick-snapshot",
    getQuestionsArray("quickSnapshot")
  ),
  helpFunction(
    {
      title: "journeysDefault.dailyReflection.title",
      description: "journeysDefault.dailyReflection.description",
      tKey: "dailyReflection",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "daily-reflection",
    getQuestionsArray("dailyReflection")
  ),
  helpFunction(
    {
      title: "journeysDefault.gratitude.title",
      description: "journeysDefault.gratitude.description",
      tKey: "gratitude",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "gratitude-journal",
    getQuestionsArray("gratitude")
  ),
  helpFunction(
    {
      title: "journeysDefault.goals.title",
      description: "journeysDefault.goals.description",
      tKey: "goals",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "goals-journal",
    getQuestionsArray("goals")
  ),
  helpFunction(
    {
      title: "journeysDefault.feelings.title",
      description: "journeysDefault.feelings.description",
      tKey: "feelings",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "feelings-journal",
    getQuestionsArray("feelings")
  ),
  helpFunction(
    {
      title: "journeysDefault.dream.title",
      description: "journeysDefault.dream.description",
      tKey: "dream",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "dream-journal",
    getQuestionsArray("dream")
  ),
  helpFunction(
    {
      title: "journeysDefault.relationships.title",
      description: "journeysDefault.relationships.description",
      tKey: "relationships",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "relationships-journal",
    getQuestionsArray("relationships")
  ),
  helpFunction(
    {
      title: "journeysDefault.travel.title",
      description: "journeysDefault.travel.description",
      tKey: "travel",
      slotsForAIGeneration: ["morning", "evening"],
    },
    "travel-journal",
    getQuestionsArray("travel")
  ),
];

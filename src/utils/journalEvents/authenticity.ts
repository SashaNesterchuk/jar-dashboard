const helpFunction = (ob: any, id: string, premium: boolean = false) => {
  return {
    id,
    title: ob.title,
    categoryId: "4",
    tKey: ob.tKey,
    type: "journaling",
    ball: "diary",
    isReviewed: true,
    slotsForAIGeneration: ob.slotsForAIGeneration,
    premium,
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

export const authenticity = [
  helpFunction(
    {
      title:
        "How can I show up more <bold>authentically</bold> - even when it feels <bold>uncomfortable</bold>?",
      tKey: "authenticity.showUp",
      slotsForAIGeneration: ["morning"],
    },
    "show-up-1"
  ),
  helpFunction(
    {
      title:
        "How can I offer the same <bold>care</bold> and <bold>support</bold> to myself that I so freely give to others?",
      tKey: "authenticity.selfCare",
      slotsForAIGeneration: ["morning"], // Self-care is best in the morning
    },
    "self-care-2",
    true // Premium event
  ),
  helpFunction(
    {
      title:
        "What's one way I can give myself <bold>permission</bold> to be <bold>imperfect</bold> today?",
      tKey: "authenticity.permission",
      slotsForAIGeneration: ["morning"], // Permission setting is ideal for morning
    },
    "permission-3",
    true // Premium event
  ),
  helpFunction(
    {
      title:
        "How can I <bold>celebrate</bold> my <bold>individuality</bold> with more confidence and joy?",
      tKey: "authenticity.individuality",
      slotsForAIGeneration: ["day"], // Celebration and confidence work well during the day
    },
    "individuality-4"
  ),
  helpFunction(
    {
      title:
        "What <bold>aspects of myself</bold> do I tend to hide, and what am I afraid others might see?",
      tKey: "authenticity.hiddenAspects",
      slotsForAIGeneration: ["evening"], // Deep reflection about hidden aspects is best in the evening
    },
    "hidden-aspects-5"
  ),
  helpFunction(
    {
      title:
        "What <bold>qualities</bold> do I judge harshly in others, and how might they be a mirror of <bold>unseen parts</bold> of myself?",
      tKey: "authenticity.judgment",
      slotsForAIGeneration: ["evening"], // Self-reflection on judgment patterns is ideal for evening
    },
    "judgment-6"
  ),
  helpFunction(
    {
      title:
        "What <bold>role</bold> do I often play in relationships (e.g., caregiver, peacemaker), and where did that pattern begin?",
      tKey: "authenticity.role",
      slotsForAIGeneration: ["evening"], // Analyzing relationship patterns requires deep evening reflection
    },
    "role-7"
  ),
  helpFunction(
    {
      title:
        "What would I do differently if I weren't afraid of <bold>judgment</bold> or <bold>failure</bold>?",
      tKey: "authenticity.fearless",
      slotsForAIGeneration: ["evening"], // Fear exploration and future visioning is perfect for evening
    },
    "fearless-8"
  ),
];

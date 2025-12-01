const helpFunction = (ob: any, id: string) => {
  return {
    id,
    title: ob.title,
    categoryId: "5",
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

export const innerChild = [
  helpFunction(
    {
      title:
        "If I could speak to my <bold>inner child</bold>, what loving words would I want them to <bold>hear</bold>?",
      tKey: "innerChild.lovingWords",
      slotsForAIGeneration: ["morning", "evening"], // Inner child healing works for both morning self-compassion and evening reflection
    },
    "loving-words-1"
  ),
  helpFunction(
    {
      title:
        "When was the last time I <bold>forgave myself</bold>, and how did it help me grow?",
      tKey: "innerChild.forgiveness",
      slotsForAIGeneration: ["evening"], // Self-forgiveness reflection is perfect for evening contemplation
    },
    "forgiveness-2"
  ),
  helpFunction(
    {
      title:
        "What's one thing I need to <bold>let go of</bold> to feel more <bold>light</bold> and free?",
      tKey: "innerChild.letGo",
      slotsForAIGeneration: ["evening"], // Letting go work is perfect for evening reflection
    },
    "let-go-3"
  ),
  helpFunction(
    {
      title:
        "What were my favorite <bold>childhood activities</bold>, and do I still make space for them? If not, <bold>why</bold>?",
      tKey: "innerChild.childhoodActivities",
      slotsForAIGeneration: ["evening"], // Childhood activity reflection is perfect for evening contemplation
    },
    "childhood-activities-4"
  ),
  helpFunction(
    {
      title:
        "How do I respond when I <bold>make a mistake</bold> or <bold>fail</bold>? What does that reveal about my inner dialogue?",
      tKey: "innerChild.mistakes",
      slotsForAIGeneration: ["evening"], // Mistake processing and inner dialogue reflection is ideal for evening
    },
    "mistakes-5"
  ),
  helpFunction(
    {
      title:
        "What <bold>messages</bold> did I receive about my <bold>emotions</bold> as a child, and how do they still affect me today?",
      tKey: "innerChild.emotionalMessages",
      slotsForAIGeneration: ["evening"], // Childhood emotional messages exploration requires safe evening reflection
    },
    "emotional-messages-6"
  ),
  helpFunction(
    {
      title:
        "What <bold>patterns</bold> or <bold>behaviors</bold> from my family do I still carry — often without realizing?",
      tKey: "innerChild.familyPatterns",
      slotsForAIGeneration: ["evening"], // Family pattern analysis requires deep evening reflection
    },
    "family-patterns-7"
  ),
  helpFunction(
    {
      title:
        "What <bold>dreams</bold> or <bold>aspirations</bold> did I hold as a child that I may have set aside?",
      tKey: "innerChild.childhoodDreams",
      slotsForAIGeneration: ["evening"], // Childhood dreams reflection is perfect for evening contemplation
    },
    "childhood-dreams-8"
  ),
  helpFunction(
    {
      title:
        "What gentle <bold>affirmations</bold> or loving <bold>messages</bold> can I offer my inner child for <bold>healing</bold> and comfort?",
      tKey: "innerChild.affirmations",
      slotsForAIGeneration: ["morning", "evening"], // Inner child affirmations work for both morning healing and evening comfort
    },
    "affirmations-9"
  ),
  helpFunction(
    {
      title:
        "How can I create a safe and <bold>nurturing space</bold> within myself to protect my inner child during times of <bold>stress</bold>?",
      tKey: "innerChild.safeSpace",
      slotsForAIGeneration: ["morning", "day", "evening"], // Safe space creation is valuable throughout the day for stress management
    },
    "safe-space-10"
  ),
  helpFunction(
    {
      title:
        "How can I reconnect with my inner child's <bold>joy</bold>, <bold>curiosity</bold>, and sense of <bold>wonder</bold>?",
      tKey: "innerChild.reconnect",
      slotsForAIGeneration: ["morning", "day", "evening"], // Inner child joy and wonder reconnection is valuable throughout the day
    },
    "reconnect-11"
  ),
];

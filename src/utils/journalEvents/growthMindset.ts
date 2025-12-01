import { EventJourney } from "@/types";

const helpFunction = (ob: any, id: string): EventJourney => {
  return {
    id,
    title: ob.title,
    categoryId: "2",
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

export const growthMindset: Array<EventJourney> = [
  helpFunction(
    {
      title:
        "What's one thing I can <bold>let go of</bold> to feel more at <bold>peace</bold>?",
      tKey: "growthMindset.letGo",
      slotsForAIGeneration: ["morning"],
    },
    "let-go-1"
  ),
  helpFunction(
    {
      title:
        "What <bold>positive qualities</bold> do I admire in others, and how can I <bold>nurture</bold> them in myself?",
      tKey: "growthMindset.positiveQualities",
      slotsForAIGeneration: ["evening"], // Reflecting on others' qualities and self-improvement is perfect for evening
    },
    "positive-qualities-2"
  ),
  helpFunction(
    {
      title: "What would I try if I weren't afraid of <bold>failing</bold>?",
      tKey: "growthMindset.fearless",
      slotsForAIGeneration: ["evening"], // Fear exploration and future visioning is best for evening reflection
    },
    "fearless-3"
  ),
  helpFunction(
    {
      title:
        "How can I <bold>celebrate</bold> my <bold>small wins</bold> and give myself more credit?",
      tKey: "growthMindset.celebrateWins",
      slotsForAIGeneration: ["evening"], // Celebrating wins and self-acknowledgment is perfect for evening reflection
    },
    "celebrate-wins-4"
  ),
  helpFunction(
    {
      title:
        "What past <bold>success</bold> can I look back on to boost my <bold>confidence</bold>?",
      tKey: "growthMindset.pastSuccess",
      slotsForAIGeneration: ["morning"], // Drawing on past success for confidence is ideal for morning motivation
    },
    "past-success-5"
  ),
  helpFunction(
    {
      title:
        "What's one small thing I can do today that aligns with my <bold>goals</bold>?",
      tKey: "growthMindset.alignGoals",
      slotsForAIGeneration: ["morning"], // Daily goal alignment is perfect for morning planning
    },
    "align-goals-6"
  ),
  helpFunction(
    {
      title:
        "What would I say to my <bold>younger self</bold> to offer comfort and encouragement?",
      tKey: "growthMindset.youngerSelf",
      slotsForAIGeneration: ["evening"], // Deep self-compassion and reflection is ideal for evening
    },
    "younger-self-7"
  ),
  helpFunction(
    {
      title:
        "What does my <bold>ideal day</bold> look like when I feel most <bold>successful</bold>?",
      tKey: "growthMindset.idealDay",
      slotsForAIGeneration: ["morning"], // Visioning ideal days is perfect for morning motivation
    },
    "ideal-day-8"
  ),
  helpFunction(
    {
      title:
        "How do I handle <bold>criticism</bold> in a way that helps me grow?",
      tKey: "growthMindset.criticism",
      slotsForAIGeneration: ["evening"], // Processing criticism and growth strategies is best for evening reflection
    },
    "criticism-9"
  ),
  helpFunction(
    {
      title:
        "What's one thing I can do daily to stay gently <bold>disciplined</bold> and focused?",
      tKey: "growthMindset.discipline",
      slotsForAIGeneration: ["morning"], // Daily discipline planning is ideal for morning intention setting
    },
    "discipline-10"
  ),
  helpFunction(
    {
      title:
        "What are my biggest <bold>distractions</bold>, and how can I create more space for what matters?",
      tKey: "growthMindset.distractions",
      slotsForAIGeneration: ["evening"], // Analyzing distractions and creating space is perfect for evening reflection
    },
    "distractions-11"
  ),
  helpFunction(
    {
      title:
        "How do I define <bold>work-life balance</bold>, and what steps can I take to support it?",
      tKey: "growthMindset.workLifeBalance",
      slotsForAIGeneration: ["evening"], // Work-life balance reflection is ideal for evening contemplation
    },
    "work-life-balance-12"
  ),
  helpFunction(
    {
      title:
        "What <bold>values</bold> help guide me toward the version of <bold>success</bold> I want?",
      tKey: "growthMindset.values",
      slotsForAIGeneration: ["morning", "evening"], // Values reflection works well for both morning intention and evening contemplation
    },
    "values-13"
  ),
  helpFunction(
    {
      title:
        "How do I stay <bold>resilient</bold> when life throws challenges my way?",
      tKey: "growthMindset.resilience",
      slotsForAIGeneration: ["morning", "evening"], // Resilience strategies are valuable for both morning preparation and evening processing
    },
    "resilience-14"
  ),
  helpFunction(
    {
      title:
        "What are <bold>three things</bold> I can do this week to keep moving <bold>forward</bold>?",
      tKey: "growthMindset.forward",
      slotsForAIGeneration: ["morning"], // Weekly forward momentum planning is perfect for morning motivation
    },
    "forward-15"
  ),
  helpFunction(
    {
      title:
        "How can I turn a current <bold>obstacle</bold> into an <bold>opportunity</bold>?",
      tKey: "growthMindset.obstacleToOpportunity",
      slotsForAIGeneration: ["day"], // Problem-solving and reframing works well during active day hours
    },
    "obstacle-to-opportunity-16"
  ),
  helpFunction(
    {
      title:
        "What does <bold>success</bold> look like in the different areas of my life - not just work?",
      tKey: "growthMindset.successAreas",
      slotsForAIGeneration: ["evening"], // Life area success reflection is ideal for evening contemplation
    },
    "success-areas-17"
  ),
  helpFunction(
    {
      title: "What new <bold>opportunities</bold> am I open to inviting in?",
      tKey: "growthMindset.newOpportunities",
      slotsForAIGeneration: ["morning"], // Opportunity mindset is perfect for morning intention setting
    },
    "new-opportunities-18"
  ),
  helpFunction(
    {
      title:
        "What would I attempt if I truly believed I couldn't <bold>fail</bold>?",
      tKey: "growthMindset.fearlessAttempt",
      slotsForAIGeneration: ["evening"], // Fearless visioning is perfect for evening reflection
    },
    "fearless-attempt-19"
  ),
  helpFunction(
    {
      title:
        "How can I develop more <bold>positive self-talk</bold> and quiet my inner critic?",
      tKey: "growthMindset.selfTalk",
      slotsForAIGeneration: ["morning", "day", "evening"], // Self-talk awareness is valuable throughout the day
    },
    "self-talk-20"
  ),
  helpFunction(
    {
      title:
        "What is one thing I can do this month to support my <bold>personal growth</bold>?",
      tKey: "growthMindset.personalGrowth",
      slotsForAIGeneration: ["morning"], // Monthly growth planning is ideal for morning intention setting
    },
    "personal-growth-21"
  ),
  helpFunction(
    {
      title:
        "What do I need to <bold>release</bold> or <bold>let go of</bold> to keep moving forward?",
      tKey: "growthMindset.release",
      slotsForAIGeneration: ["evening"], // Letting go and release work is perfect for evening reflection
    },
    "release-22"
  ),
];

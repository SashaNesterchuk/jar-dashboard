import { EventQuestion } from "@/types";

export const onboardingQuestion: EventQuestion = {
  id: "onboarding",
  title: "",
  ball: "questions",
  tKey: "wellbeingAssessment",
  type: "question",
  isReviewed: true,
  slotsForAIGeneration: ["evening"],
  traits: [],
  pages: [
    {
      component: "question",
      description: "",
      questions: [
        {
          id: "cheerful_all_time1",
          label: "",
          weights: {
            value: 5,
          },
        },
        {
          id: "cheerful_most_time1",
          label: "",
          weights: {
            value: 4,
          },
        },
        {
          id: "cheerful_more_half1",
          label: "",
          weights: {
            value: 3,
          },
        },
        {
          id: "cheerful_less_half1",
          label: "",
          weights: {
            value: 2,
          },
        },
        {
          id: "cheerful_some_time1",
          label: "",
          weights: {
            value: 1,
          },
        },
        {
          id: "cheerful_no_time",
          label: "",
          weights: {
            value: 0,
          },
        },
      ],
    },
    {
      component: "question",
      description: "",
      questions: [
        {
          id: "calm_all_time2",
          label: "",
          weights: {
            value: 5,
          },
        },
        {
          id: "calm_most_time2",
          label: "",
          weights: {
            value: 4,
          },
        },
        {
          id: "calm_more_half2",
          label: "",
          weights: {
            value: 3,
          },
        },
        {
          id: "calm_less_half2",
          label: "",
          weights: {
            value: 2,
          },
        },
        {
          id: "calm_some_time2",
          label: "",
          weights: {
            value: 1,
          },
        },
        {
          id: "calm_no_time2",
          label: "",
          weights: {
            value: 0,
          },
        },
      ],
    },
    {
      component: "question",
      description: "",
      questions: [
        {
          id: "active_all_time3",
          label: "",
          weights: {
            value: 5,
          },
        },
        {
          id: "active_most_time3",
          label: "",
          weights: {
            value: 4,
          },
        },
        {
          id: "active_more_half3",
          label: "",
          weights: {
            value: 3,
          },
        },
        {
          id: "active_less_half3",
          label: "",
          weights: {
            value: 2,
          },
        },
        {
          id: "active_some_time3",
          label: "",
          weights: {
            value: 1,
          },
        },
        {
          id: "active_no_time3",
          label: "",
          weights: {
            value: 0,
          },
        },
      ],
    },
    {
      component: "question",
      description: "",
      questions: [
        {
          id: "fresh_all_time4",
          label: "",
          weights: {
            value: 5,
          },
        },
        {
          id: "fresh_most_time4",
          label: "",
          weights: {
            value: 4,
          },
        },
        {
          id: "fresh_more_half4",
          label: "",
          weights: {
            value: 3,
          },
        },
        {
          id: "fresh_less_half4",
          label: "",
          weights: {
            value: 2,
          },
        },
        {
          id: "fresh_some_time4",
          label: "",
          weights: {
            value: 1,
          },
        },
        {
          id: "fresh_no_time4",
          label: "",
          weights: {
            value: 0,
          },
        },
      ],
    },
    {
      component: "question",
      description: "",
      questions: [
        {
          id: "interest_all_time5",
          label: "",
          weights: {
            value: 5,
          },
        },
        {
          id: "interest_most_time5",
          label: "",
          weights: {
            value: 4,
          },
        },
        {
          id: "interest_more_half5",
          label: "",
          weights: {
            value: 3,
          },
        },
        {
          id: "interest_less_half5",
          label: "",
          weights: {
            value: 2,
          },
        },
        {
          id: "interest_some_time5",
          label: "",
          weights: {
            value: 1,
          },
        },
        {
          id: "interest_no_time5",
          label: "",
          weights: {
            value: 0,
          },
        },
      ],
    },
  ],
};

export const questionsNe: EventQuestion[] = [
  {
    id: "attachmentStyleSnapshotTest",
    title: "",
    ball: "questions",
    tKey: "attachmentStyleSnapshotTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "anxious",
        title: "",
        description: "",
      },
      {
        id: "avoidant",
        title: "",
        description: "",
      },
      {
        id: "secure",
        title: "",
        description: "",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description: "",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q1_seek_reassurance",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q1_pull_back",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q1_communicate_openly",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q1_distract_self",
            label: "",
            weights: { avoidant: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q2_fix_now",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q2_need_space",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q2_stay_present",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q2_minimize",
            label: "",
            weights: { avoidant: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q3_relief",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q3_pressure",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q3_warm",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q3_mixed",
            label: "",
            weights: { anxious: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q4_check_in",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q4_detach",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q4_align",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q4_postpone",
            label: "",
            weights: { avoidant: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q5_reassess_story",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q5_cool_off",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q5_name_need",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q5_assume_best",
            label: "",
            weights: { secure: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q6_seek_merge",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q6_solo_process",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q6_own_impact",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q6_delay_repair",
            label: "",
            weights: { avoidant: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q7_overpromise",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q7_minimize",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q7_negotiate",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q7_time_boundaries",
            label: "",
            weights: { secure: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "attach_q8_seek_proof",
            label: "",
            weights: { anxious: 1 },
          },
          {
            id: "attach_q8_self_sufficiency",
            label: "",
            weights: { avoidant: 1 },
          },
          {
            id: "attach_q8_meta_talk",
            label: "",
            weights: { secure: 1 },
          },
          {
            id: "attach_q8_check_facts",
            label: "",
            weights: { secure: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "loveLanguagesCheckInTest",
    title: "",
    ball: "questions",
    tKey: "loveLanguagesCheckInTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "words",
        title: "",
        description:
          "## What fills your cup\nSpecific, sincere words that mirror your effort, character, or needs.\n\n### Signals that land\n- Reflective appreciation (what, why it matters)\n- Encouraging texts or voice notes\n- Clear naming of impact after support\n\n### Tips\n- Ask for concrete examples\n- Save notes for low days\n",
      },
      {
        id: "time",
        title: "",
        description:
          '## What fills your cup\nUndistracted presence and shared focus.\n\n### Signals that land\n- Protected time blocks together\n- Devices down, shoulder-to-shoulder activities\n- Focused check-ins\n\n### Tips\n- Co-create weekly anchor time\n- Define "present" norms\n',
      },
      {
        id: "acts",
        title: "",
        description:
          "## What fills your cup\nHelpful actions that reduce friction and add ease.\n\n### Signals that land\n- Handling logistics proactively\n- Follow-through on promises\n- Prep before big days\n\n### Tips\n- Share top-3 helpful acts\n- Appreciate effort over perfection\n",
      },
      {
        id: "touch",
        title: "",
        description:
          "## What fills your cup\nWarm, consensual touch that co-regulates.\n\n### Signals that land\n- Hugs, hand squeezes, cuddles\n- Soothing touch during stress\n- Playful physicality\n\n### Tips\n- Agree on contexts and boundaries\n- Pair touch with words when needed\n",
      },
      {
        id: "gifts",
        title: "",
        description:
          '## What fills your cup\nTangible tokens that symbolize noticing, memory, or care.\n\n### Signals that land\n- Small surprises linked to inside jokes\n- Useful items that show attentiveness\n- Mementos from shared experiences\n\n### Tips\n- Keep a "wish list" note\n- Balance surprise with practicality\n',
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Love Languages Check-In\nIdentify the signals of care that land most for you.\n\n## You'll learn\n- Your top channels (words, time, acts, touch, gifts)\n- Micro-gestures with outsized impact\n- Clear ways to ask for care\n\n> You can value more than one; priorities shift by season.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q1_affirm",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q1_time",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q1_service",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q1_touch",
            label: "",
            weights: { touch: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q2_listen_words",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q2_movie_time",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q2_do_thing",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q2_small_gift",
            label: "",
            weights: { gifts: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q3_text",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q3_date",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q3_help",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q3_cuddle",
            label: "",
            weights: { touch: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q4_letter",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q4_trip",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q4_surprise_help",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q4_present",
            label: "",
            weights: { gifts: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q5_apology_words",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q5_repair_time",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q5_repair_act",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q5_repair_touch",
            label: "",
            weights: { touch: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q6_words",
            label: 'share "high/low/learn" check-ins',
            weights: { words: 1 },
          },
          {
            id: "ll_q6_time",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q6_acts",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q6_gifts",
            label: "",
            weights: { gifts: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q7_words",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q7_time",
            label: "",
            weights: { time: 1 },
          },
          {
            id: "ll_q7_acts",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q7_gifts",
            label: "",
            weights: { gifts: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ll_q8_words",
            label: "",
            weights: { words: 1 },
          },
          {
            id: "ll_q8_time",
            label: 'distracted "together time"',
            weights: { time: 1 },
          },
          {
            id: "ll_q8_acts",
            label: "",
            weights: { acts: 1 },
          },
          {
            id: "ll_q8_gifts",
            label: "",
            weights: { gifts: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "bidsForConnectionHabitTest",
    title: "",
    ball: "questions",
    tKey: "bidsForConnectionHabitTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "turn_toward",
        title: "",
        description:
          "## Pattern\nYou consistently notice and respond to tiny bids for connection.\n\n### Behaviors\n- Orient, smile, or ask a follow-up\n- Acknowledge even when busy\n\n### Impact\n- Trust compounds via micro-moments\n- Faster repair under stress\n",
      },
      {
        id: "neutral",
        title: "",
        description:
          '## Pattern\nSometimes you engage, sometimes you miss bids—often due to distraction.\n\n### Behaviors\n- Brief nods without switching tasks\n- Mixed consistency across contexts\n\n### Support\n- Add "bid windows" in routines\n- Use reminders to catch small moments\n',
      },
      {
        id: "turn_away",
        title: "",
        description:
          "## Pattern\nYou often miss or deflect bids—particularly under load.\n\n### Behaviors\n- Device focus over brief engagement\n- Topic changes or jokes to avoid depth\n\n### Repair\n- Name misses and invite re-bids\n- Practice 10–30s micro-turns\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          '# Bids for Connection Habit\nSmall moments build big bonds. Measure how often you turn toward.\n\n## Why it matters\n- Micro-engagement predicts stability\n- Turning toward in stress increases safety\n\n## Use your results\n- Set two daily "bid windows"\n- Create a re-bid script after misses',
      },
      {
        component: "question",
        description:
          "When someone shows me a small thing they're excited about...",
        questions: [
          {
            id: "bids_q1_engage",
            label: "",
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q1_okay",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q1_ignore",
            label: "",
            weights: { turn_away: 1 },
          },
          {
            id: "bids_q1_deflect",
            label: "",
            weights: { turn_away: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q2_seek",
            label: "",
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q2_sometimes",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q2_rare",
            label: "",
            weights: { turn_away: 1 },
          },
          {
            id: "bids_q2_on_phone",
            label: "",
            weights: { turn_away: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q3_even_more",
            label: "",
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q3_mixed",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q3_less",
            label: "",
            weights: { turn_away: 1 },
          },
          {
            id: "bids_q3_joke",
            label: "",
            weights: { turn_away: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q4_name_bids",
            label: "",
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q4_reduce_distractions",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q4_set_boundaries",
            label: 'setting "not now" boundaries clearly',
            weights: { neutral: 1 },
          },
          {
            id: "bids_q4_device_rules",
            label: "",
            weights: { turn_away: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q5_ask_clearly",
            label: "",
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q5_hint",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q5_stop_bidding",
            label: "",
            weights: { turn_away: 1 },
          },
          {
            id: "bids_q5_rebid_script",
            label: "",
            weights: { turn_toward: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q6_eye_contact",
            label: "",
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q6_wave",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q6_text",
            label: "",
            weights: { turn_away: 1 },
          },
          {
            id: "bids_q6_touch",
            label: "",
            weights: { turn_toward: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q7_device",
            label: "",
            weights: { turn_away: 1 },
          },
          {
            id: "bids_q7_task_focus",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q7_misread",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q7_over_analyze",
            label: "",
            weights: { turn_away: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bids_q8_anchor_times",
            label: 'set anchor "bid windows"',
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q8_device_basket",
            label: "",
            weights: { neutral: 1 },
          },
          {
            id: "bids_q8_timer",
            label: 'use a 60s pause before replying "later"',
            weights: { turn_toward: 1 },
          },
          {
            id: "bids_q8_labels",
            label: 'label bids out loud ("that was a bid!")',
            weights: { turn_toward: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "boundariesComfortIndexTest",
    title: "",
    ball: "questions",
    tKey: "boundariesComfortIndexTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "easy",
        title: "",
        description:
          '## Pattern\nYou clearly state limits and renegotiate with care.\n\n### Strengths\n- Early, direct communication\n- Consistent follow-through\n\n### Growth\n- Share brief "why" for buy-in\n- Add review dates to agreements\n',
      },
      {
        id: "balanced",
        title: "",
        description:
          "## Pattern\nGenerally comfortable, with a few hot-spots.\n\n### Strengths\n- Flexible negotiation\n- Context awareness\n\n### Growth\n- Script tricky scenarios\n- Track resentment as a cue\n",
      },
      {
        id: "challenging",
        title: "",
        description:
          '## Pattern\nSaying no feels risky; over-accommodation is common.\n\n### Signals\n- Silent yes followed by resentment\n- Indirect or delayed no\n\n### Growth\n- Practice tiny, kind no\'s\n- Use "not now, but..." templates\n',
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Boundaries Comfort Index\nGauge how easily you set limits and renegotiate plans.\n\n## Why it matters\n- Prevent covert contracts and burnout\n- Create mutual clarity and trust\n\n## Use your results\n- Adopt 2 scripts for sticky contexts\n- Add boundary review rituals",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q1_restate",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q1_hint",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q1_avoid",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q1_tradeoff",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q2_clear",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q2_ok",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q2_hard",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q2_delay",
            label: "",
            weights: { challenging: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q3_reassert",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q3_negotiate",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q3_freeze",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q3_later",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q4_script",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q4_checkin",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q4_state",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q4_followup",
            label: "",
            weights: { easy: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q5_time",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q5_capacity",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q5_money",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q5_emotional",
            label: "",
            weights: { easy: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q6_not_now",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q6_cant_do",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q6_needs_change",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q6_no_context",
            label: "",
            weights: { challenging: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q7_last_min",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q7_repeating",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q7_silent",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q7_guilt",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "bound_q8_weekly_review",
            label: "",
            weights: { easy: 1 },
          },
          {
            id: "bound_q8_script_bank",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "bound_q8_body_cues",
            label: "",
            weights: { challenging: 1 },
          },
          {
            id: "bound_q8_kinder_no",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
    ],
  },

  {
    id: "situationshipToleranceScaleTest",
    title: "",
    ball: "questions",
    tKey: "situationshipToleranceScaleTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "low_tolerance",
        title: "",
        description:
          "## Preference\nYou prefer clarity, labels, and steady expectations.\n\n### Signals\n- Early DTR conversations\n- Discomfort with long ambiguity\n\n### Support\n- Time-bound clarity checkpoints\n- Agreements for exclusivity if desired\n",
      },
      {
        id: "medium_tolerance",
        title: "",
        description:
          '## Preference\nYou can handle some ambiguity if care and effort are consistent.\n\n### Signals\n- Context-based pacing\n- Clarity sought after patterns form\n\n### Support\n- Milestone reviews (30/60/90 days)\n- Define "what counts" as care\n',
      },
      {
        id: "high_tolerance",
        title: "",
        description:
          "## Preference\nFlexible about labels; value flow and evolving definitions.\n\n### Signals\n- Comfort with open dynamics\n- Trust built through presence\n\n### Support\n- Transparent boundaries and calendars\n- Explicit risk/need discussions\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Situationship Tolerance Scale\nHow comfortable are you with ambiguity, labels, and exclusivity?\n\n## You’ll learn\n- Your comfort range with undefined phases\n- What you need to feel steady\n- Checkpoints to reduce drift",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q1_define",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q1_observe",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q1_flow",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q1_pause",
            label: "",
            weights: { low_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q2_early",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q2_context",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q2_open",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q2_delay",
            label: "",
            weights: { medium_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q3_anxious",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q3_manage",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q3_enjoy",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q3_take_space",
            label: "",
            weights: { medium_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q4_defined",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q4_flex_defined",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q4_open",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q4_case_by_case",
            label: "",
            weights: { medium_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q5_calendar",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q5_signals",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q5_milestones",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q5_visibility",
            label: "",
            weights: { low_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q6_multiple",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q6_inconsistent",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q6_labels",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q6_private",
            label: "",
            weights: { low_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q7_negotiate",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q7_pause",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q7_continue",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q7_exit",
            label: "",
            weights: { low_tolerance: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "situ_q8_exclusivity",
            label: "",
            weights: { low_tolerance: 1 },
          },
          {
            id: "situ_q8_checkins",
            label: "",
            weights: { medium_tolerance: 1 },
          },
          {
            id: "situ_q8_openness",
            label: "",
            weights: { high_tolerance: 1 },
          },
          {
            id: "situ_q8_safety",
            label: "",
            weights: { medium_tolerance: 1 },
          },
        ],
      },
    ],
  },

  {
    id: "jealousyTriggersMapTest",
    title: "",
    ball: "questions",
    tKey: "jealousyTriggersMapTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "low_jealousy",
        title: "",
        description:
          "## Baseline\nJealousy is rare; trust and self-regulation are strong.\n\n### Strengths\n- Calm appraisal of context\n- Internal soothing skills\n\n### Tips\n- Share internal process to support partners\n- Keep agreements visible and simple\n",
      },
      {
        id: "context_sensitive",
        title: "",
        description:
          '## Baseline\nCertain contexts trigger you; clarity and communication help.\n\n### Triggers\n- Secrecy, inconsistent signals\n- Past-pattern echoes\n\n### Tips\n- Pre-plan scripts for hot contexts\n- Define "green/amber/red" zones together\n',
      },
      {
        id: "high_jealousy",
        title: "",
        description:
          "## Baseline\nJealous feelings arise often; reassurance and explicit agreements help.\n\n### Patterns\n- Comparison loops, hypervigilance\n- Fast reassurance seeking\n\n### Tips\n- Time-bound reassurance + tracking safety evidence\n- Design shared rituals that replenish security\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Jealousy Triggers Map\nFind contexts that trigger jealousy and the responses that help.\n\n## You’ll learn\n- Your main triggers and coping patterns\n- Agreements that reduce spikes\n- Rituals that restore safety",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q1_ok",
            label: "",
            weights: { low_jealousy: 1 },
          },
          {
            id: "jeal_q1_depends",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q1_uneasy",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q1_limit",
            label: "",
            weights: { context_sensitive: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q2_selfsoothe",
            label: "",
            weights: { low_jealousy: 1 },
          },
          {
            id: "jeal_q2_discuss",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q2_seek",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q2_withdraw",
            label: "",
            weights: { context_sensitive: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q3_rare",
            label: "",
            weights: { low_jealousy: 1 },
          },
          {
            id: "jeal_q3_specific",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q3_often",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q3_social",
            label: "",
            weights: { context_sensitive: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q4_time",
            label: "",
            weights: { low_jealousy: 1 },
          },
          {
            id: "jeal_q4_clarity",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q4_reassurance",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q4_agreements",
            label: "",
            weights: { context_sensitive: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q5_parties",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q5_dms",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q5_public",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q5_none",
            label: "",
            weights: { low_jealousy: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q6_visibility",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q6_checkins",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q6_boundaries",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q6_reassurance",
            label: "",
            weights: { high_jealousy: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q7_evidence",
            label: "",
            weights: { low_jealousy: 1 },
          },
          {
            id: "jeal_q7_rituals",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q7_repair",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q7_internal",
            label: "",
            weights: { low_jealousy: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "jeal_q8_journal",
            label: "",
            weights: { low_jealousy: 1 },
          },
          {
            id: "jeal_q8_script",
            label: "",
            weights: { context_sensitive: 1 },
          },
          {
            id: "jeal_q8_timer",
            label: "",
            weights: { high_jealousy: 1 },
          },
          {
            id: "jeal_q8_boundary",
            label: "",
            weights: { context_sensitive: 1 },
          },
        ],
      },
    ],
  },

  {
    id: "textingStyleDecoderTest",
    title: "",
    ball: "questions",
    tKey: "textingStyleDecoderTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "rapid_responder",
        title: "",
        description:
          '## Baseline\nFast replies feel natural; immediacy over depth.\n\n### Strengths\n- Momentum and clarity\n- Low friction for coordination\n\n### Growth\n- Add context when brief\n- Use "later reply" signals when busy\n',
      },
      {
        id: "thoughtful_texter",
        title: "",
        description:
          '## Baseline\nYou prefer considered replies; depth over speed.\n\n### Strengths\n- Clarity and nuance\n- Lower misreads\n\n### Growth\n- Set expectations for reply windows\n- Use quick "seen + later" when needed\n',
      },
      {
        id: "laid_back_messenger",
        title: "",
        description:
          "## Baseline\nYou text in waves; casual norms and flexible timing.\n\n### Strengths\n- Easygoing coordination\n- Low pressure in threads\n\n### Growth\n- Add structure for time-sensitive topics\n- Label urgency/priority when needed\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Texting Style Decoder\nUnderstand your reply speed, tone, norms, and expectations.\n\n## Use this\n- Set shared texting norms\n- Prevent misreads and pressure cycles",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q1_fast",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q1_considered",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q1_waves",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
          {
            id: "text_q1_varies",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q2_many",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q2_clear",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q2_sparse",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
          {
            id: "text_q2_match",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q3_okay",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q3_context",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q3_rare",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
          {
            id: "text_q3_thread",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q4_soon",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q4_quality",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q4_chill",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
          {
            id: "text_q4_no_rules",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q5_off",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q5_on_close",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q5_on_all",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q5_noneed",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q6_topic",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q6_flow",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
          {
            id: "text_q6_action",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q6_archive",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q7_labels",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q7_emojis",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q7_timestamps",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q7_none",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "text_q8_norms",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q8_signals",
            label: "",
            weights: { rapid_responder: 1 },
          },
          {
            id: "text_q8_topics",
            label: "",
            weights: { thoughtful_texter: 1 },
          },
          {
            id: "text_q8_expectations",
            label: "",
            weights: { laid_back_messenger: 1 },
          },
        ],
      },
    ],
  },

  {
    id: "greenBeigeRedFlagsFilterTest",
    title: "",
    ball: "questions",
    tKey: "greenBeigeRedFlagsFilterTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "green_focus",
        title: "",
        description:
          "## Orientation\nYou notice and prioritize healthy patterns and strengths.\n\n### Markers\n- Repair after conflict\n- Accountability and kindness\n\n### Tips\n- Keep celebrating prosocial signals\n- Name what works to reinforce it\n",
      },
      {
        id: "beige_balanced",
        title: "",
        description:
          '## Orientation\nYou weigh context and neutrality before judging.\n\n### Markers\n- Logistics care, consistency\n- Curiosity before conclusions\n\n### Tips\n- Use "needs + request" when ambiguous\n- Track patterns over snapshots\n',
      },
      {
        id: "red_sensitive",
        title: "",
        description:
          "## Orientation\nYou quickly spot risk patterns and act to protect yourself.\n\n### Markers\n- Coercion, contempt, secrecy\n- Ghosting, benching patterns\n\n### Tips\n- Trust early signals\n- Exit cleanly when needed\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Green/Beige/Red Flags Filter\nDefine what you rate as green, beige, and red—for you.\n\n## Why it helps\n- Faster pattern recognition\n- Clearer boundaries and asks",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q1_green",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q1_beige",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q1_red",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q1_context",
            label: "",
            weights: { beige_balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q2_name",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q2_note",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q2_exit",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q2_delay",
            label: "",
            weights: { beige_balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q3_repair",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q3_account",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q3_lists",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q3_bench",
            label: "",
            weights: { red_sensitive: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q4_cruel",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q4_secret",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q4_neutral",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q4_green",
            label: "",
            weights: { green_focus: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q5_inconsistency",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q5_defensiveness",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q5_low_effort",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q5_unkind",
            label: "",
            weights: { red_sensitive: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q6_reliability",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q6_learning",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q6_delight",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q6_logistics",
            label: "",
            weights: { beige_balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q7_name_and_watch",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q7_boundary",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q7_exit",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q7_request",
            label: "",
            weights: { green_focus: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "flags_q8_green",
            label: "",
            weights: { green_focus: 1 },
          },
          {
            id: "flags_q8_beige",
            label: "",
            weights: { beige_balanced: 1 },
          },
          {
            id: "flags_q8_red",
            label: "",
            weights: { red_sensitive: 1 },
          },
          {
            id: "flags_q8_mix",
            label: "",
            weights: { beige_balanced: 1 },
          },
        ],
      },
    ],
  },

  {
    id: "mainCharacterEnergyMeterTest",
    title: "",
    ball: "questions",
    tKey: "mainCharacterEnergyMeterTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "leader",
        title: "",
        description:
          "## Orientation\nYou naturally take the lead, self-advocate, and drive momentum.\n\n### Strengths\n- Initiative and clarity\n- Comfort with visibility\n\n### Growth\n- Invite collaboration and rotate roles\n- Balance drive with recovery\n",
      },
      {
        id: "balanced",
        title: "",
        description:
          "## Orientation\nYou switch between leading and supporting as needed.\n\n### Strengths\n- Flexibility and situational awareness\n- Team-mindedness\n\n### Growth\n- Name role expectations early\n- Avoid over-functioning in gaps\n",
      },
      {
        id: "supportive",
        title: "",
        description:
          "## Orientation\nYou enable others to shine and prefer behind-the-scenes.\n\n### Strengths\n- Stabilizing presence\n- Detail care\n\n### Growth\n- Practice visible asks and wins\n- Take low-stakes spotlight reps\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Main Character Energy Meter\nHow strongly you lead, self-advocate, and enjoy visibility.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q1_initiate",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q1_share",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q1_support",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q1_rotate",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q2_easy",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q2_ok",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q2_hard",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q2_context",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q3_enjoy",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q3_bal",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q3_draining",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q3_share",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q4_drive",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q4_colead",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q4_anchor",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q4_switch",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q5_fast",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q5_consult",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q5_support",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q5_iterate",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q6_seek",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q6_selective",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q6_cautious",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q6_public",
            label: "",
            weights: { leader: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q7_frontload",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q7_pace",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q7_supportive",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q7_sprints",
            label: "",
            weights: { leader: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "mce_q8_lead",
            label: "",
            weights: { leader: 1 },
          },
          {
            id: "mce_q8_mix",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "mce_q8_back",
            label: "",
            weights: { supportive: 1 },
          },
          {
            id: "mce_q8_context",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "typeABBalanceTest",
    title: "",
    ball: "questions",
    tKey: "typeABBalanceTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "type_a",
        title: "",
        description:
          "## Orientation\nHigh pace, structure, and outcome focus.\n\n### Strengths\n- Drive and planning\n- Clear ownership\n\n### Growth\n- Add slack and buffers\n- Protect recovery time\n",
      },
      {
        id: "balanced",
        title: "",
        description:
          "## Orientation\nMix of planning and ease depending on stakes.\n\n### Strengths\n- Flexible execution\n- Context-driven pace\n\n### Growth\n- Make decision rules explicit\n- Avoid drift via checkpoints\n",
      },
      {
        id: "type_b",
        title: "",
        description:
          "## Orientation\nEasygoing pace, adaptive flow, low pressure by default.\n\n### Strengths\n- Calm and creativity\n- Stress resilience\n\n### Growth\n- Add light structure for deadlines\n- Use timeboxing to start\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Type A / Type B Balance\nYour pace, control, and pressure preferences in daily life.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q1_push",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q1_center",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q1_glide",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q1_batch",
            label: "",
            weights: { type_b: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q2_high",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q2_shared",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q2_low",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q2_delegate",
            label: "",
            weights: { type_b: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q3_schedule",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q3_blocks",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q3_loose",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q3_spont",
            label: "",
            weights: { type_b: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q4_intensify",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q4_focus",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q4_slow",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q4_keep_calm",
            label: "",
            weights: { type_b: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q5_urgent",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q5_mixed",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q5_energy",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q5_sequence",
            label: "",
            weights: { type_a: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q6_parallel",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q6_single",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q6_batch",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q6_toggle",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q7_off",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q7_micro",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q7_flow",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q7_deload",
            label: "",
            weights: { type_a: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "ab_q8_do",
            label: "",
            weights: { type_a: 1 },
          },
          {
            id: "ab_q8_delegate",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "ab_q8_trust",
            label: "",
            weights: { type_b: 1 },
          },
          {
            id: "ab_q8_pair",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "socialBatteryGaugeTest",
    title: "",
    ball: "questions",
    tKey: "socialBatteryGaugeTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "introvert",
        title: "",
        description:
          "## Baseline\nRecharge solo or in low-stim settings; depth over breadth.\n\n### Strengths\n- Focus and deep connection\n- Thoughtful presence\n\n### Tips\n- Protect recharge windows\n- Choose depth-first plans\n",
      },
      {
        id: "ambivert",
        title: "",
        description:
          "## Baseline\nEnjoy both solo and social time; balance is key.\n\n### Strengths\n- Flexibility across contexts\n- Adaptive energy\n\n### Tips\n- Calendar anchor + free day\n- Mix group and 1:1 time\n",
      },
      {
        id: "extrovert",
        title: "",
        description:
          "## Baseline\nGain energy from groups and active environments.\n\n### Strengths\n- Momentum and network building\n- Enthusiasm and warmth\n\n### Tips\n- Add recovery sprints\n- Keep an eye on over-scheduling\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Social Battery Gauge\nHow you recharge and what drains you fastest.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q1_solo",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q1_mix",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q1_group",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q1_outdoor",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q2_noise",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q2_none",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q2_switching",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q2_smalltalk",
            label: "",
            weights: { introvert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q3_read",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q3_mix",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q3_events",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q3_walks",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q4_cocoon",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q4_select",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q4_party",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q4_longcall",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q5_short",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q5_medium",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q5_long",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q5_rotate",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q6_one",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q6_few",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q6_many",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q6_varies",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q7_low",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q7_mid",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q7_high",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q7_mix",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sb_q8_read",
            label: "",
            weights: { introvert: 1 },
          },
          {
            id: "sb_q8_walk",
            label: "",
            weights: { ambivert: 1 },
          },
          {
            id: "sb_q8_event",
            label: "",
            weights: { extrovert: 1 },
          },
          {
            id: "sb_q8_music",
            label: "",
            weights: { ambivert: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "peoplePleasingTendenciesTest",
    title: "",
    ball: "questions",
    tKey: "peoplePleasingTendenciesTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "low",
        title: "",
        description:
          "## Baseline\nYou rarely trade your needs for harmony; friction is tolerated.\n\n### Strengths\n- Directness and clarity\n- Self-respect and boundaries\n\n### Tips\n- Keep kindness + firmness paired\n- Invite others’ needs explicitly\n",
      },
      {
        id: "moderate",
        title: "",
        description:
          '## Baseline\nYou sometimes over-give or delay no’s. Awareness helps recalibrate.\n\n### Signals\n- Subtle resentment after yes\n- Delayed boundary setting\n\n### Tips\n- Use tiny, early no’s\n- Track "should" spikes\n',
      },
      {
        id: "high",
        title: "",
        description:
          "## Baseline\nYou often sideline needs to avoid conflict or rejection.\n\n### Signals\n- Chronic over-commitment\n- Anxiety around others’ feelings\n\n### Tips\n- Script gentle no’s in advance\n- Practice tolerating short-term discomfort\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# People-Pleasing Tendencies (Fawn)\nWhere you trade needs for harmony and how often.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q1_no",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q1_maybe",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q1_yes",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q1_delay",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q2_state",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q2_smooth",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q2_fold",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q2_joke",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q3_useful",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q3_tense",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q3_threat",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q3_shut",
            label: "",
            weights: { high: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q4_no",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q4_boundary",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q4_needs",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q4_check",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q5_authority",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q5_friend",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q5_many",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q5_stranger",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q6_body",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q6_apology",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q6_speed",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q6_resent",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q7_name",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q7_small_step",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q7_ignore",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "pp_q7_delay",
            label: "",
            weights: { high: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "pp_q8_time",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "pp_q8_swap",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q8_no_explain",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "pp_q8_followup",
            label: "",
            weights: { low: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "spontaneityVsPlanningDialTest",
    title: "",
    ball: "questions",
    tKey: "spontaneityVsPlanningDialTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "spontaneous",
        title: "",
        description:
          "## Orientation\nYou thrive with freedom and last-minute flow.\n\n### Strengths\n- Creativity and responsiveness\n- Enjoy discovery\n\n### Tips\n- Add one anchor to reduce friction\n- Keep backup options lightweight\n",
      },
      {
        id: "balanced",
        title: "",
        description:
          "## Orientation\nYou like light structure with room for surprises.\n\n### Strengths\n- Adaptable planning\n- Good trade-off sense\n\n### Tips\n- Protect anchors in the calendar\n- Leave intentional white space\n",
      },
      {
        id: "planner",
        title: "",
        description:
          "## Orientation\nYou prefer structure and advance planning for ease.\n\n### Strengths\n- Predictability and preparedness\n- Lower decision fatigue\n\n### Tips\n- Build flex buffers\n- Try small spontaneous reps\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Spontaneity vs Planning Dial\nFind your sweet spot between last-minute flow and structure.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q1_lastmin",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q1_mix",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q1_itinerary",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q1_hold",
            label: "",
            weights: { spontaneous: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q2_excited",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q2_ok",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q2_stress",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q2_swap",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q3_wing",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q3_blocks",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q3_detail",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q3_backup",
            label: "",
            weights: { planner: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q4_calendar",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q4_list",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q4_map",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q4_anchor",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q5_yes",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q5_maybe",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q5_no",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q5_small",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q6_full",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q6_mixed",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q6_light",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q6_theme",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q7_vote",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q7who",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q7rotate",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q7mix",
            label: "",
            weights: { balanced: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "sp_q8_none",
            label: "",
            weights: { spontaneous: 1 },
          },
          {
            id: "sp_q8_list",
            label: "",
            weights: { planner: 1 },
          },
          {
            id: "sp_q8_one",
            label: "",
            weights: { balanced: 1 },
          },
          {
            id: "sp_q8_switch",
            label: "",
            weights: { spontaneous: 1 },
          },
        ],
      },
    ],
  },
  {
    id: "riskAppetiteCheckTest",
    title: "",
    ball: "questions",
    tKey: "riskAppetiteCheckTest",
    type: "question",
    isReviewed: true,
    slotsForAIGeneration: ["evening"],
    traits: [
      {
        id: "low",
        title: "",
        description:
          "## Baseline\nPrefer safety, proven paths, and measured change.\n\n### Strengths\n- Stability and endurance\n- Downside protection\n\n### Tips\n- Take tiny experimental reps\n- Use capped-risk trials\n",
      },
      {
        id: "moderate",
        title: "",
        description:
          "## Baseline\nCalculated risks with safeguards and reviews.\n\n### Strengths\n- Balanced portfolios\n- Sensible timing\n\n### Tips\n- Define stop-loss and success metrics\n- Review cadence (monthly/quarterly)\n",
      },
      {
        id: "high",
        title: "",
        description:
          "## Baseline\nComfortable with bold bets for outsized upside.\n\n### Strengths\n- Momentum and innovation\n- Tolerance for ambiguity\n\n### Tips\n- Add risk caps and contingencies\n- Track downside explicitly\n",
      },
    ],
    pages: [
      {
        component: "markdownPreview",
        description:
          "# Risk Appetite Check\nHow you approach risk across money, career, relationships, and health.",
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q1_safe",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q1_mixed",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q1_bold",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q1_learn",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q2_stable",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q2_calc",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q2_venture",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q2_switch",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q3_slow",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q3_open",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q3_leap",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q3_bound",
            label: "",
            weights: { low: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q4_proven",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q4_trial",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q4_experiment",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q4_coach",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q5_free",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q5_mix",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q5_big",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q5_shadow",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q6_core",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q6_20",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q6_40",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q6_spike",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q7_short",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q7_long",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q7_many",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q7_few",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
      {
        component: "question",
        description: "",
        questions: [
          {
            id: "risk_q8_insurance",
            label: "",
            weights: { low: 1 },
          },
          {
            id: "risk_q8_caps",
            label: "",
            weights: { moderate: 1 },
          },
          {
            id: "risk_q8_none",
            label: "",
            weights: { high: 1 },
          },
          {
            id: "risk_q8_plan_b",
            label: "",
            weights: { moderate: 1 },
          },
        ],
      },
    ],
  },
];

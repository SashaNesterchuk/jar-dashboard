import { aspirationAction } from "./aspirationsAction";
import { identityAndValues } from "./indetityAndValues";
import { innerChild } from "./innerChild";
import { memoriesAndMilestones } from "./memoriesAndMilestones";
import { purposeVision } from "./purposeVision";
import { relationshipsEmotions } from "./relationshipsEmotions";
import { selfAwareness } from "./selfAwareness";
import { emotionalResilience } from "./emotionalResilience";
import { growthMindset } from "./growthMindset";
import { authenticity } from "./authenticity";
import { templates } from "./templates";

const questionJournalArray = [
  selfAwareness,
  identityAndValues,
  innerChild,
  memoriesAndMilestones,
  purposeVision,
  relationshipsEmotions,
  aspirationAction,
  emotionalResilience,
  growthMindset,
  authenticity,
];

const journalArrays = [
  selfAwareness,
  identityAndValues,
  innerChild,
  memoriesAndMilestones,
  purposeVision,
  relationshipsEmotions,
  aspirationAction,
  emotionalResilience,
  growthMindset,
  authenticity,
  templates,
];

const maxLength = Math.max(...journalArrays.map((arr) => arr.length));
export const journals = Array.from({ length: maxLength }, (_, i) =>
  journalArrays.map((arr) => arr[i]).filter(Boolean)
).flat();

export const questionJournals = Array.from({ length: maxLength }, (_, i) =>
  questionJournalArray.map((arr) => arr[i]).filter(Boolean)
).flat();

/**
 * Bundled copy of `jar/assets/locales/en/questions.json` (Next only resolves files inside this app).
 * Re-copy when updating app strings: `cp ../jar/assets/locales/en/questions.json src/data/self-discovery-questions.en.json`
 */
import questionsAsset from "@/data/self-discovery-questions.en.json";

type JsonQuestion = { label: string };
type JsonPage = {
  description?: string;
  questions?: JsonQuestion[];
};
type JsonTrait = { title?: string; description?: string };
type JsonPractice = {
  title?: string;
  description?: string;
  pages?: JsonPage[];
  traits?: JsonTrait[];
};

const practiceMap = questionsAsset.selfDiscoveryPractice as Record<
  string,
  JsonPractice | undefined
>;

export function getSelfDiscoveryTitleEn(tKey: string): string {
  const t = practiceMap[tKey]?.title?.trim();
  return t || "";
}

export function getSelfDiscoveryPageEn(
  tKey: string,
  pageIndex: number
): JsonPage | null {
  const pages = practiceMap[tKey]?.pages;
  if (!pages || pageIndex < 0 || pageIndex >= pages.length) return null;
  return pages[pageIndex] ?? null;
}

export function getSelfDiscoveryQuestionLabelEn(
  tKey: string,
  pageIndex: number,
  questionIndex: number
): string | null {
  const page = getSelfDiscoveryPageEn(tKey, pageIndex);
  const label = page?.questions?.[questionIndex]?.label;
  if (label == null || !String(label).trim()) return null;
  return String(label).trim();
}

export function getSelfDiscoveryTraitEn(
  tKey: string,
  traitIndex: number
): { title: string; description: string } | null {
  const trait = practiceMap[tKey]?.traits?.[traitIndex];
  if (!trait) return null;
  return {
    title: (trait.title ?? "").trim(),
    description:
      typeof trait.description === "string" ? trait.description.trim() : "",
  };
}

/**
 * Mirror of jar/events/checkIn.tsx (emotions, tagCategories, tags).
 * Keep in sync when the app check-in config changes.
 */

export type CheckInMood = "great" | "good" | "ok" | "bad" | "awful";

export type CatalogEmotion = {
  tKey: string;
  label: string;
  moodDependencies: CheckInMood[];
  isVisible: boolean;
};

export type CatalogTagCategory = {
  id: string;
  label: string;
};

export type CatalogTag = {
  tKey: string;
  label: string;
  categoryId: string;
};

export const checkInEmotions: CatalogEmotion[] = [
  { tKey: "joyful", label: "Joyful", moodDependencies: ["great"], isVisible: true },
  { tKey: "excited", label: "Excited", moodDependencies: ["great"], isVisible: true },
  { tKey: "grateful", label: "Grateful", moodDependencies: ["great"], isVisible: true },
  { tKey: "proud", label: "Proud", moodDependencies: ["great"], isVisible: true },
  { tKey: "confident", label: "Confident", moodDependencies: ["great"], isVisible: true },
  { tKey: "energized", label: "Energized", moodDependencies: ["great"], isVisible: false },
  { tKey: "inspired", label: "Inspired", moodDependencies: ["great"], isVisible: false },
  { tKey: "empowered", label: "Empowered", moodDependencies: ["great"], isVisible: false },
  { tKey: "fulfilled", label: "Fulfilled", moodDependencies: ["great"], isVisible: false },
  { tKey: "thriving", label: "Thriving", moodDependencies: ["great"], isVisible: false },
  { tKey: "happy", label: "Happy", moodDependencies: ["good"], isVisible: true },
  { tKey: "hopeful", label: "Hopeful", moodDependencies: ["good"], isVisible: true },
  { tKey: "satisfied", label: "Satisfied", moodDependencies: ["good"], isVisible: true },
  { tKey: "peaceful", label: "Peaceful", moodDependencies: ["good"], isVisible: true },
  { tKey: "content", label: "Content", moodDependencies: ["good"], isVisible: true },
  { tKey: "pleased", label: "Pleased", moodDependencies: ["good"], isVisible: false },
  { tKey: "relieved", label: "Relieved", moodDependencies: ["good"], isVisible: false },
  { tKey: "optimistic", label: "Optimistic", moodDependencies: ["good"], isVisible: false },
  { tKey: "comfortable", label: "Comfortable", moodDependencies: ["good"], isVisible: false },
  { tKey: "relaxed", label: "Relaxed", moodDependencies: ["good"], isVisible: false },
  { tKey: "calm", label: "Calm", moodDependencies: ["ok"], isVisible: true },
  { tKey: "neutral", label: "Neutral", moodDependencies: ["ok"], isVisible: true },
  { tKey: "indifferent", label: "Indifferent", moodDependencies: ["ok"], isVisible: true },
  { tKey: "fine", label: "Fine", moodDependencies: ["ok"], isVisible: true },
  { tKey: "alright", label: "Alright", moodDependencies: ["ok"], isVisible: true },
  { tKey: "meh", label: "Meh", moodDependencies: ["ok"], isVisible: false },
  { tKey: "detached", label: "Detached", moodDependencies: ["ok"], isVisible: false },
  { tKey: "unfocused", label: "Unfocused", moodDependencies: ["ok"], isVisible: false },
  { tKey: "unengaged", label: "Unengaged", moodDependencies: ["ok"], isVisible: false },
  { tKey: "flat", label: "Flat", moodDependencies: ["ok"], isVisible: false },
  { tKey: "stressed", label: "Stressed", moodDependencies: ["bad"], isVisible: true },
  { tKey: "anxious", label: "Anxious", moodDependencies: ["bad"], isVisible: true },
  { tKey: "tired", label: "Tired", moodDependencies: ["bad"], isVisible: true },
  { tKey: "frustrated", label: "Frustrated", moodDependencies: ["bad"], isVisible: true },
  { tKey: "disappointed", label: "Disappointed", moodDependencies: ["bad"], isVisible: true },
  { tKey: "overwhelmed", label: "Overwhelmed", moodDependencies: ["bad"], isVisible: false },
  { tKey: "annoyed", label: "Annoyed", moodDependencies: ["bad"], isVisible: false },
  { tKey: "drained", label: "Drained", moodDependencies: ["bad"], isVisible: false },
  { tKey: "restless", label: "Restless", moodDependencies: ["bad"], isVisible: false },
  { tKey: "insecure", label: "Insecure", moodDependencies: ["bad"], isVisible: false },
  { tKey: "sad", label: "Sad", moodDependencies: ["awful"], isVisible: true },
  { tKey: "depressed", label: "Depressed", moodDependencies: ["awful"], isVisible: true },
  { tKey: "angry", label: "Angry", moodDependencies: ["awful"], isVisible: true },
  { tKey: "lonely", label: "Lonely", moodDependencies: ["awful"], isVisible: true },
  { tKey: "hopeless", label: "Hopeless", moodDependencies: ["awful"], isVisible: true },
  { tKey: "hurt", label: "Hurt", moodDependencies: ["awful"], isVisible: false },
  { tKey: "guilty", label: "Guilty", moodDependencies: ["awful"], isVisible: false },
  { tKey: "ashamed", label: "Ashamed", moodDependencies: ["awful"], isVisible: false },
  { tKey: "broken", label: "Broken", moodDependencies: ["awful"], isVisible: false },
  { tKey: "empty", label: "Empty", moodDependencies: ["awful"], isVisible: false },
];

export const checkInTagCategories: CatalogTagCategory[] = [
  { id: "people", label: "People" },
  { id: "places", label: "Places" },
  { id: "activities", label: "Activities" },
  { id: "weather", label: "Weather" },
];

export const checkInTags: CatalogTag[] = [
  { tKey: "alone", label: "Alone", categoryId: "people" },
  { tKey: "family", label: "Family", categoryId: "people" },
  { tKey: "partner", label: "Partner", categoryId: "people" },
  { tKey: "friends", label: "Friends", categoryId: "people" },
  { tKey: "colleagues", label: "Colleagues", categoryId: "people" },
  { tKey: "pet", label: "Pet", categoryId: "people" },
  { tKey: "home", label: "Home", categoryId: "places" },
  { tKey: "work", label: "Work", categoryId: "places" },
  { tKey: "street", label: "Street", categoryId: "places" },
  { tKey: "nature", label: "Nature", categoryId: "places" },
  { tKey: "community", label: "Community", categoryId: "places" },
  { tKey: "restaurant", label: "Restaurant", categoryId: "places" },
  { tKey: "walk", label: "Walk", categoryId: "activities" },
  { tKey: "food", label: "Food", categoryId: "activities" },
  { tKey: "sport", label: "Sport", categoryId: "activities" },
  { tKey: "hobby", label: "Hobby", categoryId: "activities" },
  { tKey: "party", label: "Party", categoryId: "activities" },
  { tKey: "rest", label: "Rest", categoryId: "activities" },
  { tKey: "sunny", label: "Sunny", categoryId: "weather" },
  { tKey: "cloudy", label: "Cloudy", categoryId: "weather" },
  { tKey: "rain", label: "Rain", categoryId: "weather" },
  { tKey: "storm", label: "Storm", categoryId: "weather" },
  { tKey: "snow", label: "Snow", categoryId: "weather" },
  { tKey: "heat", label: "Heat", categoryId: "weather" },
  { tKey: "wind", label: "Wind", categoryId: "weather" },
];

export function emotionsForMood(mood: CheckInMood): CatalogEmotion[] {
  return checkInEmotions.filter((e) => e.moodDependencies.includes(mood));
}

/** Emotions for this mood first, then all other moods (stable order within each group). */
export function emotionsPrimaryThenOthers(mood: CheckInMood): {
  primary: CatalogEmotion[];
  others: CatalogEmotion[];
} {
  const primary = checkInEmotions.filter((e) =>
    e.moodDependencies.includes(mood)
  );
  const primaryKeys = new Set(primary.map((e) => e.tKey));
  const others = checkInEmotions.filter((e) => !primaryKeys.has(e.tKey));
  return { primary, others };
}

export function tagsForCategory(categoryId: string): CatalogTag[] {
  return checkInTags.filter((t) => t.categoryId === categoryId);
}

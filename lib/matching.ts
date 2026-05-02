export const MATCH_CATEGORIES = [
  "mindset",
  "emotional",
  "lifestyle",
  "money",
  "habits",
  "relationship"
] as const;

export type MatchCategory = (typeof MATCH_CATEGORIES)[number];
export type CategoryScores = Partial<Record<MatchCategory, number>>;

export function formatCategoryName(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function topCategories(scores: CategoryScores, limit = 3) {
  return Object.entries(scores)
    .sort(([, a = 0], [, b = 0]) => b - a)
    .slice(0, limit) as Array<[MatchCategory, number]>;
}

export function weakestCategory(scores: CategoryScores) {
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;
  return entries.sort(([, a = 0], [, b = 0]) => a - b)[0] as [MatchCategory, number];
}

export function buildInsights(scores: CategoryScores) {
  const insights: string[] = [];

  if ((scores.mindset ?? 0) > 80) {
    insights.push("You both value long-term thinking.");
  }
  if ((scores.emotional ?? 0) > 75) {
    insights.push("You handle pressure in similar ways.");
  }
  if ((scores.relationship ?? 0) > 80) {
    insights.push("You share values around trust and loyalty.");
  }
  if ((scores.lifestyle ?? 0) > 75) {
    insights.push("Your daily energy patterns align closely.");
  }
  if ((scores.money ?? 0) > 72) {
    insights.push("You view money through a similar lens of security and ambition.");
  }
  if ((scores.habits ?? 0) > 72) {
    insights.push("Your growth habits suggest a compatible pace of life.");
  }

  return insights.length > 0
    ? insights
    : ["Your strongest compatibility comes from a consistent pattern across multiple categories."];
}

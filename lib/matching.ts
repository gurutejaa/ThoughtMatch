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

const CATEGORY_REASON_TEMPLATES: Record<MatchCategory, string> = {
  mindset: "You tend to think through choices in a similar way, which gives the match a shared mental rhythm.",
  emotional: "Your emotional responses move at a similar pace, so the match feels easier to understand and hold.",
  lifestyle: "Your daily energy and way of moving through life line up more naturally than not.",
  money: "You seem to approach stability, comfort, and ambition through a similar lens.",
  habits: "Your routines and self-management style suggest a compatible pace in real life.",
  relationship: "You appear to want similar things from closeness, trust, and connection."
};

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

export function buildCategoryReasons(scores: CategoryScores, limit = 3) {
  return topCategories(scores, limit).map(([category]) => CATEGORY_REASON_TEMPLATES[category]);
}

export function buildMatchSummary(scores: CategoryScores, sharedAnswerCount?: number) {
  const strongest = topCategories(scores, 2);
  const strongestNames = strongest.map(([category]) => formatCategoryName(category).toLowerCase());

  if (strongestNames.length >= 2) {
    return `Your strongest alignment shows up in ${strongestNames[0]} and ${strongestNames[1]}, with enough consistency across the full set of answers to make this match feel intentional.`;
  }

  if (strongestNames.length === 1) {
    return `Your strongest alignment shows up in ${strongestNames[0]}, and the rest of your answers still support a meaningful overall fit.`;
  }

  if (sharedAnswerCount && sharedAnswerCount > 0) {
    return `This match comes from a steady pattern across ${sharedAnswerCount} shared answers, not just one or two isolated overlaps.`;
  }

  return "This match comes from a consistent compatibility pattern across the answers you both gave.";
}

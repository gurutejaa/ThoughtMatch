export type AdminAnswerRecord = {
  user_id: string;
  question_id: string;
  answer_index: number | null;
  answer_text: string | null;
};

export type AdminQuestionRecord = {
  id: string;
  text: string;
  category: string | null;
  question_type: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  day_number: number | null;
  order_in_day: number | null;
};

type ScoreResult = {
  earned: number;
  max: number;
  exactMatch: boolean;
};

function normalizeType(value: string | null | undefined) {
  return value === "multiple_choice" ? "options" : (value ?? "options");
}

function tokenize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreStructuredDistance(a: number, b: number, maxDistance: number) {
  const distance = Math.abs(a - b);
  const closeness = Math.max(0, 1 - distance / Math.max(1, maxDistance));
  return Math.round(closeness * 10);
}

function scoreTextSimilarity(a: string | null, b: string | null) {
  const normalizedA = normalizeComparableText(a);
  const normalizedB = normalizeComparableText(b);

  if (normalizedA.length > 0 && normalizedA === normalizedB) {
    return { earned: 4, max: 4, exactMatch: true };
  }

  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return { earned: 0, max: 4, exactMatch: false };
  }

  const overlap = Array.from(tokensA).filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const similarity = union > 0 ? overlap / union : 0;

  if (similarity >= 0.6) {
    return { earned: 4, max: 4, exactMatch: false };
  }

  if (similarity >= 0.25) {
    return { earned: 2, max: 4, exactMatch: false };
  }

  return { earned: 0, max: 4, exactMatch: false };
}

export function scorePairAnswer(
  questionType: string | null,
  answerA: AdminAnswerRecord | undefined,
  answerB: AdminAnswerRecord | undefined
): ScoreResult {
  const normalizedType = normalizeType(questionType);

  if (!answerA || !answerB) {
    return { earned: 0, max: 0, exactMatch: false };
  }

  if (normalizedType === "slider") {
    const a = answerA.answer_index ?? 50;
    const b = answerB.answer_index ?? 50;
    const earned = scoreStructuredDistance(a, b, 100);
    return {
      earned,
      max: 10,
      exactMatch: a === b
    };
  }

  if (normalizedType === "binary") {
    const exactMatch = answerA.answer_index === answerB.answer_index;
    return {
      earned: exactMatch ? 10 : 0,
      max: 10,
      exactMatch
    };
  }

  if (normalizedType === "short_text" || normalizedType === "fill_blank") {
    return scoreTextSimilarity(answerA.answer_text, answerB.answer_text);
  }

  const a = answerA.answer_index ?? 0;
  const b = answerB.answer_index ?? 0;
  const earned = scoreStructuredDistance(a, b, 3);
  return {
    earned,
    max: 10,
    exactMatch: a === b
  };
}

export function formatCategoryName(category: string | null | undefined) {
  if (!category) {
    return "General";
  }

  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

export function getAnswerLabel(question: AdminQuestionRecord, answer: AdminAnswerRecord | undefined) {
  if (!answer) {
    return "No answer";
  }

  const normalizedType = normalizeType(question.question_type);

  if (normalizedType === "short_text" || normalizedType === "fill_blank") {
    return answer.answer_text?.trim() || "No answer";
  }

  if (normalizedType === "slider") {
    return String(answer.answer_index ?? 50);
  }

  if (normalizedType === "binary") {
    return (answer.answer_index ?? 0) === 1 ? "Yes" : "No";
  }

  const options = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d
  ];
  const option = options[answer.answer_index ?? -1];

  return option ?? `Option ${(answer.answer_index ?? 0) + 1}`;
}

import type { Question } from "@/lib/types";

export type Grade = "A" | "B" | "C" | "D" | "U";

/** Highest band first. A band applies from `min` percent upwards. */
export const GRADE_BANDS: readonly { grade: Grade; min: number }[] = [
  { grade: "A", min: 80 },
  { grade: "B", min: 65 },
  { grade: "C", min: 50 },
  { grade: "D", min: 40 },
  { grade: "U", min: 0 },
];

/** Grade from the exact ratio, never the rounded display percentage. */
export function gradeFor(score: number, total: number): Grade {
  const pct = total > 0 ? (score / total) * 100 : 0;
  return (GRADE_BANDS.find((b) => pct >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]).grade;
}

/** Percentage rounded to one decimal place for display (62.5, 68.8). */
export function percentOf(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
}

/** How many more marks would reach the next grade up, or null at the top. */
export function marksToNextGrade(
  score: number,
  total: number,
): { grade: Grade; minPercent: number; marksNeeded: number } | null {
  const current = gradeFor(score, total);
  const index = GRADE_BANDS.findIndex((b) => b.grade === current);
  if (index <= 0) return null;
  const next = GRADE_BANDS[index - 1];
  const needed = Math.ceil((next.min / 100) * total - 1e-9) - score;
  return { grade: next.grade, minPercent: next.min, marksNeeded: Math.max(needed, 1) };
}

/** Lower-case, collapse spaces and drop trailing punctuation so "Surplus. " matches "surplus". */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
}

/** True when the response has any real content. */
export function hasAnswer(kind: Question["kind"], response: string | null | undefined): boolean {
  if (response == null) return false;
  return kind === "fill_blank" || kind === "written" ? normalizeText(response) !== "" : response !== "";
}

/**
 * Marks an objective question. Returns null for written questions, which wait for the teacher.
 */
export function markObjective(question: Question, response: string | null): number | null {
  const key = question.answerKey;
  switch (key.kind) {
    case "mcq":
      return response === key.correct ? question.points : 0;
    case "true_false":
      return response === String(key.correct) ? question.points : 0;
    case "fill_blank":
      return key.accepted.some((a) => normalizeText(a) === normalizeText(response)) && normalizeText(response) !== ""
        ? question.points
        : 0;
    case "written":
      return null;
  }
}

import type { ImportedExam, QuestionDraft } from "@/lib/staff-types";
import type { QuestionKind } from "@/lib/types";

/**
 * "Import with AI": the teacher copies this prompt into any AI assistant together with their
 * exam material, then pastes the JSON reply back. Everything is checked here, and imported
 * questions arrive unapproved so the teacher still reads every answer key.
 */

export const IMPORT_PROMPT = [
  "This is the format for an exam on my teaching platform. Do whatever I ask below (turn my existing questions into",
  "this format, write new questions from my notes, change a few, or anything else), and give me the result in this format.",
  "",
  "Reply with JSON only, no other text, in exactly this shape:",
  "{",
  '  "title": "Exam title",',
  '  "time_limit_minutes": 30,',
  '  "rules": "Rules for students, or empty",',
  '  "questions": [',
  '    { "type": "mcq", "prompt": "...", "points": 1,',
  '      "options": ["A text", "B text", "C text", "D text"], "answer": "A" },',
  '    { "type": "true_false", "prompt": "...", "points": 1, "answer": true },',
  '    { "type": "fill_blank", "prompt": "Sentence with ____ for the gap", "points": 1,',
  '      "accepted_answers": ["main answer", "other accepted answer"] },',
  '    { "type": "written", "prompt": "...", "points": 4,',
  '      "marking_points": ["point 1", "point 2"] }',
  "  ]",
  "}",
  "",
  "Format rules:",
  "- type is one of: mcq, true_false, fill_blank, written.",
  "- mcq has exactly 4 options; answer is A, B, C or D.",
  "- fill_blank has exactly one gap, written as ____ (four underscores), and lists every accepted answer.",
  "- written lists the marking points a marker should look for.",
  "- points is a whole number of 1 or more.",
  "- Include the answer for every question you write. If I give you a question without an answer, use null",
  "  (or an empty list) instead of guessing.",
  "",
  "What I want you to do:",
].join("\n");

export const IMPORT_SAMPLE: ImportedExam = {
  title: "Unit 3 Test: Demand and Supply",
  time_limit_minutes: 30,
  rules: "Calculators are not allowed.",
  questions: [
    {
      type: "mcq",
      prompt: "For a normal good, what happens to the demand curve when consumers’ incomes rise?",
      points: 1,
      options: ["It shifts to the right", "It shifts to the left", "There is a movement along the curve", "It becomes vertical"],
      answer: "A",
    },
    { type: "true_false", prompt: "A fall in the price of a good causes a contraction in the quantity demanded.", points: 1, answer: false },
    { type: "fill_blank", prompt: "The price at which quantity demanded equals quantity supplied is called the ____ price.", points: 1, accepted_answers: [] },
    {
      type: "written",
      prompt: "Explain two reasons why the demand for petrol in the Maldives may be price inelastic.",
      points: 4,
      marking_points: ["Petrol is a necessity", "People keep buying it when the price rises", "Few or no close substitutes", "Consumers cannot easily switch"],
    },
  ],
};

export interface ImportRow {
  n: number;
  kind: QuestionKind | null;
  points: number;
  /** "Answer A", "2 accepted", … */
  keyText: string;
  prompt: string;
  issue: string | null;
}

export interface ImportResult {
  error: string | null;
  rows: ImportRow[];
  drafts: QuestionDraft[];
  marks: number;
  issues: number;
  meta: { title?: string; minutes?: number; rules?: string };
}

const KINDS: QuestionKind[] = ["mcq", "true_false", "fill_blank", "written"];
const EMPTY: ImportResult = { error: null, rows: [], drafts: [], marks: 0, issues: 0, meta: {} };

/** Pull the JSON out of whatever the assistant replied (they often wrap it in a code fence). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  const json = text.slice(start, end + 1);
  try {
    return JSON.parse(json);
  } catch {
    // Copying from a chat window often adds debris: line-end backslashes, "&#x20;" for spaces, "\_" for "_".
    return JSON.parse(repairPaste(json));
  }
}

/** Undo what copying from a chat page does to JSON, without touching text that was already fine. */
function repairPaste(text: string): string {
  const named: Record<string, string> = { nbsp: " ", quot: '"', amp: "&", lt: "<", gt: ">", apos: "'" };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(nbsp|quot|amp|lt|gt|apos);/g, (_, n: string) => named[n])
    .replace(/ /g, " ")
    // a backslash that isn't a real JSON escape (a line-end "\" or "\_") is just dropped
    .replace(/\\([\s\S])/g, (m, c: string) => (/["\\/bfnrtu]/.test(c) ? m : c));
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter((x) => x.trim()) : []);

export function parseImport(text: string): ImportResult {
  if (!text.trim()) return EMPTY;

  let data: ImportedExam;
  try {
    data = extractJson(text) as ImportedExam;
  } catch {
    return { ...EMPTY, error: "That doesn’t look like the right format yet. Make sure you pasted everything the AI replied, starting with {" };
  }
  if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
    return { ...EMPTY, error: "No questions found. Check the AI used the format from step 1." };
  }

  const rows: ImportRow[] = [];
  const drafts: QuestionDraft[] = [];
  let marks = 0;
  let issues = 0;

  data.questions.forEach((q, i) => {
    const kind = KINDS.find((k) => k === q.type) ?? null;
    const prompt = str(q.prompt).trim();
    const points = Math.round(Number(q.points)) || 0;
    let issue: string | null = null;
    let keyText = "";

    const draft: QuestionDraft = {
      kind: kind ?? "mcq",
      prompt,
      points: points > 0 ? points : 1,
      options: ["", "", "", ""],
      correct: "",
      trueFalse: null,
      accepted: [],
      markingPoints: [],
      approved: false,
    };

    if (!kind) {
      issue = "Unknown question type, so this one is skipped";
    } else if (kind === "mcq") {
      const options = strList(q.options);
      draft.options = [0, 1, 2, 3].map((n) => options[n] ?? "");
      const answer = str(q.answer).trim().toUpperCase();
      draft.correct = ["A", "B", "C", "D"].includes(answer) ? answer : "";
      keyText = draft.correct ? `Answer ${draft.correct}` : "No answer";
      if (!draft.correct) issue = "Add the correct option";
      if (options.length !== 4) issue = "Needs exactly 4 options";
    } else if (kind === "true_false") {
      const a = typeof q.answer === "string" ? q.answer.trim().toLowerCase() : q.answer;
      draft.trueFalse = a === true || a === "true" ? true : a === false || a === "false" ? false : null;
      keyText = draft.trueFalse === null ? "No answer" : draft.trueFalse ? "Answer: True" : "Answer: False";
      if (draft.trueFalse === null) issue = "Add the correct answer";
    } else if (kind === "fill_blank") {
      draft.accepted = strList(q.accepted_answers);
      keyText = draft.accepted.length ? `${draft.accepted.length} accepted` : "No answers";
      if (!draft.accepted.length) issue = "Add at least one accepted answer";
      else if (!/_{3,}/.test(prompt)) issue = "Put ____ in the sentence where the blank goes";
      if ((prompt.match(/_{3,}/g) ?? []).length > 1) issue = "Only one blank per question. Split it into separate questions";
    } else {
      draft.markingPoints = strList(q.marking_points);
      keyText = `${draft.markingPoints.length} marking points`;
      if (!draft.markingPoints.length) issue = "Add marking points";
    }

    if (kind && !prompt) issue = "This question has no text";
    if (kind && points < 1) issue = issue ?? "Give it at least 1 mark";

    if (kind) {
      drafts.push(draft);
      marks += draft.points;
    }
    if (issue) issues += 1;
    rows.push({ n: i + 1, kind, points: draft.points, keyText, prompt: prompt || "(no question text)", issue });
  });

  return {
    error: null,
    rows,
    drafts,
    marks,
    issues,
    meta: {
      title: str(data.title).trim() || undefined,
      minutes: Number(data.time_limit_minutes) > 0 ? Math.round(Number(data.time_limit_minutes)) : undefined,
      rules: str(data.rules).trim() || undefined,
    },
  };
}

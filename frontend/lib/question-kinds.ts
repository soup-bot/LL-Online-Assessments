import type { QuestionKind } from "@/lib/types";

/**
 * Visual identity for each question kind. Class names are written out in full so
 * Tailwind can see them; never build them from fragments.
 */
export const KIND_META: Record<
  QuestionKind,
  {
    label: string;
    /** Short badge text used in the rotated tile. */
    badge: string;
    /** Small helper line above the prompt. */
    tag: string;
    bg: string;
    fg: string;
  }
> = {
  mcq: { label: "Multiple choice", badge: "MC", tag: "Choose one answer", bg: "bg-lilac", fg: "text-lilac-ink" },
  true_false: { label: "True or false", badge: "TF", tag: "True or false?", bg: "bg-sky", fg: "text-sky-ink" },
  fill_blank: { label: "Fill in the blank", badge: "__", tag: "Complete the sentence", bg: "bg-mint", fg: "text-mint-ink" },
  written: { label: "Written answer", badge: "Ab", tag: "Write your answer", bg: "bg-peach", fg: "text-peach-ink" },
};

export const KIND_ORDER: QuestionKind[] = ["mcq", "true_false", "fill_blank", "written"];

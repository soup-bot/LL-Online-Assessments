/** Rules and limits shared by every screen. The API will serve the same values. */

export const MAX_VIOLATIONS = 3;

/** How long after the deadline the server still accepts a final save. */
export const SAVE_GRACE_MS = 5000;

/** Shown on every cover page, above the exam's own rules. */
export const GLOBAL_RULES = [
  {
    id: "violations",
    text: "Switching tabs, switching apps or leaving the exam window counts as a violation. You will be warned each time; after 3 violations your exam is submitted automatically.",
  },
  {
    id: "autosave",
    text: "Your answers save automatically. Stay connected to the internet while you work.",
  },
  {
    id: "timer",
    text: "When the timer reaches zero your exam is submitted with whatever you have saved.",
  },
] as const;

export type GlobalRuleId = (typeof GLOBAL_RULES)[number]["id"];

import type { AnswerRecord, Attempt, DbState, Exam, ExamSession, Question, SchoolClass, User } from "@/lib/types";

export const PASSWORD = "password";
export const DB_VERSION = 3;

export const USERS: User[] = [
  { id: 1, name: "Aishath Rasheed", email: "aishath@ll.test", role: "tutor", honorific: "Ms" },
  { id: 2, name: "Ali Shareef", email: "ali@ll.test", role: "tutor", honorific: "Mr" },
  { id: 3, name: "Hawwa Nadheema", email: "hawwa@ll.test", role: "student" },
  { id: 4, name: "Ibrahim Zayan", email: "ibrahim@ll.test", role: "student" },
  { id: 5, name: "Mariyam Leena", email: "mariyam@ll.test", role: "student" },
  { id: 6, name: "Ahmed Nashid", email: "ahmed@ll.test", role: "student" },
  { id: 7, name: "Mohamed Faisal", email: "admin@ll.test", role: "admin" },
];

const CLASSES: SchoolClass[] = [
  { id: 1, name: "IGCSE Economics, Batch A", subjectCode: "0455", grade: 10, tutorId: 1, studentIds: [3, 4, 5] },
  { id: 2, name: "IGCSE Economics, Batch B", subjectCode: "0455", grade: 10, tutorId: 1, studentIds: [6] },
];

const BLANK = "________";

const RULES_UNIT_3 = "Calculators are not allowed. Answer in full sentences for questions 7 and 8.";

/** The brief's exam, as it will exist once the tutor has built and published it. */
const UNIT_3_QUESTIONS: Question[] = [
  {
    id: 101,
    examId: 1,
    position: 1,
    kind: "mcq",
    prompt: "For a normal good, what happens to the demand curve when consumers’ incomes rise?",
    points: 1,
    options: [
      { key: "A", text: "It shifts to the right" },
      { key: "B", text: "It shifts to the left" },
      { key: "C", text: "There is a movement along the curve" },
      { key: "D", text: "It becomes vertical" },
    ],
    answerKey: { kind: "mcq", correct: "A" },
    approved: true,
  },
  {
    id: 102,
    examId: 1,
    position: 2,
    kind: "mcq",
    prompt: "Which of these changes the supply of a good?",
    points: 1,
    options: [
      { key: "A", text: "Consumer tastes" },
      { key: "B", text: "Costs of production" },
      { key: "C", text: "The price of a substitute in consumption" },
      { key: "D", text: "The size of the population" },
    ],
    answerKey: { kind: "mcq", correct: "B" },
    approved: true,
  },
  {
    id: 103,
    examId: 1,
    position: 3,
    kind: "true_false",
    prompt: "A fall in the price of a good causes a contraction in the quantity demanded.",
    points: 1,
    answerKey: { kind: "true_false", correct: false },
    approved: true,
  },
  {
    id: 104,
    examId: 1,
    position: 4,
    kind: "true_false",
    prompt: "Price elasticity of demand is negative for most goods.",
    points: 1,
    answerKey: { kind: "true_false", correct: true },
    approved: true,
  },
  {
    id: 105,
    examId: 1,
    position: 5,
    kind: "fill_blank",
    prompt: `When quantity supplied is greater than quantity demanded at a given price, there is a ${BLANK}.`,
    points: 1,
    answerKey: { kind: "fill_blank", accepted: ["surplus", "excess supply"] },
    approved: true,
  },
  {
    id: 106,
    examId: 1,
    position: 6,
    kind: "fill_blank",
    prompt: `The price at which quantity demanded equals quantity supplied is called the ${BLANK} price.`,
    points: 1,
    answerKey: { kind: "fill_blank", accepted: ["equilibrium", "market clearing"] },
    approved: true,
  },
  {
    id: 107,
    examId: 1,
    position: 7,
    kind: "written",
    prompt: "Explain two reasons why the demand for petrol in the Maldives may be price inelastic.",
    points: 4,
    answerKey: {
      kind: "written",
      markingPoints: [
        "Identifies that petrol is a necessity (for transport, boats, generators).",
        "Explains that people must keep buying it when the price rises, so quantity demanded changes little.",
        "Identifies that there are few or no close substitutes.",
        "Explains that consumers cannot easily switch, so demand responds less than proportionately to price.",
      ],
    },
    approved: true,
  },
  {
    id: 108,
    examId: 1,
    position: 8,
    kind: "written",
    prompt:
      "Analyse the effect of a rise in the cost of imported fish feed on the price and quantity of farmed fish sold in the Maldives.",
    points: 6,
    answerKey: {
      kind: "written",
      markingPoints: [
        "States that fish feed is a cost of production for fish farms.",
        "Explains that higher costs reduce supply.",
        "Says the supply curve shifts to the left.",
        "Concludes that the equilibrium price rises.",
        "Concludes that the equilibrium quantity falls.",
        "Uses the idea of a contraction along the demand curve, or comments on how big the change is depending on price elasticity of demand.",
      ],
    },
    approved: true,
  },
];

/** An earlier, already-released exam so the Results screens have history to show. */
const UNIT_2_QUESTIONS: Question[] = [
  {
    id: 201,
    examId: 2,
    position: 1,
    kind: "mcq",
    prompt: "Which of these makes the supply of a good more price elastic?",
    points: 1,
    options: [
      { key: "A", text: "Firms have plenty of spare capacity" },
      { key: "B", text: "Production takes a long time to increase" },
      { key: "C", text: "Raw materials are scarce" },
      { key: "D", text: "Stocks cannot be stored" },
    ],
    answerKey: { kind: "mcq", correct: "A" },
    approved: true,
  },
  {
    id: 202,
    examId: 2,
    position: 2,
    kind: "mcq",
    prompt: "A 10% rise in price causes a 20% fall in quantity demanded. What is the price elasticity of demand?",
    points: 1,
    options: [
      { key: "A", text: "-0.5" },
      { key: "B", text: "-2" },
      { key: "C", text: "+2" },
      { key: "D", text: "-10" },
    ],
    answerKey: { kind: "mcq", correct: "B" },
    approved: true,
  },
  {
    id: 203,
    examId: 2,
    position: 3,
    kind: "true_false",
    prompt: "A good with many close substitutes tends to have elastic demand.",
    points: 1,
    answerKey: { kind: "true_false", correct: true },
    approved: true,
  },
  {
    id: 204,
    examId: 2,
    position: 4,
    kind: "fill_blank",
    prompt: `A product with a price elasticity of demand greater than 1 is said to have ${BLANK} demand.`,
    points: 1,
    answerKey: { kind: "fill_blank", accepted: ["elastic", "price elastic"] },
    approved: true,
  },
  {
    id: 205,
    examId: 2,
    position: 5,
    kind: "written",
    prompt: "Explain why a firm selling a good with elastic demand may cut its price.",
    points: 4,
    answerKey: {
      kind: "written",
      markingPoints: [
        "Identifies that a price cut causes a more than proportionate rise in quantity demanded.",
        "Explains that total revenue therefore rises.",
        "Links elasticity to the availability of substitutes.",
        "Develops the chain of reasoning in full sentences.",
      ],
    },
    approved: true,
  },
];

const EXAMS: Exam[] = [
  { id: 1, title: "Unit 3 Test: Demand and Supply", ownerId: 1, timeLimitMinutes: 30, rules: RULES_UNIT_3, status: "published" },
  { id: 2, title: "Unit 2 Test: Elasticity", ownerId: 1, timeLimitMinutes: 20, rules: "Calculators are allowed.", status: "published" },
];

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 24 * 60 * 60 * 1000;

/**
 * Seed for student-side development. The final Laravel seeder follows the brief exactly
 * (exam unpublished, nothing open); here Unit 3 is already open for Batch A so a student
 * can sit it straight away, and Batch B stays closed to prove the isolation.
 */
export function buildSeed(): DbState {
  const sessions: ExamSession[] = [
    { id: 1, examId: 1, classId: 1, status: "open", resultsReleasedAt: null },
    { id: 2, examId: 1, classId: 2, status: "not_open", resultsReleasedAt: null },
    { id: 3, examId: 2, classId: 1, status: "closed", resultsReleasedAt: iso(-6 * DAY) },
  ];

  const unit2Start = iso(-7 * DAY);
  const attempts: Attempt[] = [
    {
      id: 1,
      sessionId: 3,
      studentId: 3,
      startedAt: unit2Start,
      deadlineAt: new Date(Date.parse(unit2Start) + 20 * 60 * 1000).toISOString(),
      submittedAt: new Date(Date.parse(unit2Start) + 17 * 60 * 1000).toISOString(),
      submitReason: "manual",
      status: "marked",
      violationCount: 0,
      overallComment:
        "Good, steady work, Hawwa. You know your elasticity vocabulary well. Next time, take the extra minute to link each point back to the question.",
      resultViewedAt: iso(-5 * DAY),
    },
  ];

  const a = (questionId: number, response: string | null, awardedMarks: number | null, feedback: string | null = null): AnswerRecord => ({
    attemptId: 1,
    questionId,
    response,
    flagged: false,
    awardedMarks,
    feedback,
  });

  const answers: AnswerRecord[] = [
    a(201, "A", 1),
    a(202, "B", 1),
    a(203, "false", 0),
    a(204, "elastic", 1),
    a(
      205,
      "A firm may cut its price because if demand is elastic, people will buy a lot more when the price falls, so the firm earns more revenue overall.",
      3,
      "Clear and correct on the revenue effect. Add why demand is elastic, for example that there are many close substitutes, to reach full marks.",
    ),
  ];

  return {
    version: DB_VERSION,
    users: USERS,
    classes: CLASSES,
    exams: EXAMS,
    questions: [...UNIT_3_QUESTIONS, ...UNIT_2_QUESTIONS],
    sessions,
    attempts,
    answers,
    violations: [],
    nextAttemptId: 2,
  };
}

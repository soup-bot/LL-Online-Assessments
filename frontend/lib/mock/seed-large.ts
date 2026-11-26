import type { AnswerRecord, Attempt, DbState, Exam, ExamSession, Question, SchoolClass, User, ViolationRecord } from "@/lib/types";

/**
 * Bulk demo data for stress-testing the teacher and admin screens: many classes (one with 100
 * students), dozens of exams in every state, and a lot of submissions waiting to be marked.
 * Deterministic, so a reset always produces the same school. The student demo (Ibrahim, Hawwa,
 * Mariyam, Unit 3) is left alone: nothing added here is open for the original classes.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Aminath", "Mohamed", "Fathimath", "Ahmed", "Aishath", "Ibrahim", "Mariyam", "Hussain", "Khadheeja", "Ali", "Zahra", "Yoosuf", "Shaaira", "Imran", "Nuha", "Rayyan", "Hawwa", "Adam", "Laila", "Sinan", "Raniya", "Ziyad", "Eesa", "Naila", "Shifaz", "Maeesha", "Ismail", "Sofa", "Rishwan", "Dhiyana"];
const LAST = ["Rasheed", "Nashid", "Zayan", "Leena", "Shareef", "Faisal", "Naseer", "Waheed", "Hameed", "Latheef", "Saeed", "Adnan", "Rizwan", "Shiyam", "Mohamed", "Abdulla", "Ismail", "Zahir", "Moosa", "Fahmy"];

interface ClassSpec {
  name: string;
  code: string;
  grade: number;
  tutorId: number;
  size: number;
  subject: "econ" | "biz" | "acc";
}

const CLASS_SPECS: ClassSpec[] = [
  { name: "IGCSE Economics, Batch C", code: "0455", grade: 10, tutorId: 1, size: 24, subject: "econ" },
  { name: "IGCSE Economics, Batch D", code: "0455", grade: 10, tutorId: 1, size: 18, subject: "econ" },
  { name: "IGCSE Economics, Batch E", code: "0455", grade: 11, tutorId: 1, size: 14, subject: "econ" },
  { name: "IGCSE Economics, Batch F", code: "0455", grade: 11, tutorId: 1, size: 12, subject: "econ" },
  { name: "IGCSE Business Studies, Batch A", code: "0450", grade: 10, tutorId: 1, size: 30, subject: "biz" },
  { name: "IGCSE Business Studies, Batch B", code: "0450", grade: 10, tutorId: 1, size: 22, subject: "biz" },
  { name: "IGCSE Business Studies, Batch C", code: "0450", grade: 11, tutorId: 1, size: 12, subject: "biz" },
  { name: "IGCSE Business Studies, Batch D", code: "0450", grade: 11, tutorId: 1, size: 16, subject: "biz" },
  { name: "IGCSE Business Studies, Batch E", code: "0450", grade: 11, tutorId: 1, size: 100, subject: "biz" },
  { name: "IGCSE Accounting, Batch A", code: "0452", grade: 10, tutorId: 2, size: 16, subject: "acc" },
  { name: "IGCSE Accounting, Batch B", code: "0452", grade: 10, tutorId: 2, size: 20, subject: "acc" },
];

type QSpec = { kind: Question["kind"]; prompt: string; points: number; options?: string[]; correct?: string | boolean; accepted?: string[]; marking?: string[] };

const BANK: Record<ClassSpec["subject"], QSpec[]> = {
  econ: [
    { kind: "mcq", prompt: "Which of these is a factor of production?", points: 1, options: ["Labour", "Inflation", "A tariff", "Profit"], correct: "A" },
    { kind: "mcq", prompt: "What is the opportunity cost of a choice?", points: 1, options: ["The money paid", "The next best alternative given up", "The time taken", "The tax charged"], correct: "B" },
    { kind: "true_false", prompt: "A price ceiling set below equilibrium creates a shortage.", points: 1, correct: true },
    { kind: "fill_blank", prompt: "A tax on a good shifts the ________ curve to the left.", points: 1, accepted: ["supply"] },
    { kind: "written", prompt: "Explain one benefit and one cost of specialisation.", points: 4, marking: ["States a benefit such as higher output", "Explains the benefit", "States a cost such as boredom or dependence", "Explains the cost"] },
    { kind: "written", prompt: "Analyse how a rise in interest rates may affect consumer spending.", points: 6, marking: ["Higher borrowing costs", "Less credit spending", "Higher return on saving", "Falls in consumption", "Links to aggregate demand", "Uses an example"] },
  ],
  biz: [
    { kind: "mcq", prompt: "Which of these is a stakeholder of a business?", points: 1, options: ["Customers", "Inflation", "Weather", "Exchange rates"], correct: "A" },
    { kind: "mcq", prompt: "What does a sole trader have?", points: 1, options: ["Limited liability", "Unlimited liability", "Shareholders", "A board of directors"], correct: "B" },
    { kind: "true_false", prompt: "Revenue minus total costs equals profit.", points: 1, correct: true },
    { kind: "fill_blank", prompt: "Money a firm gets from selling goods is called ________.", points: 1, accepted: ["revenue", "sales revenue"] },
    { kind: "written", prompt: "Explain two reasons why a business might want to grow.", points: 4, marking: ["Names a reason such as economies of scale", "Develops the first reason", "Names a second reason", "Develops the second reason"] },
    { kind: "written", prompt: "Analyse the advantages of using social media to advertise.", points: 6, marking: ["Wide reach", "Low cost", "Targeted audience", "Two-way feedback", "Links to sales", "Uses an example"] },
  ],
  acc: [
    { kind: "mcq", prompt: "Which of these is a current asset?", points: 1, options: ["Inventory", "A building", "A vehicle", "A loan"], correct: "A" },
    { kind: "mcq", prompt: "Where is a purchase on credit first recorded?", points: 1, options: ["Sales journal", "Purchases journal", "Cash book", "Ledger only"], correct: "B" },
    { kind: "true_false", prompt: "Depreciation is a cash payment.", points: 1, correct: false },
    { kind: "fill_blank", prompt: "Assets minus liabilities equals ________.", points: 1, accepted: ["capital", "owner's equity", "equity"] },
    { kind: "written", prompt: "Explain why a business prepares a trial balance.", points: 4, marking: ["Checks debits equal credits", "Helps find errors", "Prepares for final accounts", "Notes its limits"] },
    { kind: "written", prompt: "Analyse the effect of charging depreciation on profit.", points: 6, marking: ["Depreciation is an expense", "Reduces profit", "Spreads cost over life", "Reduces asset value", "No cash outflow", "Uses an example"] },
  ],
};

const WRITTEN_POOL = [
  "It would change because people respond to the price, so the amount bought moves in the opposite direction.",
  "One benefit is higher output, because workers get better at one task. A cost is that the work can become boring.",
  "Firms want to grow to lower their average costs and to reach more customers, which should raise profit.",
  "Interest rates go up so borrowing is more expensive, which means people spend less and save more.",
  "The business records this so that the figures balance and mistakes are easier to find.",
];

const TOPICS: Record<ClassSpec["subject"], string[]> = {
  econ: ["Unit 1 Quiz: The Basic Economic Problem", "Unit 2 Quiz: Allocation of Resources", "Unit 4 Test: Government Intervention", "Unit 5 Test: The Macroeconomy", "Unit 6 Test: Inflation and Unemployment", "Revision Quiz: Elasticity", "Revision Quiz: Market Failure", "Term 1 Exam: Economics", "Term 2 Exam: Economics", "Data Response Practice 1", "Data Response Practice 2", "Mock Paper 1: Economics", "Mock Paper 2: Economics", "Trade and Globalisation Test"],
  biz: ["Unit 1 Quiz: Understanding Business", "Unit 2 Test: People in Business", "Unit 3 Test: Marketing", "Unit 4 Test: Operations", "Unit 5 Test: Finance", "Revision Quiz: Business Objectives", "Revision Quiz: Cash Flow", "Term 1 Exam: Business Studies", "Term 2 Exam: Business Studies", "Case Study Practice 1", "Case Study Practice 2", "Mock Paper 1: Business", "Mock Paper 2: Business", "Entrepreneurship Test"],
  acc: ["Unit 1 Quiz: Fundamentals", "Unit 2 Test: Double Entry", "Unit 3 Test: Final Accounts", "Term 1 Exam: Accounting", "Revision Quiz: Depreciation", "Mock Paper 1: Accounting"],
};

/** What happens to an exam, so the lists show every state. */
type Plan = "released" | "marking" | "live" | "ready" | "draft";
const PLANS: Plan[] = ["released", "marking", "live", "released", "ready", "marking", "draft", "released", "live", "marking", "released", "ready", "marking"];

export function addStressData(db: DbState, now = Date.now()): void {
  const rand = rng(20251125);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const iso = (ms: number) => new Date(ms).toISOString();

  /* ---- students and classes ---- */
  let userId = 100;
  const classes: SchoolClass[] = [];
  let classId = Math.max(...db.classes.map((c) => c.id)) + 1;
  const sizes = new Map<number, number>();

  for (const spec of CLASS_SPECS) {
    const studentIds: number[] = [];
    for (let i = 0; i < spec.size; i++) {
      const id = userId++;
      const first = FIRST[(id * 7) % FIRST.length];
      const last = LAST[(id * 11 + 3) % LAST.length];
      db.users.push({ id, name: `${first} ${last}`, email: `student${id}@ll.test`, role: "student" } satisfies User);
      studentIds.push(id);
    }
    classes.push({ id: classId, name: spec.name, subjectCode: spec.code, grade: spec.grade, tutorId: spec.tutorId, studentIds });
    sizes.set(classId, spec.size);
    classId++;
  }
  db.classes.push(...classes);

  const classesFor = (subject: ClassSpec["subject"]) => classes.filter((_, i) => CLASS_SPECS[i].subject === subject);
  const demoClasses = db.classes.filter((c) => c.id === 1 || c.id === 2);

  /* ---- exams, questions, sessions, attempts ---- */
  let examId = 10;
  let sessionId = 100;
  let attemptId = db.nextAttemptId;
  const sessions: ExamSession[] = [];
  const attempts: Attempt[] = [];
  const answers: AnswerRecord[] = [];
  const violations: ViolationRecord[] = [];
  const exams: Exam[] = [];
  const questions: Question[] = [];

  function makeExam(title: string, ownerId: number, subject: ClassSpec["subject"] | "mock", plan: Plan, k: number, minutes: number) {
    const id = examId++;
    const bank = BANK[subject === "mock" ? "econ" : subject];
    const status: Exam["status"] = plan === "draft" ? "draft" : "published";
    exams.push({ id, title, ownerId, timeLimitMinutes: minutes, navigation: "any", rules: "Calculators are not allowed.", status, publishedAt: status === "published" ? iso(now - (30 - k) * DAY) : null });

    const qs: Question[] = bank.map((b, i) => ({
      id: id * 100 + i + 1,
      examId: id,
      position: i + 1,
      kind: b.kind,
      prompt: b.prompt,
      points: b.points,
      options: b.options?.map((text, n) => ({ key: "ABCD"[n], text })),
      answerKey:
        b.kind === "mcq" ? { kind: "mcq", correct: String(b.correct) }
        : b.kind === "true_false" ? { kind: "true_false", correct: Boolean(b.correct) }
        : b.kind === "fill_blank" ? { kind: "fill_blank", accepted: b.accepted ?? [] }
        : { kind: "written", markingPoints: b.marking ?? [] },
      // drafts: roughly half approved so the builder shows partial progress
      approved: status === "published" || i % 2 === 0,
    }));
    questions.push(...qs);

    const targets =
      subject === "mock" ? [...demoClasses, ...classes.filter((c) => c.tutorId === ownerId)]
      : subject === "econ" ? [...demoClasses, ...classesFor("econ")]
      : classesFor(subject);

    targets.forEach((cls, ci) => {
      const isDemo = cls.id === 1 || cls.id === 2;
      let sStatus: ExamSession["status"] = "not_open";
      let releasedAt: string | null = null;
      let attemptMode: "none" | "marked" | "mixed" | "live" = "none";

      if (plan === "released" && !isDemo) { sStatus = "closed"; releasedAt = iso(now - (3 + k) * DAY); attemptMode = "marked"; }
      else if (plan === "marking" && !isDemo) { sStatus = "closed"; attemptMode = "mixed"; }
      else if (plan === "live" && !isDemo && ci % 3 !== 2) { sStatus = "open"; attemptMode = "live"; }
      // the original demo classes only ever get closed or not-open sessions, with no attempts
      else if ((plan === "released" || plan === "marking") && isDemo) { sStatus = "closed"; }

      const sid = sessionId++;
      const openedAt = sStatus === "not_open" ? null : iso(now - (sStatus === "open" ? 25 * MIN : (2 + k) * DAY));
      sessions.push({
        id: sid, examId: id, classId: cls.id, status: sStatus, openedAt,
        closedAt: sStatus === "closed" ? iso(now - (1 + k) * DAY) : null, resultsReleasedAt: releasedAt,
      });
      if (attemptMode === "none" || status === "draft") return;

      const size = sizes.get(cls.id) ?? cls.studentIds.length;
      const count = size > 50 ? Math.min(size, 70) : Math.min(size, 8 + (k % 5));
      cls.studentIds.slice(0, count).forEach((studentId, si) => {
        const a = attemptId++;
        const startedAt = attemptMode === "live" && si % 5 === 0 ? now - (3 + (si % 12)) * MIN : now - (2 + k) * DAY + si * MIN;
        const sitting = attemptMode === "live" && si % 5 === 0;
        const submittedAt = sitting ? null : iso(startedAt + (12 + (si % 14)) * MIN);
        const toMark = !sitting && (attemptMode === "live" || (attemptMode === "mixed" && rand() < 0.45));
        const state: Attempt["status"] = sitting ? "in_progress" : toMark ? "submitted" : "marked";
        const violationCount = rand() < 0.12 ? 1 + Math.floor(rand() * 2) : 0;

        attempts.push({
          id: a, sessionId: sid, studentId, startedAt: iso(startedAt), deadlineAt: iso(startedAt + minutes * MIN), submittedAt,
          submitReason: sitting ? null : violationCount >= 3 ? "violations" : "manual", status: state, violationCount,
          overallComment: state === "marked" && rand() < 0.4 ? "Good work. Keep linking each point back to the question." : null,
          resultViewedAt: releasedAt && rand() < 0.5 ? iso(now - k * DAY) : null,
        });
        for (let v = 0; v < violationCount; v++) violations.push({ attemptId: a, at: iso(startedAt + (3 + v * 4) * MIN), kind: rand() < 0.7 ? "hidden" : "blur" });

        qs.forEach((q, qi) => {
          if (sitting && qi > 2 + (si % 3)) return; // partway through
          let response: string | null = null;
          let awarded: number | null = null;
          if (q.answerKey.kind === "mcq") {
            const right = rand() < 0.6;
            response = rand() < 0.08 ? null : right ? q.answerKey.correct : pick(["A", "B", "C", "D"].filter((x) => x !== (q.answerKey as { correct: string }).correct));
            awarded = response === q.answerKey.correct ? q.points : 0;
          } else if (q.answerKey.kind === "true_false") {
            response = rand() < 0.08 ? null : rand() < 0.6 ? String(q.answerKey.correct) : String(!q.answerKey.correct);
            awarded = response === String(q.answerKey.correct) ? q.points : 0;
          } else if (q.answerKey.kind === "fill_blank") {
            const right = rand() < 0.5;
            response = rand() < 0.1 ? null : right ? q.answerKey.accepted[0] : pick(["demand", "price", "cost", "profit"]);
            awarded = response && q.answerKey.accepted.includes(response) ? q.points : 0;
          } else {
            response = rand() < 0.1 ? null : pick(WRITTEN_POOL);
            awarded = state === "marked" ? (response ? Math.min(q.points, 1 + Math.floor(rand() * q.points)) : 0) : null;
          }
          if (sitting) awarded = null;
          answers.push({
            attemptId: a, questionId: q.id, response, flagged: rand() < 0.04, awardedMarks: awarded,
            feedback: state === "marked" && q.kind === "written" && rand() < 0.35 ? "Clear point. Add one more step of explanation." : null,
          });
        });
      });
    });
  }

  const planAt = (n: number) => PLANS[n % PLANS.length];
  let n = 0;
  TOPICS.econ.forEach((t, i) => makeExam(t, 1, "econ", planAt(n++), i, 20 + (i % 4) * 10));
  TOPICS.biz.forEach((t, i) => makeExam(t, 1, "biz", planAt(n++ + 3), i, 20 + (i % 4) * 10));
  TOPICS.acc.forEach((t, i) => makeExam(t, 2, "acc", planAt(n++ + 5), i, 25));
  makeExam("Whole-school Mock Paper (all batches)", 1, "mock", "live", 0, 60);

  db.exams.push(...exams);
  db.questions.push(...questions);
  db.sessions.push(...sessions);
  db.attempts.push(...attempts);
  db.answers.push(...answers);
  db.violations.push(...violations);
  db.nextAttemptId = attemptId;
}

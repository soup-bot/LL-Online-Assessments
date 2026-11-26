# LL Online Assessments

An online exam module for Limitless Learning. A teacher builds and publishes an exam, a student sits it under a
timer on their phone, the system marks what it can, the teacher marks the rest, and the student sees a grade.
An admin looks after accounts and classes.

- **`backend/`** Laravel 12 API (PHP 8.2+), SQLite in development, MySQL-compatible migrations.
- **`frontend/`** Next.js 15, TypeScript, Tailwind v4. One app with student, teacher and admin areas.

```
backend/    app/Services      the rules: AttemptService, SessionManager, MarkingService, ExamBuilderService, Grader...
            app/Http          thin controllers, form requests, role middleware
            database/         migrations, factories, seeders (Brief, Demo, Stress)
            tests/            161 feature and unit tests
frontend/   app/              routes: /login, /student/*, /tutor/*, /admin/*
            components/       student/, staff/, ui/ (shared kit)
            lib/              api.ts, api-real.ts, api-staff.ts, http.ts (all server calls go through these)
```

## Run it

You need PHP 8.2+, Composer, Node 20+ and pnpm.

**1. Backend**

```bash
cd backend
composer install
cp .env.example .env          # on Windows: copy .env.example .env
php artisan key:generate
touch database/database.sqlite   # on Windows: type nul > database\database.sqlite
php artisan migrate --seed       # the exact scenario from the brief
php artisan serve                # http://localhost:8000
```

Optional, in a second terminal: `php artisan schedule:work`. It runs the once-a-minute job that hands in exams
whose time has run out, so a teacher's lists are right even if a student never comes back. Without it the same
thing still happens whenever anyone looks at the exam, but not for abandoned ones.

**2. Frontend**

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev                         # http://localhost:3000
```

`.env.local` points at the API (`NEXT_PUBLIC_API_URL`, default `http://localhost:8000/api/v1`). The backend's
`FRONTEND_URL` (in `backend/.env`, default `http://localhost:3000`) is the one origin allowed by CORS.

**3. Sign in.** Every account uses the password `password`.

| Name | Email | Role |
|---|---|---|
| Aishath Rasheed | aishath@ll.test | teacher, owns Batch A and Batch B |
| Ali Shareef | ali@ll.test | teacher, no classes |
| Hawwa Nadheema, Ibrahim Zayan, Mariyam Leena | hawwa@ / ibrahim@ / mariyam@ll.test | students, Batch A |
| Ahmed Nashid | ahmed@ll.test | student, Batch B |
| Mohamed Faisal | admin@ll.test | admin |

There is also a small wrench tab on the left edge of every page ("demo tools") that signs you in as anyone with one
click. Hide it with `NEXT_PUBLIC_DEMO_TOOLS=0`.

### Which data to load

| Command | What you get |
|---|---|
| `php artisan migrate:fresh --seed` | Exactly the brief: Unit 3 is an unpublished draft with 8 questions, none approved, linked to both batches, nothing open. Build the whole scenario yourself. |
| `php artisan migrate:fresh --seed --seeder=DemoSeeder` | The brief plus some history, so every screen has something on it: Unit 3 already published and open for Batch A, a released Unit 2 result for Hawwa, a half-built Unit 4 draft, and Mariyam's Unit 3 waiting to be marked. |
| `php artisan migrate:fresh --seed --seeder=StressSeeder` | The demo plus a large school (13 classes, one with 100 students, ~35 exams, ~1,700 attempts) for trying lists and paging. |

## Try the scenario

With `DemoSeeder`, or by building it from the brief data:

1. **Build** (`aishath@ll.test` → Exams → Unit 3). Check each question's answer key and tick it approved. The
   Publish button says what is still missing until every question is approved.
2. **Publish.** The exam locks: no question can be added, edited or deleted. The server refuses it, not only the screen.
3. **Open** for Batch A only (Exams → Manage → Batch A → Open). Ahmed (Batch B) sees nothing.
4. **Sit** (`ibrahim@ll.test` on a phone, or a narrow window). Answers autosave, questions can be flagged, switching
   tab or app is a violation, and the third one hands the exam in.
5. **Submit** or let the time run out. Objective questions are marked at once; written ones wait.
6. **Mark** (To mark → a submission). Tick the marking points each answer meets, adjust the mark, add feedback.
7. **Close and release** (Manage → Close, then Release). Release is refused while any submission is unmarked.
8. **Results** (`ibrahim@ll.test` → Results): score, percentage, grade, per-question marks and feedback.

The admin (`admin@ll.test`) manages users and classes and can open any exam, class page or submission read-only.

## API documentation

With the backend running, open **http://localhost:8000/docs/api**. It lists every endpoint (46) with its request and
response shapes, and has an Authorize button: call `POST /auth/login`, paste the token, and try the rest. It is
generated from the code (Scramble), so it can't drift. It is served only in the `local` environment.

## Tests

```bash
cd backend && php artisan test         # 161 tests
cd frontend && pnpm exec tsc --noEmit && pnpm lint
```

The backend tests cover the rules that would hurt if they broke quietly: the publish lock, approval, the
server-set deadline and late saves, the third violation, marking, release gating, scoping between classes and
teachers, the grade boundaries, and that the answer key never appears in a student's response. A few of them
also run against the stress seed and check that list endpoints use a fixed number of queries.

The frontend has no automated tests. I drove it in a headless browser against the real API while building it
(sign-in, sitting an exam, going offline and back, a timer running out, three violations, building, marking,
releasing, the admin screens), but those scripts are not in the repo.

## How the brief's requirements are met

| Requirement | How |
|---|---|
| Every question checked before the exam goes out | A question can only be approved with a complete answer key. Publish needs all approved. Editing an approved question removes its approval. |
| Answers can't change once published | `ExamBuilderService` and `StaffAccess::draft` refuse any change to a published exam with a 409. |
| Open for one class and not another | Each (exam, class) pair is its own `exam_session` with its own status. Students only see sessions of their own classes. |
| Students never see answers while sitting | Student responses are built from an explicit list of fields. The key is also `$hidden` on the model. A test checks the whole payload. |
| Fair time limit | The deadline is set once, from the server's clock, when the student starts. Reloading or changing the phone's clock changes nothing (see below). |
| No lost work | Answers are saved in the background, mirrored on the device, retried with backoff and sent again when the connection returns. |
| Teacher sees if a student left the window | Each violation is logged with its time and kind, and shown on the marking screen and as a count in the live list. |
| Grades | A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 40, U below, from the exact ratio (79.99% is a B), in `backend/config/exam.php`. |
| Phones | The student screens are designed phone-first (bottom tabs, sheets, large tap targets), the staff screens are responsive. |

## How the clock works

- **The deadline is a database value.** `POST /student/exams/{session}/start` sets `deadline_at = now() + time limit`
  on the server. Starting twice returns the same attempt, so a second tap or a reload cannot restart the timer.
- **The screen only displays it.** Every response that touches an attempt carries `serverNow` and `deadlineAt`. The
  countdown is the server's time plus however long has passed, measured with whichever of the device's two clocks
  moved further. Setting the phone's clock back, or a phone that sleeps, can't buy time. The screen asks the server
  again whenever the student returns to the tab.
- **The server enforces it.** A save after the deadline plus 5 seconds of grace is refused (410) and the exam is
  handed in as it stood. At zero the screen checks with the server before submitting, so a wrong clock can't hand
  someone's exam in early.
- **Two ways an overdue exam is handed in:** on the next read or write, and by the scheduled job.

## Decisions and assumptions

Things the brief left open, and what I chose.

**Accounts and access**
- **Auth:** Sanctum bearer tokens (12 hours). The Next app is a separate origin, so cookies and CSRF would add
  nothing. The token lives in `localStorage`, which is simple but readable by any script on the page; for
  production I'd move to httpOnly cookies on a shared parent domain.
- **A wrong password, an unknown email and a deactivated account all give the same 422**, so nobody can tell which
  accounts exist. It is a 422, not a 401, so a failed sign-in can't be mistaken for an expired session. Sign-in is
  limited to 5 tries a minute per email and address.
- **Accounts are deactivated, never deleted**, so old results keep their owner. Deactivating signs the person out
  everywhere. New accounts get the default password from `DEFAULT_USER_PASSWORD` (or one the admin types).
- **Teachers only touch their own exams, classes and submissions.** Anything else is a 404, not a 403, so the API
  never confirms it exists. **Admins can read all of it and change none of it** (they manage accounts and classes).
- **A student can be in several classes, but only one per subject** (enforced by a unique key, not just the form),
  because a student taking Economics and Business Studies needs two classes. A student's own list shows all of them.
- A role can't change under work that belongs to the old one (a teacher with classes or exams, a student with
  attempts). A class that already has exams can't change teacher, and a student who sat an exam in it can't be removed.

**Exams**
- Exactly **four options for multiple choice** (A to D), **one blank per fill-in question** (it keeps marking
  unambiguous), and whole marks only. Fill-in answers ignore capitals, extra spaces and a trailing full stop, and any
  of the listed accepted answers counts.
- **One attempt per student per session.** No retakes.
- **Marking:** the teacher ticks the marking points an answer meets; the mark follows the ticks (capped at the
  question's points) and can be adjusted by hand. Saving marks completes the marking of that submission.
  Blank written answers get 0 without the teacher.
- **Closing a class hands in anyone still sitting** with what they saved (reason `closed`) and stops new starts.
  **Releasing** needs the class closed and every submission marked, and can't be undone. Students who never started
  show as "not attempted" and have no result.
- **Results show the correct answer for objective questions**, and only after release. Marking points are never
  shown to students.
- **Three violations**, then auto-submit (from the brief). A violation is "the page was hidden" or "the window lost
  focus", counted on the server so reloading can't reset it.
- Exams have an "any order / in order only" setting. It is stored and shown on the cover page, but the exam screen
  does not enforce one-way navigation yet.

**Teacher tools I added**
- **Import with AI:** the teacher copies a prompt into any AI assistant, pastes the JSON it returns, previews it
  (anything missing an answer key is flagged) and imports it. Imported questions always arrive unapproved. There is
  no AI call inside the product.
- Lists everywhere (exams, to-mark, live students, users, classes, all exams) are **searched, filtered, sorted and
  paged by the server**, from a fixed number of queries, so a school with hundreds of students and exams stays fast.

## What I'd do next

- **Move the token to an httpOnly cookie**, and add the Google sign-in and password reset that the login screen
  only stubs today.
- **Enforce "in order only"** navigation in the exam screen.
- **Time extensions** for students who need them (a per-attempt extra-minutes value, applied at start), and **retakes**.
- **Rich questions:** images, maths and tables in a question or an option. Today a question is plain text.
- **Real-time for teachers** (Laravel Reverb) instead of polling every 10 seconds, and cache the live list for a
  few seconds so several teachers watching one class cost one query.
- **Offline:** unsent answers are kept on the device and survive a reload, and are sent when the connection returns.
  There is no service worker, though, so the page itself can't load without a connection: reloading while offline
  fails to open the exam until the connection is back.
- **Two tabs open on one exam** aren't detected; the later save wins.
- **Accessibility audit** (screen-reader pass, focus order) and **automated frontend tests**, with a browser-test
  suite for the flows above.
- **Production setup:** MySQL, Redis for cache and queues, rate limits on autosave, result exports and emails on a queue.
- **Soft-archive old exams** and a per-exam "show correct answers after release" switch.
- **Anti-cheating beyond violations** (full-screen mode, randomised question and option order) if the school wants it.

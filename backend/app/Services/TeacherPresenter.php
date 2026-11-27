<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\QuestionKind;
use App\Enums\SessionStatus;
use App\Models\Attempt;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Builds the JSON the teacher and admin screens read (the DTOs in frontend/lib/staff-types.ts).
 * Lists are computed with a handful of grouped queries, never one query per exam or student.
 */
class TeacherPresenter
{
    private const STAGE_ORDER = ['live' => 0, 'marking' => 1, 'draft' => 2, 'ready' => 3, 'released' => 4];

    private const STATE_ORDER = ['to_mark' => 0, 'sitting' => 1, 'not_started' => 2, 'marked' => 3, 'not_attempted' => 4];

    public function __construct(private AttemptService $attempts) {}

    public function person(User $u): array
    {
        return ['id' => $u->id, 'name' => $u->name, 'initials' => $u->initials()];
    }

    public function profile(User $u): array
    {
        return $this->person($u) + ['email' => $u->email, 'role' => $u->role->value];
    }

    /* ------------------------------------------------------------ exam list */

    /**
     * One row per exam, with its stage and progress. Everything for all the exams comes from
     * a few grouped queries.
     *
     * @param  Collection<int, Exam>  $exams
     * @return list<array<string, mixed>>
     */
    public function examRows(Collection $exams): array
    {
        if ($exams->isEmpty()) {
            return [];
        }
        $ids = $exams->pluck('id');
        $this->attempts->expireOverdue(ExamSession::whereIn('exam_id', $ids)->pluck('id'));

        $questionStats = DB::table('questions')->whereIn('exam_id', $ids)
            ->selectRaw('exam_id, count(*) as n, sum(points) as pts, sum(case when approved then 1 else 0 end) as ap')
            ->groupBy('exam_id')->get()->keyBy('exam_id');

        $sessions = ExamSession::with('schoolClass')->whereIn('exam_id', $ids)
            ->withCount([
                'attempts as handed_in_count' => fn ($q) => $q->where('status', '!=', AttemptStatus::InProgress->value),
                'attempts as to_mark_count' => fn ($q) => $q->where('status', AttemptStatus::Submitted->value),
            ])->get();

        $students = DB::table('class_student')->whereIn('school_class_id', $sessions->pluck('school_class_id'))
            ->selectRaw('school_class_id, count(*) as n')->groupBy('school_class_id')->pluck('n', 'school_class_id');

        // Class average per exam: the mean percentage over its marked attempts.
        $averages = [];
        $marked = Attempt::whereIn('exam_session_id', $sessions->pluck('id'))->where('status', AttemptStatus::Marked->value)
            ->withSum('answers as score_sum', 'awarded_marks')->get();
        foreach ($marked->groupBy(fn ($a) => $sessions->firstWhere('id', $a->exam_session_id)->exam_id) as $examId => $group) {
            $total = (int) ($questionStats[$examId]->pts ?? 0);
            $averages[$examId] = $total > 0 ? round($group->avg(fn ($a) => (int) $a->score_sum / $total * 100), 1) : null;
        }

        return $exams->map(function (Exam $exam) use ($questionStats, $sessions, $students, $averages) {
            $stats = $questionStats[$exam->id] ?? null;
            $mine = $sessions->where('exam_id', $exam->id)->values();
            $toMark = (int) $mine->sum('to_mark_count');

            $stage = match (true) {
                $exam->isDraft() => 'draft',
                $mine->contains(fn ($s) => $s->status === SessionStatus::Open) => 'live',
                $toMark > 0 => 'marking',
                $mine->contains(fn ($s) => $s->results_released_at !== null) => 'released',
                default => 'ready',
            };

            return [
                'id' => $exam->id,
                'title' => $exam->title,
                'status' => $exam->status->value,
                'stage' => $stage,
                'timeLimitMinutes' => (int) $exam->time_limit_minutes,
                'questionCount' => (int) ($stats->n ?? 0),
                'totalMarks' => (int) ($stats->pts ?? 0),
                'approvedCount' => (int) ($stats->ap ?? 0),
                'classes' => $mine->map(fn (ExamSession $s) => [
                    'sessionId' => $s->id,
                    'classId' => $s->school_class_id,
                    'label' => $s->schoolClass->batch(),
                    'status' => $s->status->value,
                    'released' => $s->results_released_at !== null,
                ])->all(),
                'submitted' => (int) $mine->sum('handed_in_count'),
                'studentTotal' => (int) $mine->sum(fn ($s) => $students[$s->school_class_id] ?? 0),
                'toMark' => $toMark,
                'averagePercent' => $averages[$exam->id] ?? null,
                'releasedAt' => StudentPresenter::iso($mine->pluck('results_released_at')->filter()->sort()->last()),
            ];
        })->values()->all();
    }

    /** How far along an exam is, as 0 to 100 (used to sort by progress). */
    public function progressValue(array $row): float
    {
        return match ($row['stage']) {
            'draft' => $row['questionCount'] ? $row['approvedCount'] / $row['questionCount'] * 100 : 0,
            'released' => 100,
            default => $row['studentTotal'] ? $row['submitted'] / $row['studentTotal'] * 100 : 0,
        };
    }

    /**
     * Filter, search, sort and page the rows.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array{rows: list<array<string, mixed>>, total: int}
     */
    public function arrange(array $rows, string $filter, ?string $query, string $sort, string $dir, int $page, int $perPage): array
    {
        $q = mb_strtolower(trim((string) $query));
        $rows = collect($rows)
            ->filter(fn ($r) => match ($filter) {
                'drafts' => $r['status'] === 'draft',
                'published' => $r['status'] === 'published',
                'marking' => $r['toMark'] > 0,
                default => true,
            })
            ->filter(fn ($r) => $q === '' || str_contains(mb_strtolower($r['title']), $q));

        $compare = match ($sort) {
            'name' => fn ($a, $b) => strcasecmp($a['title'], $b['title']),
            'progress' => fn ($a, $b) => $this->progressValue($a) <=> $this->progressValue($b),
            'recent' => fn ($a, $b) => $b['id'] <=> $a['id'],
            // "attention": most waiting to be marked first, then live, marking, drafts, ready, released
            default => fn ($a, $b) => $b['toMark'] <=> $a['toMark'] ?: self::STAGE_ORDER[$a['stage']] <=> self::STAGE_ORDER[$b['stage']] ?: $b['id'] <=> $a['id'],
        };
        $sorted = $rows->sort(fn ($a, $b) => ($dir === 'desc' ? -1 : 1) * $compare($a, $b))->values();

        return ['rows' => $sorted->slice(($page - 1) * $perPage, $perPage)->values()->all(), 'total' => $sorted->count()];
    }

    /* -------------------------------------------------------------- builder */

    public function builder(Exam $exam, User $viewer): array
    {
        $questions = $exam->questions()->get();
        $approved = $questions->where('approved', true)->count();
        $sessions = ExamSession::where('exam_id', $exam->id)->get()->keyBy('school_class_id');

        $blocker = match (true) {
            ! $exam->isDraft() => 'Already published.',
            trim($exam->title) === '' => 'Give the exam a title.',
            $questions->isEmpty() => 'Add at least one question.',
            $approved < $questions->count() => "Approve all {$questions->count()} to publish.",
            $sessions->isEmpty() => 'Choose at least one class.',
            default => null,
        };

        return [
            'id' => $exam->id,
            'title' => $exam->title,
            'status' => $exam->status->value,
            'timeLimitMinutes' => (int) $exam->time_limit_minutes,
            'navigation' => $exam->navigation->value,
            'rules' => $exam->rules ?? '',
            'questions' => $questions->map(fn (Question $q) => [
                'id' => $q->id, 'position' => $q->position, 'kind' => $q->kind->value, 'prompt' => $q->prompt, 'points' => $q->points, 'approved' => $q->approved,
            ])->all(),
            'totalMarks' => (int) $questions->sum('points'),
            'approvedCount' => $approved,
            'classes' => SchoolClass::where('tutor_id', $exam->owner_id)->orderBy('name')->get()->map(fn (SchoolClass $c) => [
                'classId' => $c->id,
                'name' => $c->name,
                'linked' => $sessions->has($c->id),
                'sessionStatus' => $sessions->get($c->id)?->status->value,
            ])->all(),
            'publishBlocker' => $blocker,
            'canEdit' => $viewer->isTutor() && $exam->isDraft(),
        ];
    }

    /** One question as the editor edits it. */
    public function draftOf(Question $q): array
    {
        $key = $q->answer_key ?? [];
        $options = collect($q->options ?? [])->keyBy('key');

        return [
            'kind' => $q->kind->value,
            'prompt' => $q->prompt,
            'points' => (int) $q->points,
            'options' => array_map(fn ($k) => $options->get($k)['text'] ?? '', ['A', 'B', 'C', 'D']),
            'correct' => $q->kind === QuestionKind::Mcq ? (string) ($key['correct'] ?? '') : '',
            'trueFalse' => $q->kind === QuestionKind::TrueFalse ? ($key['correct'] ?? null) : null,
            'accepted' => $q->kind === QuestionKind::FillBlank ? array_values($key['accepted'] ?? []) : [],
            'markingPoints' => $q->kind === QuestionKind::Written ? array_values($key['markingPoints'] ?? []) : [],
            'approved' => (bool) $q->approved,
        ];
    }

    public function editor(Exam $exam, ?Question $question, QuestionKind $kind, User $viewer): array
    {
        $total = $exam->questions()->count();
        $locked = ! $viewer->isTutor() || ! $exam->isDraft();

        if ($question) {
            return ['id' => $question->id, 'position' => $question->position, 'total' => $total, 'examTitle' => $exam->title, 'locked' => $locked, 'draft' => $this->draftOf($question)];
        }

        return [
            'id' => null,
            'position' => $total + 1,
            'total' => $total + 1,
            'examTitle' => $exam->title,
            'locked' => $locked,
            'draft' => [
                'kind' => $kind->value,
                'prompt' => $kind === QuestionKind::FillBlank ? 'Type the sentence and put ________ where the blank goes.' : '',
                'points' => $kind === QuestionKind::Written ? 4 : 1,
                'options' => ['', '', '', ''],
                'correct' => '',
                'trueFalse' => null,
                'accepted' => [],
                'markingPoints' => [],
                'approved' => false,
            ],
        ];
    }

    /* ------------------------------------------------------------- sessions */

    /** One class's card: its status and how many students are where. */
    public function classCard(ExamSession $session, int $students): array
    {
        $counts = Attempt::where('exam_session_id', $session->id)->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $sitting = (int) ($counts[AttemptStatus::InProgress->value] ?? 0);
        $submitted = (int) ($counts[AttemptStatus::Submitted->value] ?? 0);
        $marked = (int) ($counts[AttemptStatus::Marked->value] ?? 0);

        return [
            'sessionId' => $session->id,
            'classId' => $session->school_class_id,
            'name' => $session->schoolClass->name,
            'label' => $session->schoolClass->batch(),
            'status' => $session->status->value,
            'openedAt' => StudentPresenter::iso($session->opened_at),
            'closedAt' => StudentPresenter::iso($session->closed_at),
            'releasedAt' => StudentPresenter::iso($session->results_released_at),
            'students' => $students,
            'sitting' => $sitting,
            'handedIn' => $submitted + $marked,
            'toMark' => $submitted,
            'notStarted' => max(0, $students - ($sitting + $submitted + $marked)),
        ];
    }

    public function sessions(Exam $exam, User $viewer): array
    {
        $sessions = ExamSession::with('schoolClass')->where('exam_id', $exam->id)->get();
        $this->attempts->expireOverdue($sessions->pluck('id'));
        $students = DB::table('class_student')->whereIn('school_class_id', $sessions->pluck('school_class_id'))
            ->selectRaw('school_class_id, count(*) as n')->groupBy('school_class_id')->pluck('n', 'school_class_id');

        return [
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'status' => $exam->status->value,
                'questionCount' => $exam->questions()->count(),
                'totalMarks' => (int) $exam->questions()->sum('points'),
            ],
            'canEdit' => $viewer->isTutor(),
            'classes' => $sessions->map(fn (ExamSession $s) => $this->classCard($s, (int) ($students[$s->school_class_id] ?? 0)))->values()->all(),
        ];
    }

    /**
     * Every student in the class with where they are, filtered, ordered by what needs the teacher first,
     * and paged.
     *
     * @return array<string, mixed>
     */
    public function live(ExamSession $session, ?string $search, ?string $state, int $page, int $perPage): array
    {
        $this->attempts->expireOverdue([$session->id]);

        $students = $session->schoolClass->students()->orderBy('users.name')->get();
        $attempts = Attempt::where('exam_session_id', $session->id)->withSum('answers as score_sum', 'awarded_marks')
            ->withCount('violations')->get()->keyBy('student_id');
        $questions = Question::where('exam_id', $session->exam_id)->get();
        $answers = DB::table('answers')->whereIn('attempt_id', $attempts->pluck('id'))->get(['attempt_id', 'question_id', 'response', 'awarded_marks'])->groupBy('attempt_id');
        $objectiveIds = $questions->filter(fn ($q) => $q->kind->isObjective())->pluck('id');
        $objectiveTotal = (int) $questions->filter(fn ($q) => $q->kind->isObjective())->sum('points');
        $total = (int) $questions->sum('points');
        $kinds = $questions->keyBy('id');

        $rows = $students->map(function (User $student) use ($attempts, $answers, $objectiveIds, $objectiveTotal, $total, $kinds, $questions, $session) {
            $attempt = $attempts->get($student->id);
            $base = $this->person($student) + ['studentId' => $student->id];

            if (! $attempt) {
                return $base + [
                    'attemptId' => null, 'state' => $session->status === SessionStatus::Closed ? 'not_attempted' : 'not_started',
                    'submittedAt' => null, 'submitReason' => null, 'answered' => 0, 'questionCount' => $questions->count(), 'violations' => 0,
                    'secondsLeft' => null, 'score' => null, 'total' => $total, 'objectiveScore' => null, 'objectiveTotal' => $objectiveTotal, 'grade' => null,
                ];
            }

            $mine = $answers->get($attempt->id, collect());
            $answered = $mine->filter(fn ($a) => Grader::hasAnswer($kinds[$a->question_id]->kind, $a->response))->count();
            $objectiveScore = (int) $mine->whereIn('question_id', $objectiveIds)->sum('awarded_marks');
            $score = (int) $attempt->score_sum;

            return $base + [
                'attemptId' => $attempt->id,
                'state' => match ($attempt->status) {
                    AttemptStatus::InProgress => 'sitting',
                    AttemptStatus::Submitted => 'to_mark',
                    AttemptStatus::Marked => 'marked',
                },
                'submittedAt' => StudentPresenter::iso($attempt->submitted_at),
                'submitReason' => $attempt->submit_reason?->value,
                'answered' => $answered,
                'questionCount' => $questions->count(),
                'violations' => (int) $attempt->violations_count,
                'secondsLeft' => $attempt->isInProgress() ? max(0, (int) round(now()->diffInSeconds($attempt->deadline_at, false))) : null,
                'score' => $attempt->status === AttemptStatus::Marked ? $score : null,
                'total' => $total,
                'objectiveScore' => $objectiveScore,
                'objectiveTotal' => $objectiveTotal,
                'grade' => $attempt->status === AttemptStatus::Marked ? Grader::gradeFor($score, $total) : null,
            ];
        })->values();

        $counts = ['all' => $rows->count(), 'to_mark' => 0, 'sitting' => 0, 'waiting' => 0, 'marked' => 0];
        foreach ($rows as $row) {
            $key = in_array($row['state'], ['not_started', 'not_attempted'], true) ? 'waiting' : $row['state'];
            $counts[$key]++;
        }

        $q = mb_strtolower(trim((string) $search));
        $filtered = $rows
            ->filter(fn ($r) => match ($state) {
                'to_mark', 'sitting', 'marked' => $r['state'] === $state,
                'waiting' => in_array($r['state'], ['not_started', 'not_attempted'], true),
                default => true,
            })
            ->filter(fn ($r) => $q === '' || str_contains(mb_strtolower($r['name']), $q))
            ->sort(fn ($a, $b) => self::STATE_ORDER[$a['state']] <=> self::STATE_ORDER[$b['state']] ?: strcasecmp($a['name'], $b['name']))
            ->values();

        $card = $this->classCard($session, $students->count());

        return [
            'card' => $card,
            'rows' => $filtered->slice(($page - 1) * $perPage, $perPage)->values()->all(),
            'counts' => $counts,
            'questionCount' => $questions->count(),
            'release' => [
                'closed' => $session->status === SessionStatus::Closed,
                'toMark' => $card['toMark'],
                'released' => $session->results_released_at !== null,
                'canRelease' => $session->status === SessionStatus::Closed && $card['toMark'] === 0 && $session->results_released_at === null,
            ],
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $filtered->count()],
        ];
    }

    /* -------------------------------------------------------------- marking */

    /**
     * Submissions waiting for this teacher. Search the student's name or the exam's title, narrow to one exam or
     * one class, sort (oldest, newest or by student), and page. `filters` lists the exams and classes that have
     * something waiting, with how many, so the screen can offer only choices that lead somewhere.
     *
     * @return array{items: list<array<string, mixed>>, filters: array<string, mixed>, meta: array<string, int>}
     */
    public function toMark(User $teacher, int $page, int $perPage, ?string $search = null, ?int $examId = null, ?int $classId = null, string $sort = 'oldest'): array
    {
        $sessionIds = ExamSession::whereHas('exam', fn ($q) => $q->where('owner_id', $teacher->id))->pluck('id');
        $this->attempts->expireOverdue($sessionIds);

        $waiting = fn () => Attempt::whereIn('exam_session_id', $sessionIds)->where('status', AttemptStatus::Submitted->value);

        // The choices offered always cover everything waiting, so picking one never hides the others.
        $examOptions = DB::table('attempts')->join('exam_sessions', 'exam_sessions.id', '=', 'attempts.exam_session_id')
            ->join('exams', 'exams.id', '=', 'exam_sessions.exam_id')
            ->whereIn('attempts.exam_session_id', $sessionIds)->where('attempts.status', AttemptStatus::Submitted->value)
            ->selectRaw('exams.id as id, exams.title as title, count(*) as n')->groupBy('exams.id', 'exams.title')->orderBy('exams.title')->get();
        $classOptions = DB::table('attempts')->join('exam_sessions', 'exam_sessions.id', '=', 'attempts.exam_session_id')
            ->join('school_classes', 'school_classes.id', '=', 'exam_sessions.school_class_id')
            ->whereIn('attempts.exam_session_id', $sessionIds)->where('attempts.status', AttemptStatus::Submitted->value)
            ->selectRaw('school_classes.id as id, school_classes.name as name, count(*) as n')->groupBy('school_classes.id', 'school_classes.name')->orderBy('school_classes.name')->get();

        $q = trim((string) $search);
        $query = $waiting()
            ->when($examId, fn ($x) => $x->whereHas('session', fn ($s) => $s->where('exam_id', $examId)))
            ->when($classId, fn ($x) => $x->whereHas('session', fn ($s) => $s->where('school_class_id', $classId)))
            ->when($q !== '', fn ($x) => $x->where(fn ($y) => $y
                ->whereHas('student', fn ($s) => $s->where('name', 'like', "%{$q}%"))
                ->orWhereHas('session.exam', fn ($e) => $e->where('title', 'like', "%{$q}%"))));
        $total = (clone $query)->count();

        match ($sort) {
            'newest' => $query->orderByDesc('submitted_at')->orderByDesc('id'),
            'student' => $query->orderBy(User::select('name')->whereColumn('users.id', 'attempts.student_id'))->orderBy('id'),
            default => $query->orderBy('submitted_at')->orderBy('id'),
        };
        $items = $query->with(['student', 'session.exam', 'session.schoolClass'])->forPage($page, $perPage)->get();
        $written = Question::whereIn('exam_id', $items->pluck('session.exam_id'))->where('kind', QuestionKind::Written->value)
            ->selectRaw('exam_id, count(*) as n')->groupBy('exam_id')->pluck('n', 'exam_id');

        return [
            'items' => $items->map(fn (Attempt $a) => [
                'attemptId' => $a->id,
                'student' => $this->person($a->student),
                'examTitle' => $a->session->exam->title,
                'className' => $a->session->schoolClass->name,
                'submittedAt' => StudentPresenter::iso($a->submitted_at ?? $a->started_at),
                'writtenCount' => (int) ($written[$a->session->exam_id] ?? 0),
            ])->all(),
            'filters' => [
                'exams' => $examOptions->map(fn ($e) => ['id' => (int) $e->id, 'title' => $e->title, 'count' => (int) $e->n])->all(),
                'classes' => $classOptions->map(fn ($c) => ['id' => (int) $c->id, 'name' => $c->name, 'count' => (int) $c->n])->all(),
                'total' => (int) $waiting()->count(),
            ],
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $total],
        ];
    }

    public function toMarkCount(User $teacher): int
    {
        $sessionIds = ExamSession::whereHas('exam', fn ($q) => $q->where('owner_id', $teacher->id))->pluck('id');
        $this->attempts->expireOverdue($sessionIds);

        return Attempt::whereIn('exam_session_id', $sessionIds)->where('status', AttemptStatus::Submitted->value)->count();
    }

    /** Everything on the marking screen for one submission. */
    public function marking(Attempt $attempt, User $viewer): array
    {
        $this->attempts->expireIfDue($attempt);
        $session = $attempt->session;
        $questions = Question::where('exam_id', $session->exam_id)->orderBy('position')->get();
        $answers = $attempt->answers()->get()->keyBy('question_id');

        $objective = $questions->filter(fn ($q) => $q->kind->isObjective())->map(function (Question $q) use ($answers) {
            $a = $answers->get($q->id);
            $text = ! Grader::hasAnswer($q->kind, $a?->response)
                ? 'Not answered'
                : match ($q->kind) {
                    QuestionKind::Mcq => ($o = collect($q->options ?? [])->firstWhere('key', $a->response)) ? "{$o['key']}. {$o['text']}" : $a->response,
                    QuestionKind::TrueFalse => $a->response === 'true' ? 'True' : 'False',
                    default => trim($a->response),
                };

            return ['position' => $q->position, 'kind' => $q->kind->value, 'answer' => $text, 'awarded' => (int) ($a?->awarded_marks ?? 0), 'points' => (int) $q->points];
        })->values();

        $written = $questions->where('kind', QuestionKind::Written)->map(function (Question $q) use ($answers) {
            $a = $answers->get($q->id);

            return [
                'questionId' => $q->id,
                'position' => $q->position,
                'points' => (int) $q->points,
                'prompt' => $q->prompt,
                'answer' => Grader::hasAnswer($q->kind, $a?->response) ? $a->response : null,
                'markingPoints' => array_values($q->answer_key['markingPoints'] ?? []),
                'ticks' => array_values($a?->marking_ticks ?? []),
                'awarded' => $a?->awarded_marks,
                'feedback' => $a?->feedback ?? '',
            ];
        })->values();

        $answered = $questions->filter(fn ($q) => Grader::hasAnswer($q->kind, $answers->get($q->id)?->response))->count();

        return [
            'attemptId' => $attempt->id,
            'examId' => $session->exam_id,
            'sessionId' => $session->id,
            'examTitle' => $session->exam->title,
            'className' => $session->schoolClass->name,
            'student' => $this->person($attempt->student),
            'firstName' => $attempt->student->firstName(),
            'submittedAt' => StudentPresenter::iso($attempt->submitted_at),
            'submitReason' => $attempt->submit_reason?->value,
            'answered' => $answered,
            'questionCount' => $questions->count(),
            'status' => $attempt->status->value,
            'released' => $session->results_released_at !== null,
            'canEdit' => $viewer->isTutor() && $session->results_released_at === null && ! $attempt->isInProgress(),
            'violations' => $attempt->violations()->orderBy('occurred_at')->get()->map(fn ($v) => ['at' => StudentPresenter::iso($v->occurred_at), 'kind' => $v->kind->value])->all(),
            'objective' => $objective->all(),
            'objectiveScore' => (int) $objective->sum('awarded'),
            'objectiveTotal' => (int) $objective->sum('points'),
            'written' => $written->all(),
            'overallComment' => $attempt->overall_comment ?? '',
            'totalMarks' => (int) $questions->sum('points'),
        ];
    }

    /** The teacher's classes with their rosters and the exams each has. */
    public function classes(User $teacher): array
    {
        $classes = SchoolClass::where('tutor_id', $teacher->id)->with(['students' => fn ($q) => $q->orderBy('users.name')])->orderBy('name')->get();
        $sessions = ExamSession::with('exam')->whereIn('school_class_id', $classes->pluck('id'))->get()->groupBy('school_class_id');

        return $classes->map(fn (SchoolClass $c) => [
            'id' => $c->id,
            'name' => $c->name,
            'subjectCode' => $c->subject_code,
            'grade' => (int) $c->grade,
            'students' => $c->students->map(fn (User $s) => $this->person($s))->all(),
            'exams' => ($sessions->get($c->id) ?? collect())->map(fn (ExamSession $s) => [
                'examId' => $s->exam_id, 'sessionId' => $s->id, 'title' => $s->exam->title, 'status' => $s->status->value, 'released' => $s->results_released_at !== null,
            ])->values()->all(),
        ])->all();
    }
}

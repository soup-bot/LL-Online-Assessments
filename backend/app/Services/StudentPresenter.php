<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\QuestionKind;
use App\Models\Attempt;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Builds the JSON the student screens read (the DTOs in frontend/lib/api-types.ts). It only ever
 * reads what a student may see: no answer key until results are released, and then only the
 * correct answers, never the marking points.
 */
class StudentPresenter
{
    public static function iso(?CarbonInterface $date): ?string
    {
        return $date?->toIso8601ZuluString('millisecond');
    }

    public static function now(): string
    {
        return now()->toIso8601ZuluString('millisecond');
    }

    public function profile(User $user): array
    {
        $user->loadMissing('classes');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'firstName' => $user->firstName(),
            'initials' => $user->initials(),
            // A short label for the greeting. Use `classes` for anything structured.
            'className' => $user->classLabel(),
            // Every class the student sits in: several subjects, one class in each.
            'classes' => $user->classes->sortBy('name')->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'subjectCode' => $c->subject_code,
                'subjectName' => $c->subjectTitle(),
                'subjectShort' => $c->subjectShort(),
                'batch' => $c->batch(),
            ])->values()->all(),
        ];
    }

    /** One open exam as a card on the student's home screen. */
    public function examCard(ExamSession $session, array $stats, ?Attempt $attempt = null): array
    {
        $exam = $session->exam;
        $class = $session->schoolClass;

        return [
            'sessionId' => $session->id,
            'title' => $exam->title,
            'subjectCode' => $class->subject_code,
            'subjectName' => $class->subjectTitle(),
            'teacher' => $exam->owner->teacherLabel(),
            'timeLimitMinutes' => (int) $exam->time_limit_minutes,
            'questionCount' => $stats['questionCount'],
            'totalMarks' => $stats['totalMarks'],
            'kindCounts' => $stats['kindCounts'],
            'attemptId' => $attempt?->id,
            'deadlineAt' => self::iso($attempt?->deadline_at),
        ];
    }

    public function cover(ExamSession $session, User $student, array $stats, ?Attempt $attempt): array
    {
        $exam = $session->exam;
        $class = $session->schoolClass;

        return [
            'sessionId' => $session->id,
            'title' => $exam->title,
            'subjectCode' => $class->subject_code,
            'subjectName' => $class->subjectTitle(),
            'className' => $class->name,
            'teacher' => $exam->owner->teacherLabel(),
            'timeLimitMinutes' => (int) $exam->time_limit_minutes,
            'questionCount' => $stats['questionCount'],
            'totalMarks' => $stats['totalMarks'],
            'freeNavigation' => $exam->navigation->value !== 'in_order',
            'globalRules' => array_map(fn ($r) => ['id' => $r['id'], 'text' => $r['text']], config('exam.global_rules')),
            'examRules' => $exam->rules ?? '',
            'student' => $this->profile($student),
            'resumeAttemptId' => $attempt?->id,
        ];
    }

    /** The attempt as the student sits it: questions without keys, and their saved answers. */
    public function attemptState(Attempt $attempt, User $student): array
    {
        $session = $attempt->session;
        $class = $session->schoolClass;
        $questions = Question::where('exam_id', $session->exam_id)->orderBy('position')->get();
        $answers = $attempt->answers()->get()->keyBy('question_id');

        return [
            'attemptId' => $attempt->id,
            'sessionId' => $session->id,
            'title' => $session->exam->title,
            'subtitle' => implode(' · ', array_filter(["{$class->subjectShort()} {$class->subject_code}", $class->batch()])),
            'status' => $attempt->status->value,
            'serverNow' => self::now(),
            'deadlineAt' => self::iso($attempt->deadline_at),
            'violationCount' => (int) $attempt->violation_count,
            'maxViolations' => (int) config('exam.max_violations'),
            // Only what a student may see while sitting: never the answer key or marking points.
            'questions' => $questions->map(fn (Question $q) => [
                'id' => $q->id,
                'position' => $q->position,
                'kind' => $q->kind->value,
                'prompt' => $q->prompt,
                'points' => $q->points,
                'options' => $q->options,
            ])->values()->all(),
            'answers' => $answers->mapWithKeys(fn ($a) => [$a->question_id => ['response' => $a->response, 'flagged' => (bool) $a->flagged]])->all() ?: (object) [],
            'student' => $this->profile($student),
        ];
    }

    public function submitted(Attempt $attempt, User $student): array
    {
        $session = $attempt->session;
        $questions = Question::where('exam_id', $session->exam_id)->get();
        $answers = $attempt->answers()->get()->keyBy('question_id');
        $answered = $questions->filter(fn (Question $q) => Grader::hasAnswer($q->kind, $answers->get($q->id)?->response))->count();

        return [
            'attemptId' => $attempt->id,
            'title' => $session->exam->title,
            'student' => $this->profile($student),
            'teacher' => $session->exam->owner->teacherLabel(),
            'submittedAt' => self::iso($attempt->submitted_at ?? now()),
            'reason' => ($attempt->submit_reason?->value) ?? 'manual',
            'answered' => $answered,
            'questionCount' => $questions->count(),
            'awaitingMarking' => $attempt->status === AttemptStatus::Submitted,
            'status' => $attempt->status->value,
            'resultsReleased' => $this->isReleased($attempt),
        ];
    }

    public function isReleased(Attempt $attempt): bool
    {
        return $attempt->status === AttemptStatus::Marked && $attempt->session->results_released_at !== null;
    }

    /** A released result as a row on the results list or a "new result" card. Needs `score_sum`. */
    public function resultSummary(Attempt $attempt, array $stats): array
    {
        $session = $attempt->session;
        $class = $session->schoolClass;
        $score = (int) ($attempt->score_sum ?? 0);
        $total = $stats['totalMarks'];

        return [
            'attemptId' => $attempt->id,
            'title' => $session->exam->title,
            'subjectCode' => $class->subject_code,
            'subjectName' => $class->subjectTitle(),
            'score' => $score,
            'total' => $total,
            'percent' => Grader::percentOf($score, $total),
            'grade' => Grader::gradeFor($score, $total),
            'releasedAt' => self::iso($session->results_released_at),
            'isNew' => $attempt->result_viewed_at === null,
        ];
    }

    /** Released results and the ones still being marked, grouped by subject, newest first. */
    public function results(User $student): array
    {
        $attempts = Attempt::where('student_id', $student->id)
            ->where('status', '!=', AttemptStatus::InProgress->value)
            ->with(['session.exam', 'session.schoolClass'])
            ->withSum('answers as score_sum', 'awarded_marks')
            ->get();
        $stats = ExamStats::for($attempts->pluck('session.exam_id'));

        $groups = [];
        foreach ($attempts as $attempt) {
            $class = $attempt->session->schoolClass;
            $groups[$class->subject_code] ??= [
                'subjectCode' => $class->subject_code,
                'subjectName' => $class->subjectTitle(),
                'subjectShort' => $class->subjectShort(),
                'items' => [],
            ];

            if ($this->isReleased($attempt)) {
                $s = $this->resultSummary($attempt, $stats[$attempt->session->exam_id]);
                $groups[$class->subject_code]['items'][] = [
                    'kind' => 'released', 'attemptId' => $s['attemptId'], 'title' => $s['title'], 'score' => $s['score'], 'total' => $s['total'],
                    'percent' => $s['percent'], 'grade' => $s['grade'], 'releasedAt' => $s['releasedAt'], 'isNew' => $s['isNew'],
                ];
            } else {
                $groups[$class->subject_code]['items'][] = [
                    'kind' => 'pending', 'attemptId' => $attempt->id, 'title' => $attempt->session->exam->title,
                    'submittedAt' => self::iso($attempt->submitted_at ?? now()),
                    'stage' => $attempt->status === AttemptStatus::Marked ? 'release' : 'marking',
                ];
            }
        }

        $released = collect();
        foreach ($groups as &$group) {
            $chronological = collect($group['items'])->where('kind', 'released')->sortBy('releasedAt')->values();
            $previous = null;
            foreach ($chronological as $item) {
                if ($previous) {
                    foreach ($group['items'] as &$candidate) {
                        if ($candidate['kind'] === 'released' && $candidate['attemptId'] === $item['attemptId']) {
                            $candidate['previousGrade'] = $previous;
                        }
                    }
                    unset($candidate);
                }
                $previous = $item['grade'];
            }
            $released = $released->concat($chronological);

            // Released first (newest on top), then the ones still being marked.
            usort($group['items'], function ($x, $y) {
                if ($x['kind'] !== $y['kind']) {
                    return $x['kind'] === 'released' ? -1 : 1;
                }

                return $x['kind'] === 'released' ? strcmp($y['releasedAt'], $x['releasedAt']) : 0;
            });
        }
        unset($group);

        $newest = $released->sortByDesc('releasedAt')->first();
        $newestGroup = $newest ? collect($groups)->first(fn ($g) => collect($g['items'])->contains(fn ($i) => $i['kind'] === 'released' && $i['attemptId'] === $newest['attemptId'])) : null;

        return [
            'student' => $this->profile($student),
            'subjects' => array_values($groups),
            'releasedCount' => $released->count(),
            'pendingCount' => collect($groups)->sum(fn ($g) => collect($g['items'])->where('kind', 'pending')->count()),
            'latest' => $newest ? ['subjectShort' => $newestGroup['subjectShort'] ?? '', 'title' => $newest['title'], 'grade' => $newest['grade'], 'percent' => $newest['percent']] : null,
        ];
    }

    /** Full feedback for one released result, question by question. */
    public function resultDetail(Attempt $attempt, User $student): array
    {
        $session = $attempt->session;
        $exam = $session->exam;
        $class = $session->schoolClass;
        $questions = Question::where('exam_id', $exam->id)->orderBy('position')->get();
        $answers = $attempt->answers()->get()->keyBy('question_id');
        $score = (int) $answers->sum('awarded_marks');
        $total = (int) $questions->sum('points');

        return [
            'attemptId' => $attempt->id,
            'title' => $exam->title,
            'subjectName' => $class->subjectTitle(),
            'teacher' => $exam->owner->teacherLabel(),
            'teacherInitials' => $exam->owner->initials(),
            'score' => $score,
            'total' => $total,
            'percent' => Grader::percentOf($score, $total),
            'grade' => Grader::gradeFor($score, $total),
            'overallComment' => $attempt->overall_comment,
            'releasedAt' => self::iso($session->results_released_at),
            'questions' => $questions->map(function (Question $q) use ($answers) {
                $a = $answers->get($q->id);

                return [
                    'position' => $q->position,
                    'kind' => $q->kind->value,
                    'prompt' => $q->prompt,
                    'points' => $q->points,
                    'awarded' => (int) ($a?->awarded_marks ?? 0),
                    'yourAnswer' => $this->yourAnswer($q, $a?->response),
                    'correctAnswer' => $this->correctAnswer($q),
                    'feedback' => $a?->feedback,
                ];
            })->values()->all(),
            'student' => $this->profile($student),
        ];
    }

    private function optionText(Question $q, ?string $key): ?string
    {
        if ($key === null) {
            return null;
        }
        $option = collect($q->options ?? [])->firstWhere('key', $key);

        return $option ? "{$option['key']}. {$option['text']}" : $key;
    }

    private function yourAnswer(Question $q, ?string $response): ?string
    {
        if (! Grader::hasAnswer($q->kind, $response)) {
            return null;
        }

        return match ($q->kind) {
            QuestionKind::Mcq => $this->optionText($q, $response),
            QuestionKind::TrueFalse => $response === 'true' ? 'True' : 'False',
            default => trim((string) $response),
        };
    }

    /** Shown only on a released result. Written questions have no single right answer. */
    private function correctAnswer(Question $q): ?string
    {
        $key = $q->answer_key ?? [];

        return match ($q->kind) {
            QuestionKind::Mcq => $this->optionText($q, $key['correct'] ?? null),
            QuestionKind::TrueFalse => isset($key['correct']) ? ($key['correct'] ? 'True' : 'False') : null,
            QuestionKind::FillBlank => implode(', ', $key['accepted'] ?? []),
            QuestionKind::Written => null,
        };
    }
}

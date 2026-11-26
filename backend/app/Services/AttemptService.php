<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\QuestionKind;
use App\Enums\SessionStatus;
use App\Enums\SubmitReason;
use App\Enums\ViolationKind;
use App\Exceptions\ApiException;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\User;
use App\Models\Violation;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Everything that happens to a student's attempt: starting it, saving answers, the clock,
 * violations, and handing it in. The deadline is set once here, from the server's clock.
 */
class AttemptService
{
    /** Starts the timer. Safe to call twice: a second call returns the same attempt. */
    public function start(ExamSession $session, User $student): Attempt
    {
        $existing = Attempt::where('exam_session_id', $session->id)->where('student_id', $student->id)->first();
        if ($existing) {
            $this->expireIfDue($existing);
            if (! $existing->isInProgress()) {
                throw ApiException::conflict("You've already handed this exam in.");
            }

            return $existing;
        }

        if ($session->status !== SessionStatus::Open) {
            throw ApiException::notFound("This exam isn't open right now.");
        }

        $startedAt = now()->startOfSecond();

        try {
            return Attempt::create([
                'exam_session_id' => $session->id,
                'student_id' => $student->id,
                'started_at' => $startedAt,
                'deadline_at' => $startedAt->copy()->addMinutes($session->exam->time_limit_minutes),
                'status' => AttemptStatus::InProgress,
                'violation_count' => 0,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Two taps at once: the other request won, so hand back its attempt.
            return Attempt::where('exam_session_id', $session->id)->where('student_id', $student->id)->firstOrFail();
        }
    }

    /** True when the attempt ran out of time (plus the grace period) and has just been handed in. */
    public function expireIfDue(Attempt $attempt): bool
    {
        if (! $attempt->isInProgress()) {
            return false;
        }

        $limit = $attempt->deadline_at->copy()->addMilliseconds((int) config('exam.save_grace_ms'));
        if (now()->greaterThan($limit)) {
            $this->finalize($attempt, SubmitReason::Timeout, $attempt->deadline_at);

            return true;
        }

        return false;
    }

    /**
     * Hand in every attempt that has run out of time. The scheduled `attempts:expire` command and the
     * teacher screens call this, so a student who never comes back still ends up handed in.
     *
     * @param  iterable<int>|null  $sessionIds  limit to these sessions, or every session when null
     * @return int how many attempts were handed in
     */
    public function expireOverdue(?iterable $sessionIds = null): int
    {
        $limit = now()->subMilliseconds((int) config('exam.save_grace_ms'));
        $query = Attempt::where('status', AttemptStatus::InProgress->value)->where('deadline_at', '<', $limit);
        if ($sessionIds !== null) {
            $query->whereIn('exam_session_id', collect($sessionIds)->all());
        }

        $count = 0;
        $query->get()->each(function (Attempt $attempt) use (&$count) {
            if ($this->expireIfDue($attempt)) {
                $count++;
            }
        });

        return $count;
    }

    /**
     * Idempotent autosave of one answer and/or its flag. A save carrying an older `clientSavedAt`
     * than the stored one is ignored, so a retried request that arrives late cannot overwrite newer typing.
     *
     * @param  array{response?: ?string, flagged?: bool}  $patch
     */
    public function save(Attempt $attempt, int $questionId, array $patch, ?CarbonInterface $clientSavedAt): void
    {
        if ($this->expireIfDue($attempt)) {
            throw ApiException::expired("Time's up. Your exam was submitted with everything you had saved.");
        }
        if (! $attempt->isInProgress()) {
            throw ApiException::conflict('This exam has already been handed in.');
        }

        $question = Question::where('id', $questionId)->where('exam_id', $attempt->session->exam_id)->first()
            ?? throw ApiException::notFound("That question isn't part of this exam.");

        if (array_key_exists('response', $patch) && $patch['response'] !== null && ! $this->validResponse($question, $patch['response'])) {
            throw ApiException::validation("That answer isn't valid for this question.");
        }

        $answer = $this->answerRow($attempt, $question);
        if ($clientSavedAt && $answer->client_saved_at && $clientSavedAt->lt($answer->client_saved_at)) {
            return; // a stale retry
        }

        if (array_key_exists('response', $patch)) {
            $answer->response = $patch['response'];
        }
        if (array_key_exists('flagged', $patch)) {
            $answer->flagged = (bool) $patch['flagged'];
        }
        $answer->client_saved_at = $clientSavedAt ?? now();
        $answer->save();
    }

    /**
     * One call per time the student leaves the exam window. The last allowed one submits the exam.
     *
     * @return array{count: int, max: int, autoSubmitted: bool}
     */
    public function recordViolation(Attempt $attempt, ViolationKind $kind): array
    {
        if ($this->expireIfDue($attempt)) {
            throw ApiException::expired("Time's up. Your exam was submitted.");
        }
        if (! $attempt->isInProgress()) {
            throw ApiException::conflict('This exam has already been handed in.');
        }

        Violation::create(['attempt_id' => $attempt->id, 'kind' => $kind, 'occurred_at' => now()]);
        $attempt->increment('violation_count');

        $max = (int) config('exam.max_violations');
        $auto = $attempt->violation_count >= $max;
        if ($auto) {
            $this->finalize($attempt, SubmitReason::Violations);
        }

        return ['count' => (int) $attempt->violation_count, 'max' => $max, 'autoSubmitted' => $auto];
    }

    /** Idempotent: handing in twice does nothing the second time. */
    public function submit(Attempt $attempt, string $reason = 'manual'): Attempt
    {
        if ($attempt->isInProgress()) {
            $this->expireIfDue($attempt);
        }
        if ($attempt->isInProgress()) {
            $late = now()->greaterThanOrEqualTo($attempt->deadline_at);
            $this->finalize($attempt, $late || $reason === 'timeout' ? SubmitReason::Timeout : SubmitReason::Manual);
        }

        return $attempt;
    }

    /**
     * Hand the attempt in: fill blank answers, mark everything that can be marked by machine, and
     * decide whether the teacher is needed. Safe to call twice.
     */
    public function finalize(Attempt $attempt, SubmitReason $reason, ?CarbonInterface $at = null): void
    {
        DB::transaction(function () use ($attempt, $reason, $at) {
            $locked = Attempt::whereKey($attempt->id)->lockForUpdate()->first();
            if (! $locked || ! $locked->isInProgress()) {
                return;
            }

            $examId = ExamSession::whereKey($locked->exam_session_id)->value('exam_id');
            $answers = Answer::where('attempt_id', $locked->id)->get()->keyBy('question_id');
            $needsTeacher = false;
            $score = 0;

            foreach (Question::where('exam_id', $examId)->get() as $question) {
                $answer = $answers->get($question->id) ?? new Answer(['attempt_id' => $locked->id, 'question_id' => $question->id]);
                $auto = Grader::markObjective($question, $answer->response);

                if ($auto !== null) {
                    $answer->awarded_marks = $auto;
                } elseif (! Grader::hasAnswer(QuestionKind::Written, $answer->response)) {
                    $answer->awarded_marks = 0; // a blank written answer leaves nothing to mark
                } else {
                    $answer->awarded_marks = null;
                    $needsTeacher = true;
                }
                $answer->save();
                $score += $answer->awarded_marks ?? 0;
            }

            $locked->submitted_at = $at ?? now();
            $locked->submit_reason = $reason;
            $locked->status = $needsTeacher ? AttemptStatus::Submitted : AttemptStatus::Marked;
            $locked->total_score = $score;
            if (! $needsTeacher) {
                $locked->marked_at = now();
            }
            $locked->save();
        });

        $attempt->refresh();
    }

    private function validResponse(Question $question, string $value): bool
    {
        return match ($question->kind) {
            QuestionKind::Mcq => collect($question->options ?? [])->contains(fn ($o) => ($o['key'] ?? null) === $value),
            QuestionKind::TrueFalse => in_array($value, ['true', 'false'], true),
            default => mb_strlen($value) <= 6000,
        };
    }

    /** The answer row for this question, created on the first save. Two racing saves cannot duplicate it. */
    private function answerRow(Attempt $attempt, Question $question): Answer
    {
        try {
            return Answer::firstOrNew(['attempt_id' => $attempt->id, 'question_id' => $question->id]);
        } catch (UniqueConstraintViolationException) {
            return Answer::where(['attempt_id' => $attempt->id, 'question_id' => $question->id])->firstOrFail();
        }
    }
}

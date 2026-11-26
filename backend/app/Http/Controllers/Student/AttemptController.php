<?php

namespace App\Http\Controllers\Student;

use App\Enums\ViolationKind;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Student\RecordViolationRequest;
use App\Http\Requests\Student\SaveAnswerRequest;
use App\Http\Requests\Student\SubmitAttemptRequest;
use App\Services\AttemptService;
use App\Services\StudentAccess;
use App\Services\StudentPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Sitting an exam: reading it, the clock, autosave, violations and handing in.
 */
class AttemptController extends Controller
{
    public function __construct(
        private StudentAccess $access,
        private AttemptService $attempts,
        private StudentPresenter $present,
    ) {}

    /**
     * The attempt
     *
     * Everything the exam screen needs: the questions (never the answer key), what the student has saved so far,
     * and the server's clock. An attempt that ran out of time is handed in first, so a late reload sees `submitted`.
     *
     * @response array{
     *   attemptId: int, sessionId: int, title: string, subtitle: string, status: string, serverNow: string, deadlineAt: string,
     *   violationCount: int, maxViolations: int,
     *   questions: list<array{id: int, position: int, kind: string, prompt: string, points: int, options: list<array{key: string, text: string}>|null}>,
     *   answers: array<string, array{response: string|null, flagged: bool}>,
     *   student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>}
     * }
     */
    public function show(Request $request, int $attempt): JsonResponse
    {
        $student = $request->user();
        $attempt = $this->access->attempt($student, $attempt);
        $this->attempts->expireIfDue($attempt);

        return response()->json($this->present->attemptState($attempt, $student));
    }

    /**
     * The server's clock
     *
     * Just the time and deadline. The screen asks for this whenever the student returns to the tab, so a countdown
     * that fell behind while the phone slept is corrected.
     *
     * @response array{serverNow: string, deadlineAt: string, status: string}
     */
    public function clock(Request $request, int $attempt): JsonResponse
    {
        $attempt = $this->access->attempt($request->user(), $attempt);
        $this->attempts->expireIfDue($attempt);

        return response()->json([
            'serverNow' => StudentPresenter::now(),
            'deadlineAt' => StudentPresenter::iso($attempt->deadline_at),
            'status' => $attempt->status->value,
        ]);
    }

    /**
     * Save an answer
     *
     * Idempotent autosave of one answer and/or its flag. Returns the clock so the countdown can re-sync.
     * 410 `expired` once the deadline (plus a 5 second grace) has passed: the exam is handed in as it stood.
     * 409 if it is already handed in; 422 if the answer isn't valid for that kind of question.
     *
     * @response array{serverNow: string, deadlineAt: string}
     */
    public function saveAnswer(SaveAnswerRequest $request, int $attempt, int $question): JsonResponse
    {
        $attempt = $this->access->attempt($request->user(), $attempt);

        $patch = [];
        if ($request->exists('response')) {
            $patch['response'] = $request->input('response');
        }
        if ($request->exists('flagged')) {
            $patch['flagged'] = $request->boolean('flagged');
        }
        $at = $request->filled('clientSavedAt') ? Carbon::parse($request->input('clientSavedAt')) : null;

        $this->attempts->save($attempt, $question, $patch, $at);

        return response()->json(['serverNow' => StudentPresenter::now(), 'deadlineAt' => StudentPresenter::iso($attempt->deadline_at)]);
    }

    /**
     * Record leaving the window
     *
     * One call each time the student switches tab or app. The third one hands the exam in automatically.
     *
     * @response array{count: int, max: int, autoSubmitted: bool}
     */
    public function violation(RecordViolationRequest $request, int $attempt): JsonResponse
    {
        $attempt = $this->access->attempt($request->user(), $attempt);
        $kind = ViolationKind::tryFrom((string) $request->input('kind')) ?? ViolationKind::Hidden;

        return response()->json($this->attempts->recordViolation($attempt, $kind));
    }

    /**
     * Hand in
     *
     * Idempotent: handing in twice just returns the summary. Objective questions are marked now; if there are
     * written answers, the attempt waits for the teacher (`awaitingMarking`).
     *
     * @response array{attemptId: int, title: string, student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>}, teacher: string, submittedAt: string, reason: string, answered: int, questionCount: int, awaitingMarking: bool, status: string, resultsReleased: bool}
     */
    public function submit(SubmitAttemptRequest $request, int $attempt): JsonResponse
    {
        $student = $request->user();
        $attempt = $this->attempts->submit($this->access->attempt($student, $attempt), $request->input('reason', 'manual'));

        return response()->json($this->present->submitted($attempt, $student));
    }

    /**
     * Handed-in summary
     *
     * What the "nice work" screen shows. 409 while the exam is still being sat.
     *
     * @response array{attemptId: int, title: string, student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>}, teacher: string, submittedAt: string, reason: string, answered: int, questionCount: int, awaitingMarking: bool, status: string, resultsReleased: bool}
     */
    public function submitted(Request $request, int $attempt): JsonResponse
    {
        $student = $request->user();
        $attempt = $this->access->attempt($student, $attempt);
        $this->attempts->expireIfDue($attempt);

        if ($attempt->isInProgress()) {
            throw ApiException::conflict("This exam hasn't been handed in yet.");
        }

        return response()->json($this->present->submitted($attempt, $student));
    }
}

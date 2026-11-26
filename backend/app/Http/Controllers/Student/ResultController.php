<?php

namespace App\Http\Controllers\Student;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\StudentAccess;
use App\Services\StudentPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Results. A student sees marks, grade and feedback only after the teacher has released them.
 */
class ResultController extends Controller
{
    public function __construct(
        private StudentAccess $access,
        private StudentPresenter $present,
    ) {}

    /**
     * My results
     *
     * Released results and ones still being marked, grouped by subject, with the grade before each one in the
     * same subject (`previousGrade`) and the most recent grade overall (`latest`).
     *
     * @response array{
     *   student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>},
     *   subjects: list<array{subjectCode: string, subjectName: string, subjectShort: string, items: list<array<string, mixed>>}>,
     *   releasedCount: int, pendingCount: int,
     *   latest: array{subjectShort: string, title: string, grade: string, percent: float}|null
     * }
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json($this->present->results($request->user()));
    }

    /**
     * One result
     *
     * Score, grade, the teacher's comment, and every question with the student's answer, the marks and the feedback.
     * The correct answer is included here, and only here. 404 until the teacher releases the results.
     *
     * @response array{
     *   attemptId: int, title: string, subjectName: string, teacher: string, teacherInitials: string,
     *   score: int, total: int, percent: float, grade: string, overallComment: string|null, releasedAt: string,
     *   questions: list<array{position: int, kind: string, prompt: string, points: int, awarded: int, yourAnswer: string|null, correctAnswer: string|null, feedback: string|null}>,
     *   student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>}
     * }
     */
    public function show(Request $request, int $attempt): JsonResponse
    {
        $student = $request->user();
        $attempt = $this->access->attempt($student, $attempt);

        if (! $this->present->isReleased($attempt)) {
            throw ApiException::notFound("These results haven't been released yet.");
        }
        $attempt->result_viewed_at ??= now();
        $attempt->save();

        return response()->json($this->present->resultDetail($attempt, $student));
    }

    /**
     * Mark a result as seen
     *
     * Clears the "New" badge without opening the result.
     */
    public function viewed(Request $request, int $attempt): JsonResponse
    {
        $attempt = $this->access->attempt($request->user(), $attempt);
        $attempt->result_viewed_at ??= now();
        $attempt->save();

        return response()->json(['ok' => true]);
    }
}

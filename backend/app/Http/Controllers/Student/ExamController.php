<?php

namespace App\Http\Controllers\Student;

use App\Enums\AttemptStatus;
use App\Enums\SessionStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Services\AttemptService;
use App\Services\ExamStats;
use App\Services\StudentAccess;
use App\Services\StudentPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's home screen and the cover page of an exam.
 */
class ExamController extends Controller
{
    public function __construct(
        private StudentAccess $access,
        private AttemptService $attempts,
        private StudentPresenter $present,
    ) {}

    /**
     * Home
     *
     * Exams open right now for the student's classes (not started, or already in progress), and
     * released results they haven't looked at yet.
     *
     * @response array{
     *   student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>},
     *   serverNow: string,
     *   open: list<array{sessionId: int, title: string, subjectCode: string, subjectName: string, teacher: string, timeLimitMinutes: int, questionCount: int, totalMarks: int, kindCounts: array{mcq: int, true_false: int, fill_blank: int, written: int}, attemptId: int|null, deadlineAt: string|null}>,
     *   inProgress: list<array{sessionId: int, title: string, subjectCode: string, subjectName: string, teacher: string, timeLimitMinutes: int, questionCount: int, totalMarks: int, kindCounts: array{mcq: int, true_false: int, fill_blank: int, written: int}, attemptId: int|null, deadlineAt: string|null}>,
     *   newResults: list<array{attemptId: int, title: string, subjectCode: string, subjectName: string, score: int, total: int, percent: float, grade: string, releasedAt: string, isNew: bool}>
     * }
     */
    public function home(Request $request): JsonResponse
    {
        $student = $request->user();
        $classIds = $student->classes()->pluck('school_classes.id');

        $sessions = ExamSession::with(['exam.owner', 'schoolClass'])
            ->whereIn('school_class_id', $classIds)
            ->where('status', SessionStatus::Open->value)
            ->whereHas('exam', fn ($q) => $q->where('status', 'published'))
            ->get();
        $attempts = Attempt::where('student_id', $student->id)->whereIn('exam_session_id', $sessions->pluck('id'))->get()->keyBy('exam_session_id');
        $stats = ExamStats::for($sessions->pluck('exam_id'));

        $open = [];
        $inProgress = [];
        foreach ($sessions as $session) {
            $attempt = $attempts->get($session->id);
            if ($attempt) {
                $this->attempts->expireIfDue($attempt);
            }
            if (! $attempt) {
                $open[] = $this->present->examCard($session, $stats[$session->exam_id]);
            } elseif ($attempt->isInProgress()) {
                $inProgress[] = $this->present->examCard($session, $stats[$session->exam_id], $attempt);
            }
        }

        $fresh = Attempt::where('student_id', $student->id)
            ->where('status', AttemptStatus::Marked->value)
            ->whereNull('result_viewed_at')
            ->whereHas('session', fn ($q) => $q->whereNotNull('results_released_at'))
            ->with(['session.exam', 'session.schoolClass'])
            ->withSum('answers as score_sum', 'awarded_marks')
            ->get()
            ->sortByDesc(fn ($a) => $a->session->results_released_at);
        $freshStats = ExamStats::for($fresh->pluck('session.exam_id'));

        return response()->json([
            'student' => $this->present->profile($student),
            'serverNow' => StudentPresenter::now(),
            'open' => $open,
            'inProgress' => $inProgress,
            'newResults' => $fresh->map(fn ($a) => $this->present->resultSummary($a, $freshStats[$a->session->exam_id]))->values()->all(),
        ]);
    }

    /**
     * Exam cover page
     *
     * Time, marks and the rules, shown before the student starts. If they already started, `resumeAttemptId`
     * says where to go back to. 409 if they have already handed it in; 404 if it isn't open or isn't theirs.
     *
     * @response array{
     *   sessionId: int, title: string, subjectCode: string, subjectName: string, className: string, teacher: string,
     *   timeLimitMinutes: int, questionCount: int, totalMarks: int, freeNavigation: bool,
     *   globalRules: list<array{id: string, text: string}>, examRules: string,
     *   student: array{id: int, name: string, firstName: string, initials: string, className: string, classes: list<array{id: int, name: string, subjectCode: string, subjectName: string, subjectShort: string, batch: string}>},
     *   resumeAttemptId: int|null
     * }
     */
    public function cover(Request $request, int $session): JsonResponse
    {
        $student = $request->user();
        $session = $this->access->session($student, $session);

        $attempt = Attempt::where('exam_session_id', $session->id)->where('student_id', $student->id)->first();
        if ($attempt) {
            $this->attempts->expireIfDue($attempt);
        }
        if ($attempt && ! $attempt->isInProgress()) {
            throw ApiException::conflict("You've already handed this exam in.");
        }
        if (! $attempt && $session->status !== SessionStatus::Open) {
            throw ApiException::notFound("This exam isn't open right now.");
        }

        $stats = ExamStats::for([$session->exam_id])[$session->exam_id];

        return response()->json($this->present->cover($session, $student, $stats, $attempt));
    }

    /**
     * Start the exam
     *
     * Starts the timer: the deadline is fixed now, from the server's clock, as start time plus the exam's time limit.
     * Safe to call twice; a second call returns the same attempt.
     *
     * @response array{attemptId: int}
     */
    public function start(Request $request, int $session): JsonResponse
    {
        $student = $request->user();
        $attempt = $this->attempts->start($this->access->session($student, $session), $student);

        return response()->json(['attemptId' => $attempt->id]);
    }
}

<?php

namespace App\Http\Controllers\Tutor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tutor\UpdateExamRequest;
use App\Models\Exam;
use App\Services\ExamBuilderService;
use App\Services\StaffAccess;
use App\Services\TeacherPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A teacher's exams: the list, creating a draft, its settings and publishing it.
 */
class ExamController extends Controller
{
    public function __construct(
        private StaffAccess $access,
        private ExamBuilderService $builder,
        private TeacherPresenter $present,
    ) {}

    /**
     * My exams
     *
     * The teacher's exams with their stage and progress, plus the three counts for the tiles. Filter with
     * `filter` (all, drafts, published, marking), search titles with `q`, sort with `sort` (attention, recent, name,
     * progress) and `dir` (asc, desc), and page with `page` and `per_page`. The counts always cover every exam.
     *
     * @response array{
     *   tutor: array{id: int, name: string, initials: string, email: string, role: string},
     *   stats: array{open: int, toMark: int, drafts: int},
     *   exams: list<array<string, mixed>>,
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function index(Request $request): JsonResponse
    {
        $teacher = $request->user();
        [$page, $perPage] = $this->paging($request);

        $all = $this->present->examRows(Exam::ownedBy($teacher)->get());
        $arranged = $this->present->arrange(
            $all,
            (string) $request->query('filter', 'all'),
            $request->query('q'),
            (string) $request->query('sort', 'attention'),
            $request->query('dir') === 'desc' ? 'desc' : 'asc',
            $page,
            $perPage,
        );

        return response()->json([
            'tutor' => $this->present->profile($teacher),
            'stats' => [
                'open' => collect($all)->sum(fn ($e) => collect($e['classes'])->where('status', 'open')->count()),
                'toMark' => collect($all)->sum('toMark'),
                'drafts' => collect($all)->where('status', 'draft')->count(),
            ],
            'exams' => $arranged['rows'],
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $arranged['total']],
        ]);
    }

    /**
     * Start a new exam
     *
     * Creates an untitled draft already linked to all of the teacher's classes.
     *
     * @response array{examId: int}
     */
    public function store(Request $request): JsonResponse
    {
        return response()->json(['examId' => $this->builder->create($request->user())->id], 201);
    }

    /**
     * The builder
     *
     * Settings, questions with their approval state, the teacher's classes, and why Publish is disabled
     * (`publishBlocker`, null when allowed). Admins can read any exam but `canEdit` is false for them.
     *
     * @response array<string, mixed>
     */
    public function show(Request $request, int $exam): JsonResponse
    {
        $user = $request->user();

        return response()->json($this->present->builder($this->access->exam($user, $exam), $user));
    }

    /**
     * Change settings
     *
     * Title, minutes, order, rules and which classes sit it. Drafts only: a published exam is locked (409).
     * Send only the fields that changed.
     */
    public function update(UpdateExamRequest $request, int $exam): JsonResponse
    {
        $this->builder->update($this->access->draft($request->user(), $exam), $request->validated());

        return response()->json(['ok' => true]);
    }

    /**
     * Publish
     *
     * Locks the questions, answer keys and settings for good. Needs a title, at least one question, every
     * question approved, and at least one class (422 otherwise).
     */
    public function publish(Request $request, int $exam): JsonResponse
    {
        $user = $request->user();
        $this->builder->publish($this->access->draft($user, $exam), $user);

        return response()->json(['ok' => true]);
    }
}

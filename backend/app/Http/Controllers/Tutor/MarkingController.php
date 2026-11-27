<?php

namespace App\Http\Controllers\Tutor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tutor\SaveMarksRequest;
use App\Services\MarkingService;
use App\Services\StaffAccess;
use App\Services\TeacherPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Marking written answers.
 */
class MarkingController extends Controller
{
    public function __construct(
        private StaffAccess $access,
        private MarkingService $marking,
        private TeacherPresenter $present,
    ) {}

    /**
     * To mark
     *
     * Submissions with written answers waiting for this teacher. Search a student's name or an exam's title with
     * `q`, narrow with `exam` and `class` (ids), sort with `sort` (oldest, newest, student), and page with `page` and
     * `per_page`. `filters` lists the exams and classes that have something waiting, with counts, for the dropdowns.
     *
     * @response array{
     *   items: list<array<string, mixed>>,
     *   filters: array{exams: list<array{id: int, title: string, count: int}>, classes: list<array{id: int, name: string, count: int}>, total: int},
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function index(Request $request): JsonResponse
    {
        [$page, $perPage] = $this->paging($request);

        $sort = in_array($request->query('sort'), ['oldest', 'newest', 'student'], true) ? $request->query('sort') : 'oldest';

        return response()->json($this->present->toMark(
            $request->user(),
            $page,
            $perPage,
            $request->query('q'),
            $request->integer('exam') ?: null,
            $request->integer('class') ?: null,
            $sort,
        ));
    }

    /**
     * To-mark count
     *
     * Just the number, for the badge in the header.
     *
     * @response int
     */
    public function count(Request $request): JsonResponse
    {
        return response()->json($this->present->toMarkCount($request->user()));
    }

    /**
     * A submission
     *
     * What the marking screen shows: the auto-marked answers, each written answer with its marking points, any
     * times the student left the window, and whether marks can still be changed (`canEdit`).
     *
     * @response array<string, mixed>
     */
    public function show(Request $request, int $attempt): JsonResponse
    {
        $user = $request->user();

        return response()->json($this->present->marking($this->access->attempt($user, $attempt), $user));
    }

    /**
     * Save marks
     *
     * Every written question needs a mark between 0 and its points. Saving completes the marking: the attempt
     * becomes `marked`. 409 while the student is still sitting or after results are released.
     *
     * @response array{score: int, total: int, grade: string}
     */
    public function save(SaveMarksRequest $request, int $attempt): JsonResponse
    {
        $user = $request->user();

        return response()->json($this->marking->save($user, $this->access->attempt($user, $attempt), $request->validated()));
    }
}

<?php

namespace App\Http\Controllers\Tutor;

use App\Http\Controllers\Controller;
use App\Services\SessionManager;
use App\Services\StaffAccess;
use App\Services\TeacherPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Running an exam for a class: opening it, watching who is sitting, closing it and releasing results.
 */
class SessionController extends Controller
{
    public function __construct(
        private StaffAccess $access,
        private SessionManager $sessions,
        private TeacherPresenter $present,
    ) {}

    /**
     * Classes for an exam
     *
     * One card per class with its status and how many students are sitting, handed in, waiting to be marked
     * and not started. Anyone still past their deadline is handed in first, so the counts are right.
     *
     * @response array{
     *   exam: array{id: int, title: string, status: string, questionCount: int, totalMarks: int},
     *   canEdit: bool,
     *   classes: list<array<string, mixed>>
     * }
     */
    public function index(Request $request, int $exam): JsonResponse
    {
        $user = $request->user();

        return response()->json($this->present->sessions($this->access->exam($user, $exam), $user));
    }

    /**
     * Live list
     *
     * Every student in the class with where they are, needs-marking first. Search by name with `q`, filter with
     * `state` (to_mark, sitting, waiting, marked), and page with `page` and `per_page`. `counts` has the size of
     * each filter, and `release` says whether results can be released yet.
     *
     * @response array{
     *   card: array<string, mixed>,
     *   rows: list<array<string, mixed>>,
     *   counts: array{all: int, to_mark: int, sitting: int, waiting: int, marked: int},
     *   questionCount: int,
     *   release: array{closed: bool, toMark: int, released: bool, canRelease: bool},
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function live(Request $request, int $session): JsonResponse
    {
        $session = $this->access->session($request->user(), $session);
        [$page, $perPage] = $this->paging($request);

        return response()->json($this->present->live($session, $request->query('q'), $request->query('state'), $page, $perPage));
    }

    /**
     * Open for a class
     *
     * Students in the class can see and start the exam from now. 409 if the exam isn't published or the class was
     * already opened.
     */
    public function open(Request $request, int $session): JsonResponse
    {
        $user = $request->user();
        $this->sessions->open($this->access->session($user, $session, true), $user);

        return response()->json(['ok' => true]);
    }

    /**
     * Close for a class
     *
     * Nobody else can start it. Anyone still sitting is handed in with what they have saved.
     *
     * @response array{submitted: int}
     */
    public function close(Request $request, int $session): JsonResponse
    {
        $user = $request->user();

        return response()->json(['submitted' => $this->sessions->close($this->access->session($user, $session, true), $user)]);
    }

    /**
     * Release results
     *
     * Students see their marks, grade and feedback from now. The class must be closed and every submission
     * marked (409 otherwise).
     */
    public function release(Request $request, int $session): JsonResponse
    {
        $user = $request->user();
        $this->sessions->release($this->access->session($user, $session, true), $user);

        return response()->json(['ok' => true]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    public function __construct(private AdminPresenter $present) {}

    /**
     * All exams
     *
     * One row per published exam and class, newest exam first, with how many students have handed in and been marked.
     * Filter with `teacher` (a user id), `class` (a class id), `status` (not_open, open, closed, released) and `q`
     * (title), and page with `page` and `per_page`. `averagePercent` is filled in only once results are released.
     * Open a row with the teacher endpoints, which admins can read.
     *
     * @response array{
     *   rows: list<array{sessionId: int, examId: int, title: string, teacher: string, teacherId: int, classId: int, className: string, status: string, handedIn: int, students: int, marked: int, averagePercent: float|null}>,
     *   teachers: list<array{id: int, name: string, initials: string}>,
     *   classes: list<array{id: int, name: string, label: string}>,
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function index(Request $request): JsonResponse
    {
        [$page, $perPage] = $this->paging($request);

        return response()->json($this->present->exams(
            $request->integer('teacher') ?: null,
            $request->integer('class') ?: null,
            $request->query('status'),
            $request->query('q'),
            $page,
            $perPage,
        ));
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(private AdminPresenter $present) {}

    /**
     * Find students
     *
     * For the class screen's "Add a student" search: students by name, each with the classes they already sit in
     * (so the screen can show who is already taken for a subject). Page with `page` and `per_page`.
     *
     * @response array{
     *   students: list<array{id: int, name: string, initials: string, classes: list<array{id: int, name: string, subjectCode: string}>}>,
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function index(Request $request): JsonResponse
    {
        [$page, $perPage] = $this->paging($request);

        return response()->json($this->present->students($request->query('q'), $page, $perPage));
    }
}

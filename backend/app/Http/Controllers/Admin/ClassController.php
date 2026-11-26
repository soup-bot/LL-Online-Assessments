<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveClassRequest;
use App\Models\SchoolClass;
use App\Services\AdminClassService;
use App\Services\AdminPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Classes and who is in them.
 */
class ClassController extends Controller
{
    public function __construct(private AdminClassService $classes, private AdminPresenter $present) {}

    /**
     * Classes
     *
     * Every class with its teacher and students, plus the teachers for the dropdown. Search name or subject code with
     * `q`, and page with `page` and `per_page`.
     *
     * @response array{
     *   classes: list<array{id: int, name: string, subjectCode: string, grade: int, tutorId: int, students: list<array{id: int, name: string, initials: string}>}>,
     *   tutors: list<array{id: int, name: string, initials: string}>,
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function index(Request $request): JsonResponse
    {
        [$page, $perPage] = $this->paging($request);

        return response()->json($this->present->classes($request->query('q'), $page, $perPage));
    }

    /**
     * New class
     *
     * @response 201 array{id: int, name: string, subjectCode: string, grade: int, tutorId: int, students: list<array{id: int, name: string, initials: string}>}
     */
    public function store(SaveClassRequest $request): JsonResponse
    {
        $class = $this->classes->save($request->user(), null, $request->validated());

        return response()->json($this->present->schoolClass($class->load('students')), 201);
    }

    /**
     * Edit a class
     *
     * Send the whole roster in `studentIds`. 409 if a student already has another class for this subject, if you
     * remove a student who has sat an exam in the class, or if you change the teacher of a class that already has
     * exams.
     *
     * @response array{id: int, name: string, subjectCode: string, grade: int, tutorId: int, students: list<array{id: int, name: string, initials: string}>}
     */
    public function update(SaveClassRequest $request, int $class): JsonResponse
    {
        $target = SchoolClass::find($class) ?? throw ApiException::notFound("We couldn't find that class.");
        $saved = $this->classes->save($request->user(), $target, $request->validated());

        return response()->json($this->present->schoolClass($saved->load('students')));
    }
}

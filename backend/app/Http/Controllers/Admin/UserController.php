<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveUserRequest;
use App\Models\User;
use App\Services\AdminPresenter;
use App\Services\AdminUserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Accounts: teachers, students and admins.
 */
class UserController extends Controller
{
    public function __construct(private AdminUserService $users, private AdminPresenter $present) {}

    /**
     * Users
     *
     * Everyone with their role and classes. Search name or email with `q`, filter with `role` (tutor, student, admin),
     * and page with `page` and `per_page`. `counts` always covers everyone, whatever the filter.
     *
     * @response array{
     *   users: list<array{id: int, name: string, initials: string, email: string, role: string, isActive: bool, classes: string}>,
     *   counts: array{tutors: int, students: int, admins: int},
     *   meta: array{page: int, perPage: int, total: int}
     * }
     */
    public function index(Request $request): JsonResponse
    {
        [$page, $perPage] = $this->paging($request);

        return response()->json($this->present->users($request->query('q'), $request->query('role'), $page, $perPage));
    }

    /**
     * Add a user
     *
     * Without a `password` the account gets the default one from the server's settings (`DEFAULT_USER_PASSWORD`).
     *
     * @response 201 array{id: int, name: string, initials: string, email: string, role: string, isActive: bool, classes: string}
     */
    public function store(SaveUserRequest $request): JsonResponse
    {
        $user = $this->users->save($request->user(), null, $request->validated());

        return response()->json($this->present->user($user->load(['classesTaught', 'classes'])), 201);
    }

    /**
     * Edit a user
     *
     * Name, email, role, password and active state. A role can't change while it would orphan work: a teacher with
     * classes or exams, or a student with attempts (409). You can't remove your own admin access or deactivate
     * yourself. Deactivating signs the account out everywhere.
     *
     * @response array{id: int, name: string, initials: string, email: string, role: string, isActive: bool, classes: string}
     */
    public function update(SaveUserRequest $request, int $user): JsonResponse
    {
        $target = User::find($user) ?? throw ApiException::notFound("We couldn't find that user.");
        $saved = $this->users->save($request->user(), $target, $request->validated());

        return response()->json($this->present->user($saved->load(['classesTaught', 'classes'])));
    }
}

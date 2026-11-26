<?php

namespace App\Http\Controllers\Tutor;

use App\Http\Controllers\Controller;
use App\Services\TeacherPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassController extends Controller
{
    public function __construct(private TeacherPresenter $present) {}

    /**
     * My classes
     *
     * The teacher's classes with their students and the exams each class has.
     *
     * @response list<array<string, mixed>>
     */
    public function index(Request $request): JsonResponse
    {
        return response()->json($this->present->classes($request->user()));
    }
}

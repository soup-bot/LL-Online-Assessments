<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Student;
use App\Http\Controllers\Tutor;
use Illuminate\Support\Facades\Route;

/*
 * All routes here are served under /api/v1 (see bootstrap/app.php).
 * The full endpoint list is in the backend design page; groups are added as each part is built.
 */

/**
 * Health check
 *
 * Answers `{ status: "ok", time }` when the API is up. No sign-in needed.
 *
 * @unauthenticated
 */
Route::get('/health', fn () => response()->json(['status' => 'ok', 'time' => now()->toIso8601String()]));

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Students: sit exams and read results.
    Route::middleware('role:student')->prefix('student')->group(function () {
        Route::get('/home', [Student\ExamController::class, 'home']);
        Route::get('/exams/{session}/cover', [Student\ExamController::class, 'cover'])->whereNumber('session');
        Route::post('/exams/{session}/start', [Student\ExamController::class, 'start'])->whereNumber('session');

        Route::get('/attempts/{attempt}', [Student\AttemptController::class, 'show'])->whereNumber('attempt');
        Route::get('/attempts/{attempt}/clock', [Student\AttemptController::class, 'clock'])->whereNumber('attempt');
        Route::put('/attempts/{attempt}/answers/{question}', [Student\AttemptController::class, 'saveAnswer'])->whereNumber(['attempt', 'question']);
        Route::post('/attempts/{attempt}/violations', [Student\AttemptController::class, 'violation'])->whereNumber('attempt');
        Route::post('/attempts/{attempt}/submit', [Student\AttemptController::class, 'submit'])->whereNumber('attempt');
        Route::get('/attempts/{attempt}/submitted', [Student\AttemptController::class, 'submitted'])->whereNumber('attempt');

        Route::get('/results', [Student\ResultController::class, 'index']);
        Route::get('/results/{attempt}', [Student\ResultController::class, 'show'])->whereNumber('attempt');
        Route::post('/results/{attempt}/viewed', [Student\ResultController::class, 'viewed'])->whereNumber('attempt');
    });

    // Teachers build, run and mark exams. Admins may read the exam, class and submission pages but not change them.
    Route::middleware('role:tutor,admin')->prefix('tutor')->group(function () {
        Route::get('/exams/{exam}', [Tutor\ExamController::class, 'show'])->whereNumber('exam');
        Route::get('/exams/{exam}/questions/new', [Tutor\QuestionController::class, 'template'])->whereNumber('exam');
        Route::get('/exams/{exam}/questions/{question}', [Tutor\QuestionController::class, 'show'])->whereNumber(['exam', 'question']);
        Route::get('/exams/{exam}/sessions', [Tutor\SessionController::class, 'index'])->whereNumber('exam');
        Route::get('/sessions/{session}/live', [Tutor\SessionController::class, 'live'])->whereNumber('session');
        Route::get('/attempts/{attempt}', [Tutor\MarkingController::class, 'show'])->whereNumber('attempt');

        Route::middleware('role:tutor')->group(function () {
            Route::get('/exams', [Tutor\ExamController::class, 'index']);
            Route::post('/exams', [Tutor\ExamController::class, 'store']);
            Route::patch('/exams/{exam}', [Tutor\ExamController::class, 'update'])->whereNumber('exam');
            Route::delete('/exams/{exam}', [Tutor\ExamController::class, 'destroy'])->whereNumber('exam');
            Route::post('/exams/{exam}/publish', [Tutor\ExamController::class, 'publish'])->whereNumber('exam');

            Route::post('/exams/{exam}/questions', [Tutor\QuestionController::class, 'store'])->whereNumber('exam');
            Route::post('/exams/{exam}/questions/import', [Tutor\QuestionController::class, 'import'])->whereNumber('exam');
            Route::put('/exams/{exam}/questions/{question}', [Tutor\QuestionController::class, 'update'])->whereNumber(['exam', 'question']);
            Route::delete('/exams/{exam}/questions/{question}', [Tutor\QuestionController::class, 'destroy'])->whereNumber(['exam', 'question']);
            Route::patch('/exams/{exam}/questions/{question}/approval', [Tutor\QuestionController::class, 'approval'])->whereNumber(['exam', 'question']);

            Route::post('/sessions/{session}/open', [Tutor\SessionController::class, 'open'])->whereNumber('session');
            Route::post('/sessions/{session}/close', [Tutor\SessionController::class, 'close'])->whereNumber('session');
            Route::post('/sessions/{session}/release', [Tutor\SessionController::class, 'release'])->whereNumber('session');

            Route::get('/to-mark', [Tutor\MarkingController::class, 'index']);
            Route::get('/to-mark/count', [Tutor\MarkingController::class, 'count']);
            Route::put('/attempts/{attempt}/marks', [Tutor\MarkingController::class, 'save'])->whereNumber('attempt');

            Route::get('/classes', [Tutor\ClassController::class, 'index']);
        });
    });

    // Admins manage accounts and classes and see every exam.
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/users', [Admin\UserController::class, 'index']);
        Route::post('/users', [Admin\UserController::class, 'store']);
        Route::patch('/users/{user}', [Admin\UserController::class, 'update'])->whereNumber('user');

        Route::get('/classes', [Admin\ClassController::class, 'index']);
        Route::post('/classes', [Admin\ClassController::class, 'store']);
        Route::patch('/classes/{class}', [Admin\ClassController::class, 'update'])->whereNumber('class');

        Route::get('/students', [Admin\StudentController::class, 'index']);
        Route::get('/exams', [Admin\ExamController::class, 'index']);
    });
});

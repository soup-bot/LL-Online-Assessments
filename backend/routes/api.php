<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Student;
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

    // Next: role:tutor,admin for /tutor, role:admin for /admin.
});

<?php

use App\Http\Controllers\Auth\AuthController;
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

    // Next: Route::middleware('role:student')->prefix('student'), role:tutor,admin for /tutor, role:admin for /admin.
});

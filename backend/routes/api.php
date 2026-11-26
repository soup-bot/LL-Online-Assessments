<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
 * All routes here are served under /api/v1 (see bootstrap/app.php).
 * The full endpoint list is in the backend design page; groups are added as each part is built.
 */

Route::get('/health', fn () => response()->json(['status' => 'ok', 'time' => now()->toIso8601String()]));

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', fn (Request $request) => $request->user());
});

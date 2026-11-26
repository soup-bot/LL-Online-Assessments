<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps each area for its own role. Use it after auth:sanctum, listing the roles that may pass:
 *   Route::middleware(['auth:sanctum', 'role:tutor,admin'])
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_active || ! in_array($user->role->value, $roles, true)) {
            throw ApiException::forbidden();
        }

        return $next($request);
    }
}

<?php

namespace App\Support;

use App\Exceptions\ApiException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Turns any exception into the one error shape the frontend understands:
 * { "code": "...", "message": "...", "errors": { field: [messages] } }.
 */
class ApiErrors
{
    public static function render(Throwable $e): JsonResponse
    {
        [$status, $code, $message, $errors] = match (true) {
            $e instanceof ApiException => [$e->status, $e->errorCode, $e->getMessage(), $e->errors],
            $e instanceof ValidationException => [
                422,
                'validation',
                collect($e->errors())->flatten()->first() ?? "Something isn't right.",
                $e->errors(),
            ],
            $e instanceof AuthenticationException => [401, 'unauthorized', 'Your session has ended. Please sign in again.', []],
            $e instanceof AuthorizationException => [403, 'forbidden', "This page isn't for you.", []],
            $e instanceof ModelNotFoundException, $e instanceof NotFoundHttpException => [404, 'not_found', "We couldn't find that.", []],
            $e instanceof HttpExceptionInterface => [
                $e->getStatusCode(),
                match ($e->getStatusCode()) {
                    403 => 'forbidden',
                    429 => 'throttled',
                    default => 'error',
                },
                $e->getStatusCode() === 429
                    ? 'Too many requests. Please slow down and try again.'
                    : ($e->getMessage() ?: 'Something went wrong.'),
                [],
            ],
            default => [
                500,
                'server_error',
                config('app.debug') ? $e->getMessage() : 'Something went wrong on our side. Please try again.',
                [],
            ],
        };

        return response()->json(
            ['code' => $code, 'message' => $message, 'errors' => (object) $errors],
            $status,
            $e instanceof HttpExceptionInterface ? $e->getHeaders() : [],
        );
    }
}

<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A request the API understood but refuses, with the machine code the frontend switches on
 * (see ApiErrorCode in frontend/lib/api.ts).
 */
class ApiException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status,
        public readonly array $errors = [],
    ) {
        parent::__construct($message);
    }

    /** Legal request, wrong state: already published, already handed in. */
    public static function conflict(string $message): self
    {
        return new self('conflict', $message, 409);
    }

    /** The attempt is past its deadline. */
    public static function expired(string $message = "Time's up. Your exam was submitted."): self
    {
        return new self('expired', $message, 410);
    }

    public static function forbidden(string $message = "This page isn't for you."): self
    {
        return new self('forbidden', $message, 403);
    }

    public static function notFound(string $message = "We couldn't find that."): self
    {
        return new self('not_found', $message, 404);
    }

    public static function validation(string $message, array $errors = []): self
    {
        return new self('validation', $message, 422, $errors);
    }
}

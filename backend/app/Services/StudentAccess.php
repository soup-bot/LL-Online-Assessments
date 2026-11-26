<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Models\User;

/**
 * What a student is allowed to reach. Scoping happens in the query, so a record that belongs to
 * someone else is a 404, not a 403: the API never confirms that it exists.
 */
class StudentAccess
{
    /** A session for one of the student's classes whose exam is published. */
    public function session(User $student, int $sessionId): ExamSession
    {
        return ExamSession::with(['exam.owner', 'schoolClass'])
            ->whereKey($sessionId)
            ->whereHas('schoolClass.students', fn ($q) => $q->where('users.id', $student->id))
            ->whereHas('exam', fn ($q) => $q->where('status', 'published'))
            ->first() ?? throw ApiException::notFound("We couldn't find that exam.");
    }

    /** One of the student's own attempts. */
    public function attempt(User $student, int $attemptId): Attempt
    {
        return Attempt::with(['session.exam.owner', 'session.schoolClass'])
            ->whereKey($attemptId)
            ->where('student_id', $student->id)
            ->first() ?? throw ApiException::notFound("We couldn't find that exam.");
    }
}

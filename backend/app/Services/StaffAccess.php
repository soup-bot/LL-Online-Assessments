<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attempt;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\User;

/**
 * What a teacher or admin may reach. A teacher sees only their own exams, classes and
 * submissions (anything else is a 404); an admin can look at everything but change nothing here.
 */
class StaffAccess
{
    public function exam(User $user, int $id, bool $write = false): Exam
    {
        $exam = Exam::find($id);
        if (! $exam || ($user->isTutor() && $exam->owner_id !== $user->id)) {
            throw ApiException::notFound("We couldn't find that exam.");
        }
        if ($write && ! $user->isTutor()) {
            throw ApiException::forbidden('Only a teacher can change exams.');
        }

        return $exam;
    }

    /** An exam the teacher owns that is still a draft: the only kind whose questions and settings can change. */
    public function draft(User $user, int $id): Exam
    {
        $exam = $this->exam($user, $id, true);
        if (! $exam->isDraft()) {
            throw ApiException::conflict('This exam is published, so its questions and settings are locked.');
        }

        return $exam;
    }

    public function session(User $user, int $id, bool $write = false): ExamSession
    {
        $session = ExamSession::with(['exam', 'schoolClass'])->find($id) ?? throw ApiException::notFound("We couldn't find that class.");
        $this->exam($user, $session->exam_id, $write);

        return $session;
    }

    public function attempt(User $user, int $id): Attempt
    {
        $attempt = Attempt::with(['session.exam', 'session.schoolClass', 'student'])->find($id)
            ?? throw ApiException::notFound("We couldn't find that submission.");
        $this->exam($user, $attempt->session->exam_id);

        return $attempt;
    }
}

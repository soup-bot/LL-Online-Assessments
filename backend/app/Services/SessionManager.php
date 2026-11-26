<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\SessionStatus;
use App\Enums\SubmitReason;
use App\Exceptions\ApiException;
use App\Models\Attempt;
use App\Models\AuditLog;
use App\Models\ExamSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Opening, closing and releasing an exam for one class. */
class SessionManager
{
    public function __construct(private AttemptService $attempts) {}

    public function open(ExamSession $session, User $actor): void
    {
        if ($session->exam->status !== ExamStatus::Published) {
            throw ApiException::conflict('Publish the exam before opening it.');
        }
        if ($session->status !== SessionStatus::NotOpen) {
            throw ApiException::conflict('This class has already been opened.');
        }

        $session->update(['status' => SessionStatus::Open, 'opened_at' => now()]);
        AuditLog::record($actor, 'session.open', $session);
    }

    /**
     * Stops new starts and hands in everyone still sitting, with what they have saved.
     *
     * @return int how many students were handed in by this
     */
    public function close(ExamSession $session, User $actor): int
    {
        if ($session->status !== SessionStatus::Open) {
            throw ApiException::conflict("This class isn't open.");
        }

        $handedIn = DB::transaction(function () use ($session) {
            $count = 0;
            foreach (Attempt::where('exam_session_id', $session->id)->where('status', AttemptStatus::InProgress->value)->get() as $attempt) {
                $this->attempts->expireIfDue($attempt);
                if ($attempt->isInProgress()) {
                    $this->attempts->finalize($attempt, SubmitReason::Closed);
                    $count++;
                }
            }
            $session->update(['status' => SessionStatus::Closed, 'closed_at' => now()]);

            return $count;
        });

        AuditLog::record($actor, 'session.close', $session, ['handedIn' => $handedIn]);

        return $handedIn;
    }

    /** Students can see their marks only after this: the session must be closed and everything marked. */
    public function release(ExamSession $session, User $actor): void
    {
        $this->attempts->expireOverdue([$session->id]);

        if ($session->status !== SessionStatus::Closed) {
            throw ApiException::conflict('Close the exam for this class first.');
        }
        if ($session->results_released_at) {
            throw ApiException::conflict('Results are already released.');
        }

        $waiting = Attempt::where('exam_session_id', $session->id)->where('status', '!=', AttemptStatus::Marked->value)->count();
        if ($waiting > 0) {
            throw ApiException::conflict($waiting === 1 ? '1 submission still needs marking.' : "{$waiting} submissions still need marking.");
        }

        $session->update(['results_released_at' => now()]);
        AuditLog::record($actor, 'session.release', $session);
    }
}

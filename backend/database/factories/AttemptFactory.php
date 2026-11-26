<?php

namespace Database\Factories;

use App\Enums\AttemptStatus;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Attempt>
 */
class AttemptFactory extends Factory
{
    public function definition(): array
    {
        $started = now();

        return [
            'exam_session_id' => ExamSession::factory()->open(),
            'student_id' => User::factory(),
            'started_at' => $started,
            'deadline_at' => $started->copy()->addMinutes(30),
            'status' => AttemptStatus::InProgress,
        ];
    }
}

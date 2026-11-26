<?php

namespace Database\Factories;

use App\Enums\SessionStatus;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\SchoolClass;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ExamSession>
 */
class ExamSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'exam_id' => Exam::factory()->published(),
            'school_class_id' => SchoolClass::factory(),
            'status' => SessionStatus::NotOpen,
        ];
    }

    public function open(): static
    {
        return $this->state(fn () => ['status' => SessionStatus::Open, 'opened_at' => now()]);
    }
}

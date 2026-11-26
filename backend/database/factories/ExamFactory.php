<?php

namespace Database\Factories;

use App\Enums\ExamStatus;
use App\Models\Exam;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Exam>
 */
class ExamFactory extends Factory
{
    public function definition(): array
    {
        return [
            'owner_id' => User::factory()->tutor(),
            'title' => 'Unit 3 Test: Demand and Supply',
            'time_limit_minutes' => 30,
            'rules' => 'Calculators are not allowed.',
            'status' => ExamStatus::Draft,
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => ['status' => ExamStatus::Published, 'published_at' => now()]);
    }
}

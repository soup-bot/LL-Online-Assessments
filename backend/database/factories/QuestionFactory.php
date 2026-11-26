<?php

namespace Database\Factories;

use App\Enums\QuestionKind;
use App\Models\Exam;
use App\Models\Question;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Question>
 */
class QuestionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'exam_id' => Exam::factory(),
            'position' => 1,
            'kind' => QuestionKind::Mcq,
            'prompt' => 'Which of these is a factor of production?',
            'points' => 1,
            'options' => [
                ['key' => 'A', 'text' => 'Labour'],
                ['key' => 'B', 'text' => 'Inflation'],
                ['key' => 'C', 'text' => 'A tariff'],
                ['key' => 'D', 'text' => 'Profit'],
            ],
            'answer_key' => ['correct' => 'A'],
            'approved' => false,
        ];
    }

    public function written(int $points = 4): static
    {
        return $this->state(fn () => [
            'kind' => QuestionKind::Written,
            'prompt' => 'Explain one benefit of specialisation.',
            'points' => $points,
            'options' => null,
            'answer_key' => ['markingPoints' => ['States a benefit', 'Explains it']],
        ]);
    }

    public function approved(): static
    {
        return $this->state(fn () => ['approved' => true]);
    }
}

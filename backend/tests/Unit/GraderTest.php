<?php

namespace Tests\Unit;

use App\Enums\QuestionKind;
use App\Models\Question;
use App\Services\Grader;
use Tests\TestCase;

class GraderTest extends TestCase
{
    /** @return array<string, array{int, int, string}> */
    public static function boundaries(): array
    {
        return [
            'exactly 80% is an A' => [80, 100, 'A'],
            '79.99% is a B' => [7999, 10000, 'B'],
            'exactly 65% is a B' => [65, 100, 'B'],
            '64.9% is a C' => [649, 1000, 'C'],
            'exactly 50% is a C' => [50, 100, 'C'],
            '49% is a D' => [49, 100, 'D'],
            'exactly 40% is a D' => [40, 100, 'D'],
            '39% is a U' => [39, 100, 'U'],
            'zero is a U' => [0, 16, 'U'],
            'a paper worth nothing is a U' => [0, 0, 'U'],
            'full marks is an A' => [16, 16, 'A'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('boundaries')]
    public function test_grade_boundaries_use_the_exact_ratio(int $score, int $total, string $grade): void
    {
        $this->assertSame($grade, Grader::gradeFor($score, $total));
    }

    public function test_the_percentage_is_rounded_to_one_decimal_for_display(): void
    {
        $this->assertSame(62.5, Grader::percentOf(10, 16));
        $this->assertSame(68.8, Grader::percentOf(11, 16));
        $this->assertSame(0.0, Grader::percentOf(3, 0));
    }

    public function test_text_answers_ignore_capitals_spaces_and_a_trailing_full_stop(): void
    {
        $this->assertSame('excess supply', Grader::normalize('  Excess   SUPPLY. '));
        $this->assertSame('', Grader::normalize('   '));
        $this->assertSame('', Grader::normalize(null));
    }

    public function test_fill_in_the_blank_accepts_any_listed_answer(): void
    {
        $q = new Question(['kind' => QuestionKind::FillBlank, 'points' => 1, 'answer_key' => ['accepted' => ['surplus', 'excess supply']]]);

        $this->assertSame(1, Grader::markObjective($q, 'Excess Supply.'));
        $this->assertSame(0, Grader::markObjective($q, 'shortage'));
        $this->assertSame(0, Grader::markObjective($q, null));
        $this->assertSame(0, Grader::markObjective($q, '   '));
    }

    public function test_true_false_matches_the_stored_answer(): void
    {
        $q = new Question(['kind' => QuestionKind::TrueFalse, 'points' => 1, 'answer_key' => ['correct' => false]]);

        $this->assertSame(1, Grader::markObjective($q, 'false'));
        $this->assertSame(0, Grader::markObjective($q, 'true'));
        $this->assertSame(0, Grader::markObjective($q, null));
    }

    public function test_written_questions_are_left_for_the_teacher(): void
    {
        $q = new Question(['kind' => QuestionKind::Written, 'points' => 4, 'answer_key' => ['markingPoints' => ['x']]]);

        $this->assertNull(Grader::markObjective($q, 'A long answer.'));
    }
}

<?php

namespace App\Services;

use App\Enums\QuestionKind;
use App\Models\Question;

/** Marks the objective questions and turns marks into a percentage and a grade. */
class Grader
{
    /** Lower-case, collapse spaces and drop trailing punctuation so "Surplus. " matches "surplus". */
    public static function normalize(?string $value): string
    {
        $value = mb_strtolower(preg_replace('/\s+/u', ' ', (string) $value));

        return trim(rtrim(trim($value), '.!?,;:'));
    }

    /** True when the response has any real content. */
    public static function hasAnswer(QuestionKind $kind, ?string $response): bool
    {
        if ($response === null) {
            return false;
        }

        return in_array($kind, [QuestionKind::FillBlank, QuestionKind::Written], true)
            ? self::normalize($response) !== ''
            : $response !== '';
    }

    /** Marks an objective question. Returns null for a written one, which waits for the teacher. */
    public static function markObjective(Question $question, ?string $response): ?int
    {
        $key = $question->answer_key ?? [];

        return match ($question->kind) {
            QuestionKind::Mcq => $response !== null && $response === ($key['correct'] ?? null) ? $question->points : 0,
            QuestionKind::TrueFalse => isset($key['correct']) && $response === ($key['correct'] ? 'true' : 'false') ? $question->points : 0,
            QuestionKind::FillBlank => self::normalize($response) !== ''
                && collect($key['accepted'] ?? [])->contains(fn ($a) => self::normalize($a) === self::normalize($response))
                    ? $question->points
                    : 0,
            QuestionKind::Written => null,
        };
    }

    /** Percentage to one decimal place, for display (62.5, 68.8). */
    public static function percentOf(int|float $score, int|float $total): float
    {
        return $total > 0 ? round($score / $total * 100, 1) : 0.0;
    }

    /** Grade from the exact ratio, never the rounded display percentage. */
    public static function gradeFor(int|float $score, int|float $total): string
    {
        $pct = $total > 0 ? $score / $total * 100 : 0;

        foreach (config('exam.grade_bands') as $grade => $min) {
            if ($pct >= $min) {
                return $grade;
            }
        }

        return array_key_last(config('exam.grade_bands'));
    }
}

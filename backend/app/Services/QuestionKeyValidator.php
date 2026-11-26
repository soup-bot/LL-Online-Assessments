<?php

namespace App\Services;

use App\Enums\QuestionKind;
use App\Models\Question;

/** Says what is missing from a question's answer key. A question can only be approved when nothing is. */
class QuestionKeyValidator
{
    /** What is missing, or null when the question is complete. */
    public static function issue(Question $q): ?string
    {
        if (trim((string) $q->prompt) === '') {
            return 'Write the question first.';
        }
        if ((int) $q->points < 1) {
            return 'Give the question at least 1 mark.';
        }

        $key = $q->answer_key ?? [];

        switch ($q->kind) {
            case QuestionKind::Mcq:
                $options = $q->options ?? [];
                if (count($options) < 4 || collect($options)->contains(fn ($o) => trim((string) ($o['text'] ?? '')) === '')) {
                    return 'Fill in all four options.';
                }

                return ($key['correct'] ?? '') !== '' ? null : 'Choose the correct option.';

            case QuestionKind::TrueFalse:
                return array_key_exists('correct', $key) && $key['correct'] !== null ? null : 'Choose whether the statement is true or false.';

            case QuestionKind::FillBlank:
                $blanks = preg_match_all('/_{3,}/', (string) $q->prompt);
                if ($blanks === 0) {
                    return 'Put ____ in the sentence where the blank goes.';
                }
                if ($blanks > 1) {
                    return 'Use one blank per question. Split it into separate questions if you need more.';
                }

                return collect($key['accepted'] ?? [])->contains(fn ($a) => Grader::normalize($a) !== '') ? null : 'Add at least one accepted answer.';

            case QuestionKind::Written:
                return collect($key['markingPoints'] ?? [])->contains(fn ($p) => trim((string) $p) !== '') ? null : 'Add at least one marking point.';
        }

        return null;
    }
}

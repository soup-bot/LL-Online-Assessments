<?php

namespace App\Enums;

enum QuestionKind: string
{
    case Mcq = 'mcq';
    case TrueFalse = 'true_false';
    case FillBlank = 'fill_blank';
    case Written = 'written';

    /** Marked by the server the moment the attempt is handed in. */
    public function isObjective(): bool
    {
        return $this !== self::Written;
    }
}

<?php

namespace App\Enums;

/** The order students see an exam's questions in. */
enum QuestionOrder: string
{
    /** Everyone sees the questions in the order the teacher put them. */
    case InOrder = 'in_order';

    /** Each student gets their own order, fixed for their attempt. */
    case Random = 'random';
}

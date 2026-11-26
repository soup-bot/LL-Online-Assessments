<?php

namespace App\Enums;

enum SubmitReason: string
{
    case Manual = 'manual';
    case Timeout = 'timeout';
    case Violations = 'violations';
    case Closed = 'closed';
}

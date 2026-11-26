<?php

namespace App\Enums;

enum SessionStatus: string
{
    case NotOpen = 'not_open';
    case Open = 'open';
    case Closed = 'closed';
}

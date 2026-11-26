<?php

namespace App\Console\Commands;

use App\Services\AttemptService;
use Illuminate\Console\Command;

class ExpireAttempts extends Command
{
    protected $signature = 'attempts:expire';

    protected $description = 'Hand in every exam attempt that has run out of time';

    public function handle(AttemptService $attempts): int
    {
        $count = $attempts->expireOverdue();
        $this->info("Handed in {$count} overdue ".($count === 1 ? 'attempt' : 'attempts').'.');

        return self::SUCCESS;
    }
}

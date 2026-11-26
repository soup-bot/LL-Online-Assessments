<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Students who never come back still get handed in, so the teacher's lists are right.
// Needs the scheduler running: `php artisan schedule:work` locally, or a cron entry on a server.
Schedule::command('attempts:expire')->everyMinute()->withoutOverlapping();

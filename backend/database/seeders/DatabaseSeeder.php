<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * `php artisan db:seed` loads exactly the scenario in the brief. For more:
     *   --class=DemoSeeder    the brief plus the story the frontend mock tells (open exam, released result)
     *   --class=StressSeeder  the demo plus a large school for testing lists and paging
     */
    public function run(): void
    {
        $this->call(BriefSeeder::class);
    }
}

<?php

namespace Database\Factories;

use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SchoolClass>
 */
class SchoolClassFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'IGCSE Economics, Batch '.fake()->unique()->randomLetter(),
            'subject_code' => '0455',
            'grade' => 10,
            'tutor_id' => User::factory()->tutor(),
        ];
    }
}

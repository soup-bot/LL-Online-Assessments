<?php

namespace Tests\Feature;

use App\Models\Attempt;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\User;
use Database\Seeders\BriefSeeder;
use Database\Seeders\DemoSeeder;
use Database\Seeders\StressSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeedersTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_brief_seeder_matches_the_brief(): void
    {
        $this->seed(BriefSeeder::class);

        $this->assertSame(7, User::count());
        $exam = Exam::firstOrFail();
        $this->assertSame('draft', $exam->status->value);
        $this->assertSame(8, $exam->questions()->count());
        $this->assertSame(0, Question::where('approved', true)->count());
        $this->assertSame(2, ExamSession::where('status', 'not_open')->count());
        $this->assertSame(0, Attempt::count());
    }

    public function test_seeded_accounts_sign_in_with_the_documented_password(): void
    {
        $this->seed(BriefSeeder::class);

        foreach (['aishath@ll.test', 'ali@ll.test', 'hawwa@ll.test', 'ahmed@ll.test', 'admin@ll.test'] as $email) {
            $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'password'])->assertOk();
        }
    }

    public function test_batch_b_is_a_separate_class(): void
    {
        $this->seed(BriefSeeder::class);

        $ahmed = User::where('email', 'ahmed@ll.test')->firstOrFail();
        $this->assertSame(['IGCSE Economics, Batch B'], $ahmed->classes->pluck('name')->all());
    }

    public function test_the_demo_seeder_tells_the_story_the_frontend_mock_tells(): void
    {
        $this->seed(DemoSeeder::class);

        $unit3 = Exam::where('title', 'like', 'Unit 3%')->firstOrFail();
        $this->assertSame('published', $unit3->status->value);
        $this->assertSame(1, ExamSession::where('exam_id', $unit3->id)->where('status', 'open')->count());

        $hawwa = User::where('email', 'hawwa@ll.test')->firstOrFail();
        $result = $hawwa->attempts()->firstOrFail();
        $this->assertSame('marked', $result->status->value);
        $this->assertTrue($result->session->isReleased());

        $mariyam = User::where('email', 'mariyam@ll.test')->firstOrFail();
        $this->assertSame('submitted', $mariyam->attempts()->firstOrFail()->status->value);

        $unit4 = Exam::where('title', 'like', 'Unit 4%')->firstOrFail();
        $this->assertSame(3, $unit4->questions()->where('approved', true)->count());
    }

    public function test_the_stress_seeder_builds_a_large_school(): void
    {
        $this->seed(StressSeeder::class);

        $this->assertGreaterThan(280, User::count());
        $this->assertSame(1, \App\Models\SchoolClass::withCount('students')->get()->where('students_count', 100)->count());
        $this->assertGreaterThan(30, Exam::count());
        $this->assertGreaterThan(1000, Attempt::count());
        $this->assertGreaterThan(300, Attempt::where('status', 'submitted')->count());
        $this->assertGreaterThan(30, Attempt::where('status', 'in_progress')->count());
    }
}

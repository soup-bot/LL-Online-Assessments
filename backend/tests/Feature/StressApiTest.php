<?php

namespace Tests\Feature;

use App\Models\ExamSession;
use App\Models\SchoolClass;
use App\Models\User;
use Database\Seeders\StressSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The teacher screens against the large school (35+ exams, a 100-student class, ~1,700 attempts).
 * The point is not speed on this machine but that the number of queries stays small and does not
 * grow with the number of exams or students: one query per exam would show up here at once.
 */
class StressApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StressSeeder::class);
        Sanctum::actingAs(User::where('email', 'aishath@ll.test')->firstOrFail());
    }

    /** Run a request and return how many queries it took. */
    private function queries(string $url): int
    {
        $count = 0;
        DB::listen(function () use (&$count) {
            $count++;
        });
        $this->getJson($url)->assertOk();

        return $count;
    }

    public function test_the_exam_list_uses_a_fixed_number_of_queries(): void
    {
        $this->assertLessThan(25, $this->queries('/api/v1/tutor/exams?per_page=100'));
    }

    public function test_the_exam_list_reports_the_whole_school(): void
    {
        $response = $this->getJson('/api/v1/tutor/exams?per_page=100')->assertOk();

        $this->assertGreaterThan(30, $response->json('meta.total'));
        $this->assertGreaterThan(300, $response->json('stats.toMark'));
        $this->getJson('/api/v1/tutor/exams?per_page=10&page=2')->assertJsonCount(10, 'exams');
    }

    public function test_the_live_list_for_a_hundred_students_uses_a_fixed_number_of_queries(): void
    {
        $class = SchoolClass::withCount('students')->get()->firstWhere('students_count', 100);
        $big = ExamSession::where('school_class_id', $class->id)->whereHas('attempts')->firstOrFail();

        $this->assertLessThan(25, $this->queries("/api/v1/tutor/sessions/{$big->id}/live?per_page=100"));

        $response = $this->getJson("/api/v1/tutor/sessions/{$big->id}/live?per_page=25&page=2")->assertOk();
        $response->assertJsonCount(25, 'rows')->assertJsonPath('meta.total', 100)->assertJsonPath('counts.all', 100);
    }

    public function test_the_to_mark_list_pages(): void
    {
        $this->assertLessThan(15, $this->queries('/api/v1/tutor/to-mark?per_page=50'));
        $this->getJson('/api/v1/tutor/to-mark?per_page=50&page=2')->assertOk()->assertJsonCount(50, 'items');
    }

    public function test_the_class_overview_for_a_mock_exam_across_every_batch(): void
    {
        $mock = ExamSession::whereHas('exam', fn ($q) => $q->where('title', 'like', 'Whole-school%'))->firstOrFail();

        $this->assertLessThan(40, $this->queries("/api/v1/tutor/exams/{$mock->exam_id}/sessions"));
        $this->getJson("/api/v1/tutor/exams/{$mock->exam_id}/sessions")->assertJsonCount(11, 'classes');
    }
}

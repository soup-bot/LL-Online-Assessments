<?php

namespace Tests\Feature;

use App\Enums\SessionStatus;
use App\Models\Answer;
use App\Models\Exam;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The student path against the demo school: Unit 3 is open for Batch A (Hawwa, Ibrahim, Mariyam),
 * not for Batch B (Ahmed). Hawwa has a released Unit 2 result; Mariyam's Unit 3 is waiting to be marked.
 */
class StudentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DemoSeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function as(string $email): static
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());

        return $this;
    }

    private function unit3Session(): ExamSession
    {
        return ExamSession::whereHas('exam', fn ($q) => $q->where('title', 'like', 'Unit 3%'))
            ->where('status', 'open')->firstOrFail();
    }

    /** Ibrahim starts Unit 3 and gets back his attempt. */
    private function startAsIbrahim(): Attempt
    {
        $id = $this->as('ibrahim@ll.test')->postJson("/api/v1/student/exams/{$this->unit3Session()->id}/start")->assertOk()->json('attemptId');

        return Attempt::findOrFail($id);
    }

    private function question(int $position): Question
    {
        return Question::where('exam_id', $this->unit3Session()->exam_id)->where('position', $position)->firstOrFail();
    }

    private function save(Attempt $attempt, int $position, array $body)
    {
        return $this->putJson("/api/v1/student/attempts/{$attempt->id}/answers/{$this->question($position)->id}", $body);
    }

    /* ---------------------------------------------------------------- access */

    public function test_only_students_reach_the_student_area(): void
    {
        $this->as('aishath@ll.test')->getJson('/api/v1/student/home')->assertForbidden();
        $this->as('admin@ll.test')->getJson('/api/v1/student/home')->assertForbidden();
    }

    /* ------------------------------------------------------------------ home */

    public function test_home_lists_the_exams_open_for_the_students_class(): void
    {
        $response = $this->as('ibrahim@ll.test')->getJson('/api/v1/student/home')->assertOk();

        $response->assertJsonPath('student.firstName', 'Ibrahim')
            ->assertJsonPath('student.className', 'IGCSE Economics, Batch A')
            ->assertJsonCount(1, 'open')
            ->assertJsonCount(0, 'inProgress')
            ->assertJsonPath('open.0.title', 'Unit 3 Test: Demand and Supply')
            ->assertJsonPath('open.0.teacher', 'Ms Aishath')
            ->assertJsonPath('open.0.timeLimitMinutes', 30)
            ->assertJsonPath('open.0.questionCount', 8)
            ->assertJsonPath('open.0.totalMarks', 16)
            ->assertJsonPath('open.0.kindCounts', ['mcq' => 2, 'true_false' => 2, 'fill_blank' => 2, 'written' => 2]);
    }

    public function test_a_student_in_two_subjects_sees_both_classes_and_both_exams(): void
    {
        $aishath = User::where('email', 'aishath@ll.test')->firstOrFail();
        $business = SchoolClass::factory()->create(['name' => 'IGCSE Business Studies, Batch C', 'subject_code' => '0450', 'tutor_id' => $aishath->id]);
        $business->addStudent(User::where('email', 'ibrahim@ll.test')->firstOrFail());

        $exam = Exam::factory()->published()->create(['owner_id' => $aishath->id, 'title' => 'Unit 1 Quiz: Understanding Business']);
        Question::factory()->approved()->create(['exam_id' => $exam->id, 'position' => 1]);
        ExamSession::factory()->open()->create(['exam_id' => $exam->id, 'school_class_id' => $business->id]);

        $response = $this->as('ibrahim@ll.test')->getJson('/api/v1/student/home')->assertOk();

        $response->assertJsonCount(2, 'open')
            ->assertJsonCount(2, 'student.classes')
            ->assertJsonPath('student.classes.0.subjectShort', 'Business Studies')
            ->assertJsonPath('student.classes.0.batch', 'Batch C')
            ->assertJsonPath('student.classes.1.subjectCode', '0455')
            ->assertJsonPath('student.className', 'Business Studies (Batch C) · Economics (Batch A)');
        $this->assertEqualsCanonicalizing(
            ['Unit 1 Quiz: Understanding Business', 'Unit 3 Test: Demand and Supply'],
            collect($response->json('open'))->pluck('title')->all(),
        );
    }

    public function test_the_profile_lists_the_class_with_its_parts(): void
    {
        $this->as('ibrahim@ll.test')->getJson('/api/v1/student/home')
            ->assertJsonCount(1, 'student.classes')
            ->assertJsonPath('student.classes.0.name', 'IGCSE Economics, Batch A')
            ->assertJsonPath('student.classes.0.subjectName', 'IGCSE Economics')
            ->assertJsonPath('student.classes.0.subjectShort', 'Economics')
            ->assertJsonPath('student.classes.0.batch', 'Batch A');
    }

    public function test_a_student_in_another_batch_sees_nothing_of_it(): void
    {
        $this->as('ahmed@ll.test')->getJson('/api/v1/student/home')->assertOk()->assertJsonCount(0, 'open');
    }

    public function test_an_exam_in_progress_moves_to_the_in_progress_list(): void
    {
        $this->startAsIbrahim();

        $this->as('ibrahim@ll.test')->getJson('/api/v1/student/home')
            ->assertJsonCount(0, 'open')
            ->assertJsonCount(1, 'inProgress')
            ->assertJsonStructure(['inProgress' => [['attemptId', 'deadlineAt']]]);
    }

    public function test_an_unseen_released_result_shows_on_home_until_it_is_marked_seen(): void
    {
        $result = User::where('email', 'hawwa@ll.test')->firstOrFail()->attempts()->firstOrFail();
        $result->update(['result_viewed_at' => null]);

        $this->as('hawwa@ll.test')->getJson('/api/v1/student/home')
            ->assertJsonCount(1, 'newResults')
            ->assertJsonPath('newResults.0.grade', 'B')
            ->assertJsonPath('newResults.0.isNew', true);

        $this->postJson("/api/v1/student/results/{$result->id}/viewed")->assertOk();
        $this->getJson('/api/v1/student/home')->assertJsonCount(0, 'newResults');
    }

    /* ----------------------------------------------------------------- cover */

    public function test_the_cover_shows_the_rules_and_the_time(): void
    {
        $this->as('ibrahim@ll.test')->getJson("/api/v1/student/exams/{$this->unit3Session()->id}/cover")
            ->assertOk()
            ->assertJsonPath('timeLimitMinutes', 30)
            ->assertJsonPath('freeNavigation', true)
            ->assertJsonPath('examRules', 'Calculators are not allowed. Answer in full sentences for questions 7 and 8.')
            ->assertJsonCount(3, 'globalRules')
            ->assertJsonPath('resumeAttemptId', null);
    }

    public function test_another_batch_cannot_open_the_cover(): void
    {
        $this->as('ahmed@ll.test')->getJson("/api/v1/student/exams/{$this->unit3Session()->id}/cover")
            ->assertNotFound()->assertJson(['code' => 'not_found']);
    }

    public function test_the_cover_of_a_handed_in_exam_is_a_conflict(): void
    {
        $this->as('mariyam@ll.test')->getJson("/api/v1/student/exams/{$this->unit3Session()->id}/cover")
            ->assertStatus(409)->assertJson(['code' => 'conflict']);
    }

    /* ----------------------------------------------------------------- start */

    public function test_starting_fixes_the_deadline_from_the_servers_clock(): void
    {
        Carbon::setTestNow('2026-03-04 08:00:00');
        $attempt = $this->startAsIbrahim();

        $this->assertSame('2026-03-04 08:30:00', $attempt->deadline_at->format('Y-m-d H:i:s'));
        $this->assertSame('in_progress', $attempt->status->value);
    }

    public function test_starting_twice_returns_the_same_attempt(): void
    {
        $first = $this->startAsIbrahim();
        Carbon::setTestNow(now()->addMinutes(5));
        $second = $this->startAsIbrahim();

        $this->assertSame($first->id, $second->id);
        $this->assertTrue($first->deadline_at->equalTo($second->deadline_at), 'the deadline must not move');
        $this->assertSame(1, Attempt::where('student_id', $first->student_id)->where('exam_session_id', $first->exam_session_id)->count());
    }

    public function test_an_exam_that_is_not_open_cannot_be_started(): void
    {
        $session = $this->unit3Session();
        $session->update(['status' => SessionStatus::Closed]);

        $this->as('ibrahim@ll.test')->postJson("/api/v1/student/exams/{$session->id}/start")->assertNotFound();
    }

    public function test_another_batch_cannot_start_it(): void
    {
        $this->as('ahmed@ll.test')->postJson("/api/v1/student/exams/{$this->unit3Session()->id}/start")->assertNotFound();
    }

    /* --------------------------------------------------------------- attempt */

    public function test_the_attempt_never_contains_the_answer_key(): void
    {
        $attempt = $this->startAsIbrahim();

        $response = $this->getJson("/api/v1/student/attempts/{$attempt->id}")->assertOk();

        $response->assertJsonCount(8, 'questions')->assertJsonPath('maxViolations', 3);
        foreach ($response->json('questions') as $question) {
            $this->assertEqualsCanonicalizing(['id', 'position', 'kind', 'prompt', 'points', 'options'], array_keys($question));
        }
        $body = $response->getContent();
        foreach (['answer_key', 'markingPoints', 'accepted', '"correct"'] as $secret) {
            $this->assertStringNotContainsString($secret, $body);
        }
    }

    public function test_students_cannot_read_each_others_attempts(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->as('hawwa@ll.test')->getJson("/api/v1/student/attempts/{$attempt->id}")->assertNotFound();
        $this->putJson("/api/v1/student/attempts/{$attempt->id}/answers/{$this->question(1)->id}", ['response' => 'A'])->assertNotFound();
        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")->assertNotFound();
    }

    public function test_the_clock_endpoint_reports_time_deadline_and_status(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->getJson("/api/v1/student/attempts/{$attempt->id}/clock")
            ->assertOk()
            ->assertJsonStructure(['serverNow', 'deadlineAt', 'status'])
            ->assertJsonPath('status', 'in_progress');
    }

    /* ---------------------------------------------------------------- saving */

    public function test_saving_an_answer_stores_it_and_returns_the_clock(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->save($attempt, 1, ['response' => 'B'])->assertOk()->assertJsonStructure(['serverNow', 'deadlineAt']);

        $this->assertSame('B', Answer::where('attempt_id', $attempt->id)->where('question_id', $this->question(1)->id)->value('response'));
        $this->getJson("/api/v1/student/attempts/{$attempt->id}")->assertJsonPath("answers.{$this->question(1)->id}.response", 'B');
    }

    public function test_flagging_alone_keeps_the_saved_response(): void
    {
        $attempt = $this->startAsIbrahim();
        $this->save($attempt, 5, ['response' => 'surplus'])->assertOk();

        $this->save($attempt, 5, ['flagged' => true])->assertOk();

        $answer = Answer::where('attempt_id', $attempt->id)->where('question_id', $this->question(5)->id)->firstOrFail();
        $this->assertSame('surplus', $answer->response);
        $this->assertTrue($answer->flagged);
    }

    public function test_an_answer_must_be_valid_for_the_kind_of_question(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->save($attempt, 1, ['response' => 'Z'])->assertStatus(422)->assertJson(['code' => 'validation']);
        $this->save($attempt, 3, ['response' => 'maybe'])->assertStatus(422);
        $this->save($attempt, 3, ['response' => 'true'])->assertOk();
    }

    public function test_a_question_from_another_exam_is_not_found(): void
    {
        $attempt = $this->startAsIbrahim();
        $foreign = Question::whereHas('exam', fn ($q) => $q->where('title', 'like', 'Unit 2%'))->firstOrFail();

        $this->putJson("/api/v1/student/attempts/{$attempt->id}/answers/{$foreign->id}", ['response' => 'A'])->assertNotFound();
    }

    public function test_a_late_retry_cannot_overwrite_newer_typing(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->save($attempt, 5, ['response' => 'equilibrium', 'clientSavedAt' => '2026-03-04T08:00:05.000Z'])->assertOk();
        $this->save($attempt, 5, ['response' => 'surplus', 'clientSavedAt' => '2026-03-04T08:00:01.000Z'])->assertOk();

        $this->assertSame('equilibrium', Answer::where('attempt_id', $attempt->id)->where('question_id', $this->question(5)->id)->value('response'));
    }

    public function test_saving_after_the_deadline_hands_the_exam_in_and_says_so(): void
    {
        Carbon::setTestNow('2026-03-04 08:00:00');
        $attempt = $this->startAsIbrahim();
        $this->save($attempt, 1, ['response' => 'A'])->assertOk();

        Carbon::setTestNow('2026-03-04 08:30:06'); // 5 seconds of grace have passed
        $this->save($attempt, 2, ['response' => 'B'])->assertStatus(410)->assertJson(['code' => 'expired']);

        $attempt->refresh();
        $this->assertSame('timeout', $attempt->submit_reason->value);
        $this->assertNotSame('in_progress', $attempt->status->value);
        $this->assertNull(Answer::where('attempt_id', $attempt->id)->where('question_id', $this->question(2)->id)->value('response'));
        $this->assertSame(1, (int) Answer::where('attempt_id', $attempt->id)->where('question_id', $this->question(1)->id)->value('awarded_marks'));
    }

    public function test_a_save_inside_the_grace_period_is_still_accepted(): void
    {
        Carbon::setTestNow('2026-03-04 08:00:00');
        $attempt = $this->startAsIbrahim();

        Carbon::setTestNow('2026-03-04 08:30:03');
        $this->save($attempt, 1, ['response' => 'A'])->assertOk();
    }

    /* ------------------------------------------------------------ violations */

    public function test_the_third_violation_hands_the_exam_in(): void
    {
        $attempt = $this->startAsIbrahim();
        $url = "/api/v1/student/attempts/{$attempt->id}/violations";

        $this->postJson($url)->assertOk()->assertJson(['count' => 1, 'max' => 3, 'autoSubmitted' => false]);
        $this->postJson($url, ['kind' => 'blur'])->assertOk()->assertJson(['count' => 2, 'autoSubmitted' => false]);
        $this->postJson($url)->assertOk()->assertJson(['count' => 3, 'autoSubmitted' => true]);

        $attempt->refresh();
        $this->assertSame('violations', $attempt->submit_reason->value);
        $this->assertSame(3, $attempt->violations()->count());
        $this->postJson($url)->assertStatus(409);
    }

    public function test_an_unknown_violation_kind_is_rejected(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->postJson("/api/v1/student/attempts/{$attempt->id}/violations", ['kind' => 'sneezed'])->assertStatus(422);
    }

    /* ---------------------------------------------------------------- submit */

    public function test_submitting_marks_the_objective_questions_and_waits_for_written_answers(): void
    {
        $attempt = $this->startAsIbrahim();
        $this->save($attempt, 1, ['response' => 'A'])->assertOk();      // right
        $this->save($attempt, 2, ['response' => 'C'])->assertOk();      // wrong
        $this->save($attempt, 3, ['response' => 'false'])->assertOk();  // right
        $this->save($attempt, 5, ['response' => '  Surplus. '])->assertOk(); // right: capitals, spaces and the full stop don't matter
        $this->save($attempt, 7, ['response' => 'Petrol is a necessity.'])->assertOk();

        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")
            ->assertOk()
            ->assertJsonPath('status', 'submitted')
            ->assertJsonPath('awaitingMarking', true)
            ->assertJsonPath('reason', 'manual')
            ->assertJsonPath('answered', 5)
            ->assertJsonPath('questionCount', 8)
            ->assertJsonPath('resultsReleased', false);

        $marks = fn (int $position) => Answer::where('attempt_id', $attempt->id)->where('question_id', $this->question($position)->id)->value('awarded_marks');
        $this->assertSame([1, 0, 1, 0, 1, 0], [$marks(1), $marks(2), $marks(3), $marks(4), $marks(5), $marks(6)]);
        $this->assertNull($marks(7), 'a written answer waits for the teacher');
        $this->assertSame(0, (int) $marks(8), 'a blank written answer has nothing to mark');
        $this->assertSame(3, $attempt->fresh()->total_score);
    }

    public function test_an_exam_with_nothing_for_the_teacher_is_marked_straight_away(): void
    {
        $attempt = $this->startAsIbrahim();
        $this->save($attempt, 1, ['response' => 'A'])->assertOk();

        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")
            ->assertOk()
            ->assertJsonPath('status', 'marked')
            ->assertJsonPath('awaitingMarking', false);
    }

    public function test_submitting_twice_changes_nothing(): void
    {
        $attempt = $this->startAsIbrahim();
        $this->save($attempt, 7, ['response' => 'Because.'])->assertOk();
        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")->assertOk();
        $first = $attempt->fresh();

        Carbon::setTestNow(now()->addMinutes(10));
        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit", ['reason' => 'timeout'])->assertOk();

        $second = $attempt->fresh();
        $this->assertSame('manual', $second->submit_reason->value);
        $this->assertTrue($first->submitted_at->equalTo($second->submitted_at));
    }

    public function test_submitted_summary_is_not_available_while_sitting(): void
    {
        $attempt = $this->startAsIbrahim();

        $this->getJson("/api/v1/student/attempts/{$attempt->id}/submitted")->assertStatus(409);
        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")->assertOk();
        $this->getJson("/api/v1/student/attempts/{$attempt->id}/submitted")->assertOk()->assertJsonPath('attemptId', $attempt->id);
    }

    public function test_a_late_manual_submit_is_recorded_as_a_timeout(): void
    {
        Carbon::setTestNow('2026-03-04 08:00:00');
        $attempt = $this->startAsIbrahim();

        Carbon::setTestNow('2026-03-04 08:30:02'); // inside the grace period, but past the deadline
        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")->assertOk()->assertJsonPath('reason', 'timeout');
    }

    /* --------------------------------------------------------------- results */

    public function test_results_group_by_subject_with_the_grade_and_the_latest(): void
    {
        $this->as('hawwa@ll.test')->getJson('/api/v1/student/results')
            ->assertOk()
            ->assertJsonPath('releasedCount', 1)
            ->assertJsonPath('pendingCount', 0)
            ->assertJsonCount(1, 'subjects')
            ->assertJsonPath('subjects.0.subjectShort', 'Economics')
            ->assertJsonPath('subjects.0.items.0.kind', 'released')
            ->assertJsonPath('subjects.0.items.0.score', 6)
            ->assertJsonPath('subjects.0.items.0.total', 8)
            ->assertJsonPath('subjects.0.items.0.percent', 75)
            ->assertJsonPath('subjects.0.items.0.grade', 'B')
            ->assertJsonPath('latest.grade', 'B');
    }

    public function test_an_exam_waiting_for_marking_shows_as_pending(): void
    {
        $this->as('mariyam@ll.test')->getJson('/api/v1/student/results')
            ->assertJsonPath('releasedCount', 0)
            ->assertJsonPath('pendingCount', 1)
            ->assertJsonPath('subjects.0.items.0.kind', 'pending')
            ->assertJsonPath('subjects.0.items.0.stage', 'marking');
    }

    public function test_a_released_result_shows_every_question_with_the_correct_answer(): void
    {
        $attempt = User::where('email', 'hawwa@ll.test')->firstOrFail()->attempts()->firstOrFail();

        $response = $this->as('hawwa@ll.test')->getJson("/api/v1/student/results/{$attempt->id}")->assertOk();

        $response->assertJsonPath('score', 6)
            ->assertJsonPath('grade', 'B')
            ->assertJsonPath('teacher', 'Ms Aishath')
            ->assertJsonPath('teacherInitials', 'AR')
            ->assertJsonCount(5, 'questions')
            ->assertJsonPath('questions.0.yourAnswer', 'A. Firms have plenty of spare capacity')
            ->assertJsonPath('questions.0.correctAnswer', 'A. Firms have plenty of spare capacity')
            ->assertJsonPath('questions.2.yourAnswer', 'False')
            ->assertJsonPath('questions.2.correctAnswer', 'True')
            ->assertJsonPath('questions.2.awarded', 0)
            ->assertJsonPath('questions.4.correctAnswer', null);
        $this->assertStringNotContainsString('markingPoints', $response->getContent());
    }

    public function test_opening_a_result_marks_it_seen(): void
    {
        $attempt = User::where('email', 'hawwa@ll.test')->firstOrFail()->attempts()->firstOrFail();
        $attempt->update(['result_viewed_at' => null]);

        $this->as('hawwa@ll.test')->getJson("/api/v1/student/results/{$attempt->id}")->assertOk();

        $this->assertNotNull($attempt->fresh()->result_viewed_at);
    }

    public function test_results_that_are_not_released_stay_hidden(): void
    {
        $mariyam = User::where('email', 'mariyam@ll.test')->firstOrFail()->attempts()->firstOrFail();

        $this->as('mariyam@ll.test')->getJson("/api/v1/student/results/{$mariyam->id}")->assertNotFound();
    }

    public function test_a_student_cannot_read_someone_elses_result(): void
    {
        $hawwas = User::where('email', 'hawwa@ll.test')->firstOrFail()->attempts()->firstOrFail();

        $this->as('ibrahim@ll.test')->getJson("/api/v1/student/results/{$hawwas->id}")->assertNotFound();
    }

    public function test_a_marked_attempt_in_an_unreleased_session_stays_hidden(): void
    {
        $attempt = $this->startAsIbrahim();
        $this->save($attempt, 1, ['response' => 'A'])->assertOk();
        $this->postJson("/api/v1/student/attempts/{$attempt->id}/submit")->assertOk()->assertJsonPath('status', 'marked');

        $this->getJson("/api/v1/student/attempts/{$attempt->id}/submitted")->assertJsonPath('resultsReleased', false);
        $this->getJson("/api/v1/student/results/{$attempt->id}")->assertNotFound();
        $this->getJson('/api/v1/student/results')->assertJsonPath('subjects.0.items.0.stage', 'release');
    }
}

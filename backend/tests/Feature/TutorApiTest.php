<?php

namespace Tests\Feature;

use App\Models\Attempt;
use App\Models\AuditLog;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The teacher side against the demo school. Aishath owns Unit 3 (open for Batch A, Mariyam's submission
 * waiting), Unit 2 (released) and Unit 4 (a draft with 3 of 5 questions approved). Ali has no exams.
 */
class TutorApiTest extends TestCase
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

    private function exam(string $startsWith): Exam
    {
        return Exam::where('title', 'like', "{$startsWith}%")->firstOrFail();
    }

    private function sessionOf(string $exam, string $batch): ExamSession
    {
        return ExamSession::where('exam_id', $this->exam($exam)->id)
            ->whereHas('schoolClass', fn ($q) => $q->where('name', 'like', "%{$batch}"))->firstOrFail();
    }

    private function mcq(array $over = []): array
    {
        return array_merge([
            'kind' => 'mcq', 'prompt' => 'Which of these is a factor of production?', 'points' => 1,
            'options' => ['Labour', 'Inflation', 'A tariff', 'Profit'], 'correct' => 'A',
        ], $over);
    }

    /* ---------------------------------------------------------------- access */

    public function test_students_cannot_reach_the_teacher_area(): void
    {
        $this->as('hawwa@ll.test')->getJson('/api/v1/tutor/exams')->assertForbidden();
        $this->getJson('/api/v1/tutor/to-mark')->assertForbidden();
    }

    public function test_a_teacher_cannot_see_another_teachers_exam(): void
    {
        $unit3 = $this->exam('Unit 3');
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $attempt = Attempt::firstOrFail();

        $this->as('ali@ll.test')->getJson("/api/v1/tutor/exams/{$unit3->id}")->assertNotFound();
        $this->getJson("/api/v1/tutor/exams/{$unit3->id}/sessions")->assertNotFound();
        $this->getJson("/api/v1/tutor/sessions/{$session->id}/live")->assertNotFound();
        $this->getJson("/api/v1/tutor/attempts/{$attempt->id}")->assertNotFound();
        $this->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertNotFound();
        $this->getJson('/api/v1/tutor/exams')->assertOk()->assertJsonPath('meta.total', 0)->assertJsonCount(0, 'exams');
    }

    public function test_an_admin_can_look_but_not_change(): void
    {
        $unit3 = $this->exam('Unit 3');
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $mariyam = Attempt::whereHas('student', fn ($q) => $q->where('email', 'mariyam@ll.test'))->firstOrFail();

        $this->as('admin@ll.test')->getJson("/api/v1/tutor/exams/{$unit3->id}")->assertOk()->assertJsonPath('canEdit', false);
        $this->getJson("/api/v1/tutor/exams/{$unit3->id}/sessions")->assertOk()->assertJsonPath('canEdit', false);
        $this->getJson("/api/v1/tutor/attempts/{$mariyam->id}")->assertOk()->assertJsonPath('canEdit', false);

        $this->getJson('/api/v1/tutor/exams')->assertForbidden();
        $this->patchJson("/api/v1/tutor/exams/{$unit3->id}", ['title' => 'Hacked'])->assertForbidden();
        $this->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertForbidden();
        $this->putJson("/api/v1/tutor/attempts/{$mariyam->id}/marks", ['answers' => []])->assertForbidden();
    }

    /* ------------------------------------------------------------- exam list */

    public function test_the_list_shows_each_exam_at_its_stage(): void
    {
        $response = $this->as('aishath@ll.test')->getJson('/api/v1/tutor/exams?sort=name')->assertOk();

        $response->assertJsonPath('tutor.name', 'Aishath Rasheed')
            ->assertJsonPath('stats', ['open' => 1, 'toMark' => 1, 'drafts' => 1])
            ->assertJsonPath('meta.total', 3);

        $rows = collect($response->json('exams'))->keyBy(fn ($e) => explode(':', $e['title'])[0]);
        $this->assertSame('released', $rows['Unit 2 Test']['stage']);
        $this->assertSame(75.0, (float) $rows['Unit 2 Test']['averagePercent']);
        $this->assertSame('live', $rows['Unit 3 Test']['stage']);
        $this->assertSame(1, $rows['Unit 3 Test']['toMark']);
        $this->assertSame(4, $rows['Unit 3 Test']['studentTotal']);
        $this->assertSame(1, $rows['Unit 3 Test']['submitted']);
        $this->assertSame(['questionCount' => 8, 'totalMarks' => 16], [
            'questionCount' => $rows['Unit 3 Test']['questionCount'], 'totalMarks' => $rows['Unit 3 Test']['totalMarks'],
        ]);
        $this->assertSame('draft', $rows['Unit 4 Test']['stage']);
        $this->assertSame([3, 5], [$rows['Unit 4 Test']['approvedCount'], $rows['Unit 4 Test']['questionCount']]);
    }

    public function test_the_list_filters_searches_sorts_and_pages(): void
    {
        $this->as('aishath@ll.test');
        $titles = fn (string $query) => collect($this->getJson("/api/v1/tutor/exams?{$query}")->assertOk()->json('exams'))->pluck('title')->all();

        $this->assertSame(['Unit 4 Test: Market Failure'], $titles('filter=drafts'));
        $this->assertSame(['Unit 3 Test: Demand and Supply'], $titles('filter=marking'));
        $this->assertCount(2, $titles('filter=published'));
        $this->assertSame(['Unit 2 Test: Elasticity'], $titles('q=elast'));
        $this->assertSame(['Unit 2 Test: Elasticity', 'Unit 3 Test: Demand and Supply', 'Unit 4 Test: Market Failure'], $titles('sort=name'));
        $this->assertSame(['Unit 4 Test: Market Failure', 'Unit 3 Test: Demand and Supply', 'Unit 2 Test: Elasticity'], $titles('sort=name&dir=desc'));
        $this->assertSame('Unit 3 Test: Demand and Supply', $titles('')[0], 'the exam waiting to be marked comes first');

        $this->getJson('/api/v1/tutor/exams?sort=name&per_page=2&page=2')
            ->assertJsonPath('meta', ['page' => 2, 'perPage' => 2, 'total' => 3])
            ->assertJsonCount(1, 'exams');
        $this->getJson('/api/v1/tutor/exams?filter=drafts')->assertJsonPath('stats.toMark', 1);
    }

    /* ---------------------------------------------------------- builder + settings */

    public function test_a_new_exam_is_an_untitled_draft_linked_to_every_class(): void
    {
        $id = $this->as('aishath@ll.test')->postJson('/api/v1/tutor/exams')->assertCreated()->json('examId');

        $this->getJson("/api/v1/tutor/exams/{$id}")
            ->assertOk()
            ->assertJsonPath('title', 'Untitled exam')
            ->assertJsonPath('status', 'draft')
            ->assertJsonPath('timeLimitMinutes', 30)
            ->assertJsonPath('canEdit', true)
            ->assertJsonPath('publishBlocker', 'Add at least one question.')
            ->assertJsonCount(2, 'classes')
            ->assertJsonPath('classes.0.linked', true);
    }

    public function test_the_builder_says_why_publishing_is_blocked(): void
    {
        $this->as('aishath@ll.test')->getJson("/api/v1/tutor/exams/{$this->exam('Unit 4')->id}")
            ->assertJsonPath('publishBlocker', 'Approve all 5 to publish.')
            ->assertJsonPath('approvedCount', 3)
            ->assertJsonPath('totalMarks', 8);
    }

    public function test_settings_save_and_classes_can_be_unlinked(): void
    {
        $unit4 = $this->exam('Unit 4');
        $batchB = SchoolClass::where('name', 'like', '%Batch B')->firstOrFail();
        $batchA = SchoolClass::where('name', 'like', '%Batch A')->firstOrFail();

        $this->as('aishath@ll.test')->patchJson("/api/v1/tutor/exams/{$unit4->id}", [
            'title' => '  Unit 4 Test: Market Failure (v2)  ', 'timeLimitMinutes' => 40, 'navigation' => 'in_order', 'rules' => 'No phones.', 'classIds' => [$batchA->id],
        ])->assertOk();

        $unit4->refresh();
        $this->assertSame('Unit 4 Test: Market Failure (v2)', $unit4->title);
        $this->assertSame(40, $unit4->time_limit_minutes);
        $this->assertSame('in_order', $unit4->navigation->value);
        $this->assertSame([$batchA->id], ExamSession::where('exam_id', $unit4->id)->pluck('school_class_id')->all());

        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}", ['classIds' => [$batchA->id, $batchB->id]])->assertOk();
        $this->assertSame(2, ExamSession::where('exam_id', $unit4->id)->count());
    }

    public function test_a_class_that_is_not_the_teachers_is_ignored(): void
    {
        $unit4 = $this->exam('Unit 4');
        $others = SchoolClass::factory()->create(['tutor_id' => User::where('email', 'ali@ll.test')->value('id')]);

        $this->as('aishath@ll.test')->patchJson("/api/v1/tutor/exams/{$unit4->id}", ['classIds' => [$others->id]])->assertOk();

        $this->assertSame(0, ExamSession::where('exam_id', $unit4->id)->count());
    }

    public function test_settings_are_validated(): void
    {
        $unit4 = $this->exam('Unit 4');
        $this->as('aishath@ll.test');

        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}", ['timeLimitMinutes' => 0])
            ->assertStatus(422)->assertJson(['code' => 'validation', 'message' => 'Time limit must be between 1 and 600 minutes.']);
        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}", ['navigation' => 'sideways'])->assertStatus(422);
    }

    public function test_a_published_exam_is_locked(): void
    {
        $unit3 = $this->exam('Unit 3');
        $question = $unit3->questions()->firstOrFail();
        $this->as('aishath@ll.test');

        $this->patchJson("/api/v1/tutor/exams/{$unit3->id}", ['title' => 'New'])->assertStatus(409)->assertJson(['code' => 'conflict']);
        $this->postJson("/api/v1/tutor/exams/{$unit3->id}/questions", $this->mcq())->assertStatus(409);
        $this->putJson("/api/v1/tutor/exams/{$unit3->id}/questions/{$question->id}", $this->mcq())->assertStatus(409);
        $this->deleteJson("/api/v1/tutor/exams/{$unit3->id}/questions/{$question->id}")->assertStatus(409);
        $this->patchJson("/api/v1/tutor/exams/{$unit3->id}/questions/{$question->id}/approval", ['approved' => false])->assertStatus(409);
        $this->postJson("/api/v1/tutor/exams/{$unit3->id}/publish")->assertStatus(409);
        $this->assertSame(8, $unit3->questions()->count());
    }

    /* ------------------------------------------------------------- questions */

    public function test_the_editor_starts_each_kind_with_sensible_defaults(): void
    {
        $unit4 = $this->exam('Unit 4');
        $this->as('aishath@ll.test');

        $this->getJson("/api/v1/tutor/exams/{$unit4->id}/questions/new?kind=written")
            ->assertOk()->assertJsonPath('id', null)->assertJsonPath('position', 6)->assertJsonPath('draft.points', 4)->assertJsonPath('draft.kind', 'written');
        $this->getJson("/api/v1/tutor/exams/{$unit4->id}/questions/new?kind=fill_blank")
            ->assertJsonPath('draft.prompt', 'Type the sentence and put ________ where the blank goes.');
        $this->getJson("/api/v1/tutor/exams/{$unit4->id}/questions/new")->assertJsonPath('draft.kind', 'mcq')->assertJsonPath('draft.options', ['', '', '', '']);
    }

    public function test_the_editor_loads_a_question_with_its_key(): void
    {
        $unit4 = $this->exam('Unit 4');
        $q = $unit4->questions()->where('position', 1)->firstOrFail();

        $this->as('aishath@ll.test')->getJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$q->id}")
            ->assertOk()
            ->assertJsonPath('draft.correct', 'A')
            ->assertJsonPath('draft.options.0', 'Noise from a nearby building site')
            ->assertJsonPath('draft.approved', true)
            ->assertJsonPath('locked', false)
            ->assertJsonPath('total', 5);
    }

    public function test_adding_a_question_puts_it_last_and_unapproved(): void
    {
        $unit4 = $this->exam('Unit 4');

        $id = $this->as('aishath@ll.test')->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq())->assertCreated()->json('questionId');

        $question = Question::findOrFail($id);
        $this->assertSame(6, $question->position);
        $this->assertFalse($question->approved);
        $this->assertSame(['correct' => 'A'], $question->answer_key);
        $this->assertSame('Labour', $question->options[0]['text']);
    }

    public function test_a_question_can_be_approved_when_it_is_saved_if_its_key_is_complete(): void
    {
        $unit4 = $this->exam('Unit 4');
        $this->as('aishath@ll.test');

        $id = $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq(['approved' => true]))->assertCreated()->json('questionId');
        $this->assertTrue(Question::findOrFail($id)->approved);

        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq(['correct' => null, 'approved' => true]))
            ->assertStatus(422)->assertJsonPath('message', 'Finish the answer key before approving. Choose the correct option.');
        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq(['options' => ['Labour', '', 'A tariff', 'Profit'], 'approved' => true]))
            ->assertStatus(422)->assertJsonPath('message', 'Finish the answer key before approving. Fill in all four options.');
        $this->assertSame(6, $unit4->questions()->count(), 'the refused questions were not saved');
    }

    public function test_each_kind_checks_its_own_key(): void
    {
        $unit4 = $this->exam('Unit 4');
        $this->as('aishath@ll.test');
        $post = fn (array $body) => $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $body + ['points' => 1, 'approved' => true]);

        $post(['kind' => 'true_false', 'prompt' => 'Statement.'])->assertStatus(422)->assertJsonPath('message', 'Finish the answer key before approving. Choose whether the statement is true or false.');
        $post(['kind' => 'true_false', 'prompt' => 'Statement.', 'trueFalse' => false])->assertCreated();
        $post(['kind' => 'fill_blank', 'prompt' => 'No gap here.', 'accepted' => ['x']])->assertStatus(422)->assertJsonPath('message', 'Finish the answer key before approving. Put ____ in the sentence where the blank goes.');
        $post(['kind' => 'fill_blank', 'prompt' => 'A ________ B', 'accepted' => []])->assertStatus(422)->assertJsonPath('message', 'Finish the answer key before approving. Add at least one accepted answer.');
        $post(['kind' => 'fill_blank', 'prompt' => 'A ________ B', 'accepted' => ['  ', 'gap']])->assertCreated();
        $post(['kind' => 'written', 'prompt' => 'Explain.', 'points' => 4, 'markingPoints' => []])->assertStatus(422)->assertJsonPath('message', 'Finish the answer key before approving. Add at least one marking point.');
        $post(['kind' => 'written', 'prompt' => 'Explain.', 'points' => 4, 'markingPoints' => ['A point']])->assertCreated();
    }

    public function test_a_fill_in_question_may_have_only_one_blank_even_as_a_draft(): void
    {
        $unit4 = $this->exam('Unit 4');

        $this->as('aishath@ll.test')->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", [
            'kind' => 'fill_blank', 'prompt' => 'The ________ curve and the ________ curve.', 'points' => 1, 'accepted' => ['demand'],
        ])->assertStatus(422)->assertJsonPath('message', 'Use one blank per question. Split it into separate questions if you need more.');
    }

    public function test_a_question_needs_text_and_marks(): void
    {
        $unit4 = $this->exam('Unit 4');
        $this->as('aishath@ll.test');

        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq(['prompt' => '']))->assertStatus(422)->assertJsonPath('message', 'Write the question first.');
        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq(['points' => 0]))->assertStatus(422)->assertJsonPath('message', 'Give the question at least 1 mark.');
        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", ['kind' => 'essay', 'prompt' => 'x', 'points' => 1])->assertStatus(422);
    }

    public function test_editing_an_approved_question_removes_its_approval_unless_it_is_approved_again(): void
    {
        $unit4 = $this->exam('Unit 4');
        $q = $unit4->questions()->where('position', 1)->firstOrFail();
        $url = "/api/v1/tutor/exams/{$unit4->id}/questions/{$q->id}";
        $this->as('aishath@ll.test');

        $this->putJson($url, $this->mcq(['prompt' => 'A reworded question?', 'approved' => false]))->assertOk();
        $this->assertFalse($q->fresh()->approved);

        $this->putJson($url, $this->mcq(['prompt' => 'A reworded question?', 'approved' => true]))->assertOk();
        $this->assertTrue($q->fresh()->approved);

        $this->putJson($url, $this->mcq(['prompt' => 'Reworded again?', 'approved' => true]))->assertOk();
        $this->assertTrue($q->fresh()->approved, 'approved in the same save as the edit');
        $this->assertSame('Reworded again?', $q->fresh()->prompt);
    }

    public function test_approving_needs_a_complete_key(): void
    {
        $unit4 = $this->exam('Unit 4');
        $incomplete = $unit4->questions()->where('position', 5)->firstOrFail();
        $complete = $unit4->questions()->where('position', 4)->firstOrFail();
        $this->as('aishath@ll.test');

        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$incomplete->id}/approval", ['approved' => true])
            ->assertStatus(422)->assertJsonPath('message', "Question 5 isn't ready to approve. Add at least one marking point.");
        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$complete->id}/approval", ['approved' => true])->assertOk();
        $this->assertTrue($complete->fresh()->approved);
        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$complete->id}/approval", ['approved' => false])->assertOk();
        $this->assertFalse($complete->fresh()->approved);
    }

    public function test_deleting_a_question_renumbers_the_rest(): void
    {
        $unit4 = $this->exam('Unit 4');
        $second = $unit4->questions()->where('position', 2)->firstOrFail();

        $this->as('aishath@ll.test')->deleteJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$second->id}")->assertOk();

        $this->assertSame([1, 2, 3, 4], $unit4->questions()->pluck('position')->all());
        $this->getJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$second->id}")->assertNotFound();
    }

    public function test_an_imported_exam_arrives_unapproved(): void
    {
        $unit4 = $this->exam('Unit 4');

        $this->as('aishath@ll.test')->postJson("/api/v1/tutor/exams/{$unit4->id}/questions/import", ['questions' => [
            $this->mcq(['approved' => true]),
            ['kind' => 'true_false', 'prompt' => 'Imported statement.', 'points' => 1, 'trueFalse' => null],
            ['kind' => 'written', 'prompt' => 'Imported essay.', 'points' => 4, 'markingPoints' => ['One']],
        ]])->assertOk()->assertJson(['added' => 3]);

        $added = $unit4->questions()->where('position', '>', 5)->get();
        $this->assertSame([6, 7, 8], $added->pluck('position')->all());
        $this->assertSame([false, false, false], $added->pluck('approved')->all());
    }

    public function test_one_teacher_cannot_edit_anothers_questions(): void
    {
        $unit4 = $this->exam('Unit 4');

        $this->as('ali@ll.test')->postJson("/api/v1/tutor/exams/{$unit4->id}/questions", $this->mcq())->assertNotFound();
    }

    /* --------------------------------------------------------------- publish */

    public function test_publishing_needs_every_question_approved_then_locks_the_exam(): void
    {
        $unit4 = $this->exam('Unit 4');
        $this->as('aishath@ll.test');

        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/publish")->assertStatus(422)->assertJsonPath('message', 'Approve every question before publishing.');

        $four = $unit4->questions()->where('position', 4)->firstOrFail();
        $five = $unit4->questions()->where('position', 5)->firstOrFail();
        $this->patchJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$four->id}/approval", ['approved' => true])->assertOk();
        $this->putJson("/api/v1/tutor/exams/{$unit4->id}/questions/{$five->id}", [
            'kind' => 'written', 'prompt' => 'Explain street lighting.', 'points' => 4, 'markingPoints' => ['Non-excludable'], 'approved' => true,
        ])->assertOk();

        $this->getJson("/api/v1/tutor/exams/{$unit4->id}")->assertJsonPath('publishBlocker', null);
        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/publish")->assertOk();

        $unit4->refresh();
        $this->assertSame('published', $unit4->status->value);
        $this->assertNotNull($unit4->published_at);
        $this->assertSame(1, AuditLog::where('action', 'exam.publish')->count());
        $this->postJson("/api/v1/tutor/exams/{$unit4->id}/publish")->assertStatus(409);
    }

    public function test_an_exam_with_no_questions_or_classes_cannot_be_published(): void
    {
        $id = $this->as('aishath@ll.test')->postJson('/api/v1/tutor/exams')->json('examId');

        $this->postJson("/api/v1/tutor/exams/{$id}/publish")->assertStatus(422)->assertJsonPath('message', 'Add at least one question first.');

        $this->postJson("/api/v1/tutor/exams/{$id}/questions", $this->mcq(['approved' => true]))->assertCreated();
        $this->patchJson("/api/v1/tutor/exams/{$id}", ['classIds' => []])->assertOk();
        $this->postJson("/api/v1/tutor/exams/{$id}/publish")->assertStatus(422)->assertJsonPath('message', 'Choose at least one class first.');
    }

    /* -------------------------------------------------------------- sessions */

    public function test_each_class_gets_a_card_with_its_counts(): void
    {
        $response = $this->as('aishath@ll.test')->getJson("/api/v1/tutor/exams/{$this->exam('Unit 3')->id}/sessions")->assertOk();

        $response->assertJsonPath('exam.title', 'Unit 3 Test: Demand and Supply')->assertJsonPath('exam.questionCount', 8)->assertJsonPath('canEdit', true);
        $cards = collect($response->json('classes'))->keyBy('label');
        $this->assertSame(['open', 3, 0, 1, 1, 2], [$cards['Batch A']['status'], $cards['Batch A']['students'], $cards['Batch A']['sitting'], $cards['Batch A']['handedIn'], $cards['Batch A']['toMark'], $cards['Batch A']['notStarted']]);
        $this->assertSame(['not_open', 1, 0, 1], [$cards['Batch B']['status'], $cards['Batch B']['students'], $cards['Batch B']['handedIn'], $cards['Batch B']['notStarted']]);
    }

    public function test_a_class_can_be_opened_once_and_only_for_a_published_exam(): void
    {
        $batchB = $this->sessionOf('Unit 3', 'Batch B');
        $this->as('aishath@ll.test');

        $this->postJson("/api/v1/tutor/sessions/{$batchB->id}/open")->assertOk();
        $this->assertSame('open', $batchB->fresh()->status->value);
        $this->assertNotNull($batchB->fresh()->opened_at);
        $this->postJson("/api/v1/tutor/sessions/{$batchB->id}/open")->assertStatus(409)->assertJsonPath('message', 'This class has already been opened.');

        $draft = $this->sessionOf('Unit 4', 'Batch A');
        $this->postJson("/api/v1/tutor/sessions/{$draft->id}/open")->assertStatus(409)->assertJsonPath('message', 'Publish the exam before opening it.');
    }

    public function test_opening_a_class_lets_its_students_in(): void
    {
        $batchB = $this->sessionOf('Unit 3', 'Batch B');
        $this->as('ahmed@ll.test')->getJson('/api/v1/student/home')->assertJsonCount(0, 'open');

        $this->as('aishath@ll.test')->postJson("/api/v1/tutor/sessions/{$batchB->id}/open")->assertOk();

        $this->as('ahmed@ll.test')->getJson('/api/v1/student/home')->assertJsonCount(1, 'open');
    }

    public function test_closing_hands_in_whoever_is_still_sitting(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('ibrahim@ll.test');
        $id = $this->postJson("/api/v1/student/exams/{$session->id}/start")->json('attemptId');
        $this->putJson("/api/v1/student/attempts/{$id}/answers/{$session->exam->questions()->first()->id}", ['response' => 'A'])->assertOk();

        $this->as('aishath@ll.test')->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertOk()->assertJson(['submitted' => 1]);

        $attempt = Attempt::findOrFail($id);
        $this->assertSame('closed', $attempt->submit_reason->value);
        $this->assertNotSame('in_progress', $attempt->status->value);
        $this->assertSame('closed', $session->fresh()->status->value);

        $this->as('hawwa@ll.test')->postJson("/api/v1/student/exams/{$session->id}/start")->assertNotFound();
        $this->as('aishath@ll.test')->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertStatus(409);
    }

    public function test_results_cannot_be_released_early(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('aishath@ll.test');

        $this->postJson("/api/v1/tutor/sessions/{$session->id}/release")->assertStatus(409)->assertJsonPath('message', 'Close the exam for this class first.');

        $this->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertOk();
        $this->postJson("/api/v1/tutor/sessions/{$session->id}/release")->assertStatus(409)->assertJsonPath('message', '1 submission still needs marking.');
        $this->assertNull($session->fresh()->results_released_at);
    }

    public function test_marking_closing_and_releasing_gets_the_result_to_the_student(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $mariyam = Attempt::where('exam_session_id', $session->id)->firstOrFail();
        $this->as('mariyam@ll.test')->getJson("/api/v1/student/results/{$mariyam->id}")->assertNotFound();

        $this->as('aishath@ll.test');
        $this->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertOk();
        $this->putJson("/api/v1/tutor/attempts/{$mariyam->id}/marks", $this->marks($mariyam, 3, 4))->assertOk();
        $this->postJson("/api/v1/tutor/sessions/{$session->id}/release")->assertOk();
        $this->postJson("/api/v1/tutor/sessions/{$session->id}/release")->assertStatus(409)->assertJsonPath('message', 'Results are already released.');

        $this->as('mariyam@ll.test')->getJson("/api/v1/student/results/{$mariyam->id}")
            ->assertOk()
            ->assertJsonPath('score', 11)
            ->assertJsonPath('total', 16)
            ->assertJsonPath('grade', 'B')
            ->assertJsonPath('overallComment', 'Well done.')
            ->assertJsonPath('questions.6.feedback', 'Good point on necessity.');
        $this->assertSame(['session.close', 'attempt.mark', 'session.release'], AuditLog::orderBy('id')->pluck('action')->all());
    }

    /* ------------------------------------------------------------------ live */

    public function test_the_live_list_puts_what_needs_marking_first(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');

        $response = $this->as('aishath@ll.test')->getJson("/api/v1/tutor/sessions/{$session->id}/live")->assertOk();

        $response->assertJsonPath('counts', ['all' => 3, 'to_mark' => 1, 'sitting' => 0, 'waiting' => 2, 'marked' => 0])
            ->assertJsonPath('release.canRelease', false)
            ->assertJsonPath('release.toMark', 1)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('card.label', 'Batch A');
        $this->assertSame(['Mariyam Leena', 'Hawwa Nadheema', 'Ibrahim Zayan'], collect($response->json('rows'))->pluck('name')->all());

        $mariyam = $response->json('rows.0');
        $this->assertSame('to_mark', $mariyam['state']);
        $this->assertSame([7, 8, 1, 4, 6], [$mariyam['answered'], $mariyam['questionCount'], $mariyam['violations'], $mariyam['objectiveScore'], $mariyam['objectiveTotal']]);
        $this->assertSame('manual', $mariyam['submitReason']);
        $this->assertNull($mariyam['score']);
        $this->assertSame('not_started', $response->json('rows.1.state'));
    }

    public function test_the_live_list_searches_filters_and_pages(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('aishath@ll.test');
        $names = fn (string $query) => collect($this->getJson("/api/v1/tutor/sessions/{$session->id}/live?{$query}")->assertOk()->json('rows'))->pluck('name')->all();

        $this->assertSame(['Ibrahim Zayan'], $names('q=ibra'));
        $this->assertSame(['Mariyam Leena'], $names('state=to_mark'));
        $this->assertSame(['Hawwa Nadheema', 'Ibrahim Zayan'], $names('state=waiting'));
        $this->assertSame([], $names('state=sitting'));
        $this->assertSame(['Hawwa Nadheema'], $names('per_page=1&page=2'));
        $this->getJson("/api/v1/tutor/sessions/{$session->id}/live?per_page=1&page=2")->assertJsonPath('meta', ['page' => 2, 'perPage' => 1, 'total' => 3]);
    }

    public function test_a_student_sitting_shows_with_time_left(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('ibrahim@ll.test')->postJson("/api/v1/student/exams/{$session->id}/start")->assertOk();

        $row = collect($this->as('aishath@ll.test')->getJson("/api/v1/tutor/sessions/{$session->id}/live?state=sitting")->json('rows'))->firstOrFail();

        $this->assertSame('sitting', $row['state']);
        $this->assertEqualsWithDelta(1800, $row['secondsLeft'], 5);
        $this->assertSame('Ibrahim Zayan', $row['name']);
    }

    public function test_a_student_who_never_started_shows_as_not_attempted_once_closed(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('aishath@ll.test')->postJson("/api/v1/tutor/sessions/{$session->id}/close")->assertOk();

        $this->getJson("/api/v1/tutor/sessions/{$session->id}/live?state=waiting")
            ->assertJsonPath('rows.0.state', 'not_attempted')
            ->assertJsonPath('counts.waiting', 2);
    }

    public function test_an_overdue_student_is_handed_in_when_the_teacher_looks(): void
    {
        Carbon::setTestNow('2026-03-04 08:00:00');
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('ibrahim@ll.test')->postJson("/api/v1/student/exams/{$session->id}/start")->assertOk();

        Carbon::setTestNow('2026-03-04 09:00:00');
        $row = collect($this->as('aishath@ll.test')->getJson("/api/v1/tutor/sessions/{$session->id}/live")->json('rows'))->firstWhere('name', 'Ibrahim Zayan');

        $this->assertNotSame('sitting', $row['state']);
        $this->assertSame('timeout', $row['submitReason']);
    }

    public function test_the_scheduled_sweep_hands_in_overdue_attempts(): void
    {
        Carbon::setTestNow('2026-03-04 08:00:00');
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $this->as('ibrahim@ll.test')->postJson("/api/v1/student/exams/{$session->id}/start")->assertOk();
        $attempt = Attempt::where('student_id', User::where('email', 'ibrahim@ll.test')->value('id'))->firstOrFail();

        Carbon::setTestNow('2026-03-04 08:10:00');
        Artisan::call('attempts:expire');
        $this->assertTrue($attempt->fresh()->isInProgress(), 'still has time');

        Carbon::setTestNow('2026-03-04 08:31:00');
        Artisan::call('attempts:expire');
        $this->assertSame('timeout', $attempt->fresh()->submit_reason->value);
    }

    /* --------------------------------------------------------------- marking */

    /** The body for saving marks on Mariyam's two written answers. */
    private function marks(Attempt $attempt, int $q7, int $q8): array
    {
        $written = Question::where('exam_id', $attempt->session->exam_id)->where('kind', 'written')->orderBy('position')->get();

        return [
            'answers' => [
                ['questionId' => $written[0]->id, 'awarded' => $q7, 'feedback' => 'Good point on necessity.', 'ticks' => [0, 1, 2]],
                ['questionId' => $written[1]->id, 'awarded' => $q8, 'feedback' => '', 'ticks' => [0, 1, 2, 3]],
            ],
            'overallComment' => 'Well done.',
        ];
    }

    private function mariyam(): Attempt
    {
        return Attempt::whereHas('student', fn ($q) => $q->where('email', 'mariyam@ll.test'))->firstOrFail();
    }

    public function test_the_marking_screen_shows_the_auto_marks_the_points_and_the_violations(): void
    {
        $response = $this->as('aishath@ll.test')->getJson("/api/v1/tutor/attempts/{$this->mariyam()->id}")->assertOk();

        $response->assertJsonPath('student.name', 'Mariyam Leena')
            ->assertJsonPath('firstName', 'Mariyam')
            ->assertJsonPath('status', 'submitted')
            ->assertJsonPath('canEdit', true)
            ->assertJsonPath('objectiveScore', 4)
            ->assertJsonPath('objectiveTotal', 6)
            ->assertJsonPath('totalMarks', 16)
            ->assertJsonCount(6, 'objective')
            ->assertJsonCount(2, 'written')
            ->assertJsonCount(1, 'violations')
            ->assertJsonPath('violations.0.kind', 'hidden')
            ->assertJsonPath('objective.1.answer', 'C. The price of a substitute in consumption')
            ->assertJsonPath('objective.3.answer', 'Not answered')
            ->assertJsonPath('written.0.points', 4)
            ->assertJsonCount(4, 'written.0.markingPoints')
            ->assertJsonPath('written.0.awarded', null);
    }

    public function test_saving_marks_completes_the_marking(): void
    {
        $attempt = $this->mariyam();
        $teacher = User::where('email', 'aishath@ll.test')->firstOrFail();
        $this->as('aishath@ll.test');
        $this->getJson('/api/v1/tutor/to-mark/count')->assertOk()->assertExactJson([1]);

        $this->putJson("/api/v1/tutor/attempts/{$attempt->id}/marks", $this->marks($attempt, 3, 4))
            ->assertOk()->assertJson(['score' => 11, 'total' => 16, 'grade' => 'B']);

        $attempt->refresh();
        $this->assertSame('marked', $attempt->status->value);
        $this->assertSame(11, $attempt->total_score);
        $this->assertSame($teacher->id, $attempt->marked_by);
        $this->assertSame('Well done.', $attempt->overall_comment);
        $this->getJson('/api/v1/tutor/to-mark/count')->assertExactJson([0]);

        $this->getJson("/api/v1/tutor/attempts/{$attempt->id}")
            ->assertJsonPath('written.0.awarded', 3)
            ->assertJsonPath('written.0.ticks', [0, 1, 2])
            ->assertJsonPath('written.0.feedback', 'Good point on necessity.')
            ->assertJsonPath('overallComment', 'Well done.');
    }

    public function test_marks_must_fit_the_question(): void
    {
        $attempt = $this->mariyam();
        $this->as('aishath@ll.test');

        $this->putJson("/api/v1/tutor/attempts/{$attempt->id}/marks", $this->marks($attempt, 5, 4))
            ->assertStatus(422)->assertJsonPath('message', 'Question 7 is out of 4 marks.');
        $this->putJson("/api/v1/tutor/attempts/{$attempt->id}/marks", $this->marks($attempt, -1, 4))->assertStatus(422);

        $partial = $this->marks($attempt, 3, 4);
        array_pop($partial['answers']);
        $this->putJson("/api/v1/tutor/attempts/{$attempt->id}/marks", $partial)
            ->assertStatus(422)->assertJsonPath('message', 'Mark question 8 before saving.');
        $this->assertSame('submitted', $attempt->fresh()->status->value, 'nothing was saved');
    }

    public function test_a_student_still_sitting_cannot_be_marked(): void
    {
        $session = $this->sessionOf('Unit 3', 'Batch A');
        $id = $this->as('ibrahim@ll.test')->postJson("/api/v1/student/exams/{$session->id}/start")->json('attemptId');
        $attempt = Attempt::findOrFail($id);

        $this->as('aishath@ll.test')->putJson("/api/v1/tutor/attempts/{$id}/marks", $this->marks($attempt, 1, 1))->assertStatus(409);
        $this->getJson("/api/v1/tutor/attempts/{$id}")->assertJsonPath('canEdit', false);
    }

    public function test_marks_cannot_change_after_release(): void
    {
        $attempt = Attempt::whereHas('student', fn ($q) => $q->where('email', 'hawwa@ll.test'))->firstOrFail();

        $this->as('aishath@ll.test')->getJson("/api/v1/tutor/attempts/{$attempt->id}")->assertJsonPath('canEdit', false)->assertJsonPath('released', true);
        $this->putJson("/api/v1/tutor/attempts/{$attempt->id}/marks", ['answers' => [['questionId' => 1, 'awarded' => 1]]])->assertStatus(409);
    }

    public function test_the_to_mark_list_is_oldest_first_and_paged(): void
    {
        $this->as('aishath@ll.test')->getJson('/api/v1/tutor/to-mark')
            ->assertOk()
            ->assertJsonPath('meta', ['page' => 1, 'perPage' => 10, 'total' => 1])
            ->assertJsonPath('items.0.student.name', 'Mariyam Leena')
            ->assertJsonPath('items.0.examTitle', 'Unit 3 Test: Demand and Supply')
            ->assertJsonPath('items.0.writtenCount', 2);
        $this->as('ali@ll.test')->getJson('/api/v1/tutor/to-mark')->assertJsonPath('meta.total', 0);
    }

    /* --------------------------------------------------------------- classes */

    public function test_a_teacher_sees_their_classes_with_students_and_exams(): void
    {
        $response = $this->as('aishath@ll.test')->getJson('/api/v1/tutor/classes')->assertOk();

        $response->assertJsonCount(2);
        $batchA = collect($response->json())->firstWhere('name', 'IGCSE Economics, Batch A');
        $this->assertSame(['Hawwa Nadheema', 'Ibrahim Zayan', 'Mariyam Leena'], collect($batchA['students'])->pluck('name')->all());
        $this->assertCount(3, $batchA['exams']);
        $this->as('ali@ll.test')->getJson('/api/v1/tutor/classes')->assertExactJson([]);
    }
}

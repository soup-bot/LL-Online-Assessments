<?php

namespace Tests\Feature;

use App\Models\Answer;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_student_can_take_several_subjects(): void
    {
        $student = User::factory()->create();
        $economics = SchoolClass::factory()->create(['name' => 'IGCSE Economics, Batch A', 'subject_code' => '0455']);
        $business = SchoolClass::factory()->create(['name' => 'IGCSE Business Studies, Batch C', 'subject_code' => '0450']);

        $economics->addStudent($student);
        $business->addStudent($student);

        $this->assertCount(2, $student->classes);
    }

    public function test_a_student_cannot_be_in_two_classes_for_one_subject(): void
    {
        $student = User::factory()->create();
        SchoolClass::factory()->create(['subject_code' => '0455'])->addStudent($student);
        $second = SchoolClass::factory()->create(['subject_code' => '0455']);

        $this->expectException(QueryException::class);
        $second->addStudent($student);
    }

    public function test_changing_a_class_subject_updates_its_roster_rows(): void
    {
        $student = User::factory()->create();
        $class = SchoolClass::factory()->create(['subject_code' => '0455']);
        $class->addStudent($student);

        $class->update(['subject_code' => '0450']);

        $this->assertSame('0450', $student->classes()->first()->pivot->subject_code);
    }

    public function test_an_exam_is_opened_once_per_class(): void
    {
        $session = ExamSession::factory()->create();

        $this->expectException(QueryException::class);
        ExamSession::create(['exam_id' => $session->exam_id, 'school_class_id' => $session->school_class_id]);
    }

    public function test_a_student_has_one_attempt_per_session(): void
    {
        $attempt = Attempt::factory()->create();

        $this->expectException(QueryException::class);
        Attempt::factory()->create(['exam_session_id' => $attempt->exam_session_id, 'student_id' => $attempt->student_id]);
    }

    public function test_an_answer_row_is_unique_per_attempt_and_question(): void
    {
        $attempt = Attempt::factory()->create();
        $question = Question::factory()->create();
        Answer::create(['attempt_id' => $attempt->id, 'question_id' => $question->id, 'response' => 'A']);

        $this->expectException(QueryException::class);
        Answer::create(['attempt_id' => $attempt->id, 'question_id' => $question->id, 'response' => 'B']);
    }

    public function test_the_answer_key_never_appears_when_a_question_is_serialised(): void
    {
        $question = Question::factory()->create();

        $this->assertArrayNotHasKey('answer_key', $question->toArray());
        $this->assertStringNotContainsString('answer_key', $question->toJson());
        $this->assertSame(['correct' => 'A'], $question->answer_key);
    }

    public function test_editing_an_approved_question_removes_its_approval(): void
    {
        $question = Question::factory()->approved()->create();

        $question->update(['prompt' => 'A different question?']);

        $this->assertFalse($question->fresh()->approved);
    }

    public function test_approving_a_question_does_not_remove_its_own_approval(): void
    {
        $question = Question::factory()->create();

        $question->update(['approved' => true]);

        $this->assertTrue($question->fresh()->approved);
    }

    public function test_question_positions_are_unique_within_an_exam(): void
    {
        $question = Question::factory()->create(['position' => 1]);

        $this->expectException(QueryException::class);
        Question::factory()->create(['exam_id' => $question->exam_id, 'position' => 1]);
    }
}

<?php

namespace Database\Seeders;

use App\Enums\AttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\SessionStatus;
use App\Enums\SubmitReason;
use App\Enums\ViolationKind;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use App\Models\Violation;
use Database\Seeders\Data\QuestionBank;
use Illuminate\Database\Seeder;

/**
 * The brief's school plus the same story the frontend mock tells, so swapping the mock for this
 * API changes nothing on screen: Unit 3 published and open for Batch A, Unit 2 released with a
 * result for Hawwa, Unit 4 half-built, and Mariyam waiting for her written answers to be marked.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(BriefSeeder::class);

        $aishath = User::where('email', 'aishath@ll.test')->firstOrFail();
        $hawwa = User::where('email', 'hawwa@ll.test')->firstOrFail();
        $mariyam = User::where('email', 'mariyam@ll.test')->firstOrFail();
        $batchA = SchoolClass::where('name', 'IGCSE Economics, Batch A')->firstOrFail();
        $batchB = SchoolClass::where('name', 'IGCSE Economics, Batch B')->firstOrFail();

        // ---- Unit 3: published, open for Batch A, closed to Batch B
        $unit3 = Exam::where('title', 'Unit 3 Test: Demand and Supply')->firstOrFail();
        Question::where('exam_id', $unit3->id)->update(['approved' => true]);
        $unit3->update(['status' => ExamStatus::Published, 'published_at' => now()->subDay()]);
        $session3 = ExamSession::where(['exam_id' => $unit3->id, 'school_class_id' => $batchA->id])->firstOrFail();
        $session3->update(['status' => SessionStatus::Open, 'opened_at' => now()->subMinutes(50)]);

        // ---- Unit 2: closed and released a week ago
        $unit2 = $this->exam($aishath, 'Unit 2 Test: Elasticity', 20, 'Calculators are allowed.', QuestionBank::unit2(), ExamStatus::Published);
        $session2 = ExamSession::create([
            'exam_id' => $unit2->id, 'school_class_id' => $batchA->id, 'status' => SessionStatus::Closed,
            'opened_at' => now()->subDays(7)->subMinutes(10), 'closed_at' => now()->subDays(7)->addMinutes(40),
            'results_released_at' => now()->subDays(6),
        ]);
        $this->hawwaResult($session2, $unit2, $hawwa);

        // ---- Unit 4: a draft with three of five questions approved, linked to both batches
        $unit4 = $this->exam($aishath, 'Unit 4 Test: Market Failure', 25, '', QuestionBank::unit4(), ExamStatus::Draft);
        foreach ([$batchA, $batchB] as $class) {
            ExamSession::create(['exam_id' => $unit4->id, 'school_class_id' => $class->id, 'status' => SessionStatus::NotOpen]);
        }

        // ---- Mariyam has handed in Unit 3 and is waiting for marking
        $this->mariyamSubmission($session3, $unit3, $mariyam);
    }

    private function exam(User $owner, string $title, int $minutes, string $rules, array $definitions, ExamStatus $status): Exam
    {
        $exam = Exam::create([
            'owner_id' => $owner->id, 'title' => $title, 'time_limit_minutes' => $minutes, 'rules' => $rules,
            'status' => $status, 'published_at' => $status === ExamStatus::Published ? now()->subDays(8) : null,
        ]);
        foreach ($definitions as $i => $definition) {
            $row = QuestionBank::attributes($exam->id, $i + 1, $definition);
            $row['options'] = $row['options'] === null ? null : json_decode($row['options'], true);
            $row['answer_key'] = json_decode($row['answer_key'], true);
            unset($row['created_at'], $row['updated_at']);
            Question::create($row);
        }

        return $exam;
    }

    private function hawwaResult(ExamSession $session, Exam $exam, User $student): void
    {
        $started = now()->subDays(7);
        $attempt = Attempt::create([
            'exam_session_id' => $session->id, 'student_id' => $student->id,
            'started_at' => $started, 'deadline_at' => $started->copy()->addMinutes(20),
            'submitted_at' => $started->copy()->addMinutes(17), 'submit_reason' => SubmitReason::Manual,
            'status' => AttemptStatus::Marked, 'total_score' => 6, 'marked_at' => now()->subDays(6),
            'overall_comment' => 'Good, steady work, Hawwa. You know your elasticity vocabulary well. Next time, take the extra minute to link each point back to the question.',
            'result_viewed_at' => now()->subDays(5),
        ]);

        $q = Question::where('exam_id', $exam->id)->orderBy('position')->get()->keyBy('position');
        $rows = [
            [1, 'A', 1, null],
            [2, 'B', 1, null],
            [3, 'false', 0, null],
            [4, 'elastic', 1, null],
            [5, 'A firm may cut its price because if demand is elastic, people will buy a lot more when the price falls, so the firm earns more revenue overall.', 3,
                'Clear and correct on the revenue effect. Add why demand is elastic, for example that there are many close substitutes, to reach full marks.'],
        ];
        foreach ($rows as [$position, $response, $marks, $feedback]) {
            Answer::create(['attempt_id' => $attempt->id, 'question_id' => $q[$position]->id, 'response' => $response, 'awarded_marks' => $marks, 'feedback' => $feedback]);
        }
    }

    private function mariyamSubmission(ExamSession $session, Exam $exam, User $student): void
    {
        $started = now()->subMinutes(35);
        $attempt = Attempt::create([
            'exam_session_id' => $session->id, 'student_id' => $student->id,
            'started_at' => $started, 'deadline_at' => now()->subMinutes(5),
            'submitted_at' => now()->subMinutes(12), 'submit_reason' => SubmitReason::Manual,
            'status' => AttemptStatus::Submitted, 'violation_count' => 1, 'total_score' => 4,
        ]);
        Violation::create(['attempt_id' => $attempt->id, 'kind' => ViolationKind::Hidden, 'occurred_at' => now()->subMinutes(22)]);

        $q = Question::where('exam_id', $exam->id)->orderBy('position')->get()->keyBy('position');
        $rows = [
            [1, 'A', 1, false], [2, 'C', 0, false], [3, 'false', 1, false], [4, null, 0, true],
            [5, 'surplus', 1, false], [6, 'equilibrium', 1, false],
            [7, 'Petrol is a necessity in the Maldives because people rely on boats, cars and generators, so they keep buying it even when the price goes up. Also, there are very few substitutes for petrol.', null, false],
            [8, 'Fish feed is a cost for fish farms. When it rises, farms supply less, so the supply curve shifts left. The price of farmed fish goes up and the quantity sold goes down.', null, false],
        ];
        foreach ($rows as [$position, $response, $marks, $flagged]) {
            Answer::create(['attempt_id' => $attempt->id, 'question_id' => $q[$position]->id, 'response' => $response, 'flagged' => $flagged, 'awarded_marks' => $marks]);
        }
    }
}

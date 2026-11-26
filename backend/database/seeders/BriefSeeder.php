<?php

namespace Database\Seeders;

use App\Enums\ExamStatus;
use App\Enums\Role;
use App\Enums\SessionStatus;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use Database\Seeders\Data\QuestionBank;
use Illuminate\Database\Seeder;

/**
 * Exactly the scenario in the brief: two teachers, an admin, four students in two batches, and
 * one unpublished exam with eight questions (none approved) linked to both batches, nothing open.
 * Every account signs in with the password "password".
 */
class BriefSeeder extends Seeder
{
    public function run(): void
    {
        $aishath = $this->user('Aishath Rasheed', 'aishath@ll.test', Role::Tutor, 'Ms');
        $ali = $this->user('Ali Shareef', 'ali@ll.test', Role::Tutor, 'Mr');
        $hawwa = $this->user('Hawwa Nadheema', 'hawwa@ll.test', Role::Student);
        $ibrahim = $this->user('Ibrahim Zayan', 'ibrahim@ll.test', Role::Student);
        $mariyam = $this->user('Mariyam Leena', 'mariyam@ll.test', Role::Student);
        $ahmed = $this->user('Ahmed Nashid', 'ahmed@ll.test', Role::Student);
        $this->user('Mohamed Faisal', 'admin@ll.test', Role::Admin);

        $batchA = SchoolClass::create(['name' => 'IGCSE Economics, Batch A', 'subject_code' => '0455', 'grade' => 10, 'tutor_id' => $aishath->id]);
        $batchB = SchoolClass::create(['name' => 'IGCSE Economics, Batch B', 'subject_code' => '0455', 'grade' => 10, 'tutor_id' => $aishath->id]);
        foreach ([$hawwa, $ibrahim, $mariyam] as $student) {
            $batchA->addStudent($student);
        }
        $batchB->addStudent($ahmed);

        $exam = Exam::create([
            'owner_id' => $aishath->id,
            'title' => 'Unit 3 Test: Demand and Supply',
            'time_limit_minutes' => 30,
            'rules' => 'Calculators are not allowed. Answer in full sentences for questions 7 and 8.',
            'status' => ExamStatus::Draft,
        ]);

        foreach (QuestionBank::unit3() as $i => $definition) {
            Question::create($this->fill($exam->id, $i + 1, $definition));
        }

        // Linking a class creates its session, closed to students until the teacher opens it.
        foreach ([$batchA, $batchB] as $class) {
            ExamSession::create(['exam_id' => $exam->id, 'school_class_id' => $class->id, 'status' => SessionStatus::NotOpen]);
        }
    }

    private function user(string $name, string $email, Role $role, ?string $honorific = null): User
    {
        return User::create(['name' => $name, 'email' => $email, 'password' => 'password', 'role' => $role, 'honorific' => $honorific]);
    }

    /** Question columns through the model, so json casts apply and nothing is approved. */
    private function fill(int $examId, int $position, array $q): array
    {
        $row = QuestionBank::attributes($examId, $position, $q);
        $row['options'] = $row['options'] === null ? null : json_decode($row['options'], true);
        $row['answer_key'] = json_decode($row['answer_key'], true);
        unset($row['created_at'], $row['updated_at']);

        return $row;
    }
}

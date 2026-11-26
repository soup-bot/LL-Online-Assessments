<?php

namespace App\Services;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Models\Attempt;
use App\Models\AuditLog;
use App\Models\Exam;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creating and editing classes and their rosters. A student can be in several classes, one for each subject.
 */
class AdminClassService
{
    /**
     * @param  array{name: string, subjectCode: string, grade: int, tutorId: int, studentIds?: list<int>}  $input
     */
    public function save(User $admin, ?SchoolClass $class, array $input): SchoolClass
    {
        $name = trim($input['name']);
        $code = trim($input['subjectCode']);
        if ($name === '') {
            throw ApiException::validation('Enter a class name.');
        }
        if ($code === '') {
            throw ApiException::validation('Enter a subject code.');
        }

        $tutor = User::where('id', $input['tutorId'])->where('role', Role::Tutor->value)->first()
            ?? throw ApiException::validation('Choose a teacher for this class.');
        $studentIds = User::whereIn('id', $input['studentIds'] ?? [])->where('role', Role::Student->value)->pluck('id');

        $this->guardRoster($class, $code, $studentIds, $tutor);

        return DB::transaction(function () use ($admin, $class, $name, $code, $input, $tutor, $studentIds) {
            if ($class === null) {
                $class = SchoolClass::create(['name' => $name, 'subject_code' => $code, 'grade' => $input['grade'], 'tutor_id' => $tutor->id]);
                AuditLog::record($admin, 'class.create', $class);
            } else {
                $class->fill(['name' => $name, 'grade' => $input['grade'], 'tutor_id' => $tutor->id]);
                $class->subject_code = $code;
            }

            // Roster first, carrying the new subject code, so changing the code never trips the one-class-per-subject key.
            if ($class->exists) {
                $class->students()->sync($studentIds->mapWithKeys(fn ($id) => [$id => ['subject_code' => $code]])->all());
                $class->save();
                AuditLog::record($admin, 'class.update', $class, ['students' => $studentIds->count()]);
            } else {
                $class->students()->sync($studentIds->mapWithKeys(fn ($id) => [$id => ['subject_code' => $code]])->all());
            }

            return $class;
        });
    }

    /** Refuse a roster that breaks a rule, before anything is written. */
    private function guardRoster(?SchoolClass $class, string $code, $studentIds, User $tutor): void
    {
        // One class per subject: nobody may already sit in another class with this subject code.
        $clash = SchoolClass::where('subject_code', $code)
            ->when($class, fn ($q) => $q->where('id', '!=', $class->id))
            ->whereHas('students', fn ($q) => $q->whereIn('users.id', $studentIds))
            ->with(['students' => fn ($q) => $q->whereIn('users.id', $studentIds)])
            ->first();
        if ($clash) {
            $who = $clash->students->first()->name;
            throw ApiException::conflict("{$who} is already in {$clash->name}. A student can only be in one class for each subject.");
        }

        if ($class === null) {
            return;
        }

        // Students who already sat an exam in this class must stay, or their results would disappear.
        $sessionIds = $class->sessions()->pluck('id');
        $removed = $class->students()->whereNotIn('users.id', $studentIds)->pluck('users.id');
        $sat = Attempt::whereIn('exam_session_id', $sessionIds)->whereIn('student_id', $removed)->with('student')->first();
        if ($sat) {
            throw ApiException::conflict("{$sat->student->name} has already sat an exam in this class, so they can't be removed.");
        }

        if ($class->tutor_id !== $tutor->id && Exam::where('owner_id', $class->tutor_id)->whereHas('sessions', fn ($q) => $q->where('school_class_id', $class->id))->exists()) {
            throw ApiException::conflict("This class already has exams from its teacher, so the teacher can't change.");
        }
    }
}

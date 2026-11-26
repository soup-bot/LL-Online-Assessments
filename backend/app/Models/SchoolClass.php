<?php

namespace App\Models;

use Database\Factories\SchoolClassFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class SchoolClass extends Model
{
    /** @use HasFactory<SchoolClassFactory> */
    use HasFactory;

    protected $fillable = ['name', 'subject_code', 'grade', 'tutor_id'];

    protected static function booted(): void
    {
        // The roster copies the subject code so the database can enforce one class per subject.
        static::updated(function (self $class) {
            if ($class->wasChanged('subject_code')) {
                DB::table('class_student')
                    ->where('school_class_id', $class->id)
                    ->update(['subject_code' => $class->subject_code]);
            }
        });
    }

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'class_student', 'school_class_id', 'student_id')
            ->withPivot('subject_code');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ExamSession::class);
    }

    /**
     * Put a student in this class. Throws a QueryException if they already have a class for the
     * same subject (unique on student_id + subject_code); the service turns that into a 409.
     */
    public function addStudent(User $student): void
    {
        $this->students()->attach($student->id, ['subject_code' => $this->subject_code]);
    }

    /** "IGCSE Economics, Batch A" -> "Batch A". */
    public function batch(): string
    {
        return trim(explode(',', $this->name)[1] ?? $this->name);
    }
}

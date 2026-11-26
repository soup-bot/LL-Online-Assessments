<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'role', 'honorific', 'is_active'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_active' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    public function isTutor(): bool
    {
        return $this->role === Role::Tutor;
    }

    public function isStudent(): bool
    {
        return $this->role === Role::Student;
    }

    public function firstName(): string
    {
        return explode(' ', trim($this->name))[0];
    }

    /** "Aishath Rasheed" -> "AR". */
    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->name), -1, PREG_SPLIT_NO_EMPTY);
        if (count($parts) === 0) {
            return '?';
        }
        if (count($parts) === 1) {
            return mb_strtoupper(mb_substr($parts[0], 0, 2));
        }

        return mb_strtoupper(mb_substr($parts[0], 0, 1).mb_substr($parts[count($parts) - 1], 0, 1));
    }

    /** "Ms Aishath" for a teacher with a title, otherwise the full name (used in student-facing copy). */
    public function teacherLabel(): string
    {
        return $this->honorific ? $this->honorific.' '.$this->firstName() : $this->name;
    }

    /**
     * Where a student sits, for the greeting under their name: the class itself when there is one,
     * or "Economics (Batch A) · Business Studies (Batch C)" when they take several subjects.
     */
    public function classLabel(): string
    {
        $classes = $this->classes;
        if ($classes->count() <= 1) {
            return $classes->first()?->name ?? '';
        }

        return $classes->map(fn (SchoolClass $c) => $c->subjectShort().' ('.$c->batch().')')->implode(' · ');
    }

    /** Classes this teacher teaches. */
    public function classesTaught(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'tutor_id');
    }

    /** Classes this student sits in: several subjects, one class in each. */
    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(SchoolClass::class, 'class_student', 'student_id', 'school_class_id')
            ->withPivot('subject_code');
    }

    public function exams(): HasMany
    {
        return $this->hasMany(Exam::class, 'owner_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class, 'student_id');
    }
}

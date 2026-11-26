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

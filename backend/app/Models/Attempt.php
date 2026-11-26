<?php

namespace App\Models;

use App\Enums\AttemptStatus;
use App\Enums\SubmitReason;
use Database\Factories\AttemptFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Attempt extends Model
{
    /** @use HasFactory<AttemptFactory> */
    use HasFactory;

    protected $fillable = [
        'exam_session_id', 'student_id', 'started_at', 'deadline_at', 'submitted_at', 'submit_reason', 'status',
        'violation_count', 'total_score', 'overall_comment', 'marked_by', 'marked_at', 'result_viewed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'deadline_at' => 'datetime',
            'submitted_at' => 'datetime',
            'marked_at' => 'datetime',
            'result_viewed_at' => 'datetime',
            'submit_reason' => SubmitReason::class,
            'status' => AttemptStatus::class,
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ExamSession::class, 'exam_session_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(Violation::class);
    }

    public function isInProgress(): bool
    {
        return $this->status === AttemptStatus::InProgress;
    }
}

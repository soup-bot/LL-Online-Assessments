<?php

namespace App\Models;

use App\Enums\SessionStatus;
use Database\Factories\ExamSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamSession extends Model
{
    /** @use HasFactory<ExamSessionFactory> */
    use HasFactory;

    protected $fillable = ['exam_id', 'school_class_id', 'status', 'opened_at', 'closed_at', 'results_released_at'];

    protected function casts(): array
    {
        return [
            'status' => SessionStatus::class,
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'results_released_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(Attempt::class);
    }

    public function isReleased(): bool
    {
        return $this->results_released_at !== null;
    }
}

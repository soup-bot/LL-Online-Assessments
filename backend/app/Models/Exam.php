<?php

namespace App\Models;

use App\Enums\ExamStatus;
use App\Enums\QuestionOrder;
use Database\Factories\ExamFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends Model
{
    /** @use HasFactory<ExamFactory> */
    use HasFactory;

    protected $fillable = ['owner_id', 'title', 'time_limit_minutes', 'question_order', 'rules', 'status', 'published_at'];

    protected function casts(): array
    {
        return [
            'question_order' => QuestionOrder::class,
            'status' => ExamStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('position');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ExamSession::class);
    }

    public function isDraft(): bool
    {
        return $this->status === ExamStatus::Draft;
    }

    public function scopeOwnedBy($query, User $user)
    {
        return $query->where('owner_id', $user->id);
    }
}

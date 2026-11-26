<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Answer extends Model
{
    protected $fillable = [
        'attempt_id', 'question_id', 'response', 'flagged', 'awarded_marks', 'feedback', 'marking_ticks', 'client_saved_at',
    ];

    protected function casts(): array
    {
        return [
            'flagged' => 'boolean',
            'marking_ticks' => 'array',
            'client_saved_at' => 'datetime:Y-m-d\TH:i:s.v',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}

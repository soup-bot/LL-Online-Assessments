<?php

namespace App\Models;

use App\Enums\QuestionKind;
use Database\Factories\QuestionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Question extends Model
{
    /** @use HasFactory<QuestionFactory> */
    use HasFactory;

    protected $fillable = ['exam_id', 'position', 'kind', 'prompt', 'points', 'options', 'answer_key', 'approved'];

    /** The answer key must never leave the server in a student response. */
    protected $hidden = ['answer_key'];

    /** Changing any of these removes the teacher's approval. */
    private const CONTENT = ['kind', 'prompt', 'points', 'options', 'answer_key'];

    protected function casts(): array
    {
        return [
            'kind' => QuestionKind::class,
            'options' => 'array',
            'answer_key' => 'array',
            'approved' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $question) {
            if ($question->exists && $question->isDirty(self::CONTENT) && ! $question->isDirty('approved')) {
                $question->approved = false;
            }
        });
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }
}

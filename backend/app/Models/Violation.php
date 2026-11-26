<?php

namespace App\Models;

use App\Enums\ViolationKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Violation extends Model
{
    public $timestamps = false;

    protected $fillable = ['attempt_id', 'kind', 'occurred_at'];

    protected function casts(): array
    {
        return [
            'kind' => ViolationKind::class,
            'occurred_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class);
    }
}

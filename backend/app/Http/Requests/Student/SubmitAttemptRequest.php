<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubmitAttemptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // The screen sends `timeout` when its own timer reached zero. The server still checks the real deadline.
            'reason' => ['sometimes', Rule::in(['manual', 'timeout'])],
        ];
    }
}

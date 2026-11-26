<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;

class SaveAnswerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // mcq: the option key ("A"), true_false: "true" or "false", otherwise the typed text. Send null to clear.
            'response' => ['sometimes', 'nullable', 'string', 'max:6000'],
            // The student's "come back to this" flag.
            'flagged' => ['sometimes', 'boolean'],
            // When the student typed it. A save older than the stored one is ignored.
            'clientSavedAt' => ['sometimes', 'nullable', 'date'],
        ];
    }
}

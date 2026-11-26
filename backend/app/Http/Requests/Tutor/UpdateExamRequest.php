<?php

namespace App\Http\Requests\Tutor;

use App\Enums\Navigation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:120'],
            // Minutes each student gets from the moment they start.
            'timeLimitMinutes' => ['sometimes', 'integer', 'between:1,600'],
            // any: students move freely. in_order: one way only.
            'navigation' => ['sometimes', Rule::enum(Navigation::class)],
            // Shown on the cover page under the standard rules.
            'rules' => ['sometimes', 'nullable', 'string', 'max:5000'],
            // The teacher's classes that will sit this exam. Only drafts can change them.
            'classIds' => ['sometimes', 'array'],
            'classIds.*' => ['integer'],
        ];
    }

    public function messages(): array
    {
        return ['timeLimitMinutes.between' => 'Time limit must be between 1 and 600 minutes.'];
    }
}

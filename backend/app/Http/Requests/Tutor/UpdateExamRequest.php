<?php

namespace App\Http\Requests\Tutor;

use App\Enums\QuestionOrder;
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
            // in_order: everyone sees the teacher's order. random: each student gets their own order.
            'questionOrder' => ['sometimes', Rule::enum(QuestionOrder::class)],
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

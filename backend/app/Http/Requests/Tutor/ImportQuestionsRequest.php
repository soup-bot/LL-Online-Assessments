<?php

namespace App\Http\Requests\Tutor;

use App\Enums\QuestionKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ImportQuestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = ['questions' => ['required', 'array', 'min:1', 'max:200']];
        foreach ([
            'kind' => ['required', Rule::enum(QuestionKind::class)],
            'prompt' => ['required', 'string', 'max:4000'],
            'points' => ['required', 'integer', 'between:1,100'],
            // mcq: the four option texts, in A to D order.
            'options' => ['sometimes', 'nullable', 'array', 'max:4'],
            'options.*' => ['nullable', 'string', 'max:1000'],
            // mcq: "A" to "D".
            'correct' => ['sometimes', 'nullable', 'string', 'in:A,B,C,D'],
            // true_false: null until chosen.
            'trueFalse' => ['sometimes', 'nullable', 'boolean'],
            // fill_blank: every accepted answer.
            'accepted' => ['sometimes', 'nullable', 'array', 'max:50'],
            'accepted.*' => ['nullable', 'string', 'max:500'],
            // written: the marking checklist, never shown to students.
            'markingPoints' => ['sometimes', 'nullable', 'array', 'max:50'],
            'markingPoints.*' => ['nullable', 'string', 'max:1000'],
            'approved' => ['sometimes', 'boolean'],
        ] as $field => $rule) {
            $rules["questions.*.{$field}"] = $field === 'prompt' ? ['nullable', 'string', 'max:4000'] : ($field === 'points' ? ['nullable', 'integer', 'between:1,100'] : $rule);
        }

        return $rules;
    }
}

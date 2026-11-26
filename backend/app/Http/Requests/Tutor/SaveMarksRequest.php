<?php

namespace App\Http\Requests\Tutor;

use Illuminate\Foundation\Http\FormRequest;

class SaveMarksRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // One entry for every written question.
            'answers' => ['required', 'array'],
            'answers.*.questionId' => ['required', 'integer'],
            // Whole marks, from 0 up to the question's points.
            'answers.*.awarded' => ['required', 'integer', 'min:0'],
            'answers.*.feedback' => ['nullable', 'string', 'max:2000'],
            // Indexes of the marking points the answer met.
            'answers.*.ticks' => ['nullable', 'array'],
            'answers.*.ticks.*' => ['integer', 'min:0'],
            'overallComment' => ['nullable', 'string', 'max:4000'],
        ];
    }
}

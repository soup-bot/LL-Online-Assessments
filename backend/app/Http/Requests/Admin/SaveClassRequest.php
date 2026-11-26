<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SaveClassRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // "IGCSE Economics, Batch A": the part before the comma is the subject, after it the batch.
            'name' => ['required', 'string', 'max:255'],
            'subjectCode' => ['required', 'string', 'max:10'],
            'grade' => ['required', 'integer', 'between:1,13'],
            'tutorId' => ['required', 'integer'],
            // The whole roster. A student can be in several classes but only one for each subject.
            'studentIds' => ['sometimes', 'array'],
            'studentIds.*' => ['integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Enter a class name.',
            'subjectCode.required' => 'Enter a subject code.',
            'grade.between' => 'Grade must be between 1 and 13.',
            'grade.integer' => 'Grade must be between 1 and 13.',
            'grade.required' => 'Grade must be between 1 and 13.',
            'tutorId.required' => 'Choose a teacher for this class.',
        ];
    }
}

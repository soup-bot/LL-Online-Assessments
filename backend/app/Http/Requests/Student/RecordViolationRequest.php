<?php

namespace App\Http\Requests\Student;

use App\Enums\ViolationKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordViolationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // hidden: switched tab or app. blur: clicked outside the exam window.
            'kind' => ['sometimes', Rule::enum(ViolationKind::class)],
        ];
    }
}

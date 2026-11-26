<?php

namespace App\Http\Requests\Tutor;

use Illuminate\Foundation\Http\FormRequest;

class ApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // True when the teacher has checked the answer key. Needs a complete key.
        return ['approved' => ['required', 'boolean']];
    }
}

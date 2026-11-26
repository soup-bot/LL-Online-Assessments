<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // The sign-in address. Not case sensitive, and no two accounts may share one.
            'email' => ['required', 'email:filter', 'max:255'],
            'role' => ['required', Rule::enum(Role::class)],
            // Optional. A new account without one gets the default password from the server's settings.
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:100'],
            // false deactivates the account and signs it out everywhere.
            'isActive' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Enter a name.',
            'email.required' => 'Enter a valid email address.',
            'email.email' => 'Enter a valid email address.',
            'role.required' => 'Choose a role.',
            'password.min' => 'A password needs at least 8 characters.',
        ];
    }
}

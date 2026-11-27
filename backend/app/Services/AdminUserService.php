<?php

namespace App\Services;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Models\Attempt;
use App\Models\AuditLog;
use App\Models\Exam;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Creating and editing accounts. Accounts are deactivated, never deleted, so old results keep their owner. */
class AdminUserService
{
    /**
     * @param  array{name: string, email: string, role: string, password?: ?string, isActive?: bool}  $input
     */
    public function save(User $admin, ?User $user, array $input): User
    {
        $name = trim($input['name']);
        $email = Str::lower(trim($input['email']));
        $role = Role::from($input['role']);

        if ($name === '') {
            throw ApiException::validation('Enter a name.');
        }
        $taken = User::whereRaw('lower(email) = ?', [$email])->when($user, fn ($q) => $q->where('id', '!=', $user->id))->exists();
        if ($taken) {
            throw ApiException::validation('Someone already uses that email address.');
        }

        return DB::transaction(function () use ($admin, $user, $name, $email, $role, $input) {
            if ($user === null) {
                $created = User::create([
                    'name' => $name,
                    'email' => $email,
                    'role' => $role,
                    'password' => $input['password'] ?? config('exam.default_password'),
                    'is_active' => $input['isActive'] ?? true,
                ]);
                AuditLog::record($admin, 'user.create', $created, ['role' => $role->value]);

                return $created;
            }

            $this->guardRoleChange($admin, $user, $role);
            if (array_key_exists('isActive', $input) && ! $input['isActive'] && $user->id === $admin->id) {
                throw ApiException::validation("You can't deactivate your own account.");
            }

            $user->fill(['name' => $name, 'email' => $email, 'role' => $role]);
            if (! empty($input['password'])) {
                $user->password = $input['password'];
            }
            if (array_key_exists('isActive', $input)) {
                $user->is_active = (bool) $input['isActive'];
            }
            if ($role !== Role::Tutor) {
                $user->honorific = null;
            }
            $user->save();

            // A deactivated account is signed out everywhere.
            if (! $user->is_active) {
                $user->tokens()->delete();
                // ...including any browser session they have open.
                if (config('session.driver') === 'database') {
                    DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
                }
            }
            AuditLog::record($admin, 'user.update', $user, ['role' => $role->value, 'active' => $user->is_active]);

            return $user;
        });
    }

    /** A role can't change out from under work that belongs to the old one. */
    private function guardRoleChange(User $admin, User $user, Role $new): void
    {
        if ($user->role === $new) {
            return;
        }
        if ($user->id === $admin->id) {
            throw ApiException::validation("You can't remove your own admin access.");
        }
        if ($user->role === Role::Tutor) {
            if (SchoolClass::where('tutor_id', $user->id)->exists()) {
                throw ApiException::conflict('This teacher still has classes. Give those classes another teacher first.');
            }
            if (Exam::where('owner_id', $user->id)->exists()) {
                throw ApiException::conflict('This teacher still owns exams, so their role can\'t change.');
            }
        }
        if ($user->role === Role::Student) {
            if (Attempt::where('student_id', $user->id)->exists()) {
                throw ApiException::conflict('This student has exam attempts, so their role can\'t change.');
            }
            $user->classes()->detach();
        }
    }
}

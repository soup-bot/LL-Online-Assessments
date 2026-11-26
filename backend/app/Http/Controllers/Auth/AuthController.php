<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /** Same wording for every way a sign-in can fail, so accounts cannot be probed. */
    /** A real bcrypt hash of nothing useful, checked when the email is unknown. */
    private const DUMMY_HASH = '$2y$12$4sk8.Mq0wJ9tjpmvU9ujfOqFTN2x1rFoKBmxWVKmC4B0Qohk3ajbO';

    private const BAD_CREDENTIALS = "That email and password don't match. Please try again.";

    /**
     * Sign in
     *
     * Trade an email and password for a Bearer token. The token expires after 12 hours.
     * A wrong password, an unknown email and a deactivated account all return the same
     * 422 `validation` error, so nobody can tell which accounts exist. Limited to 5 attempts
     * a minute per email and address (then 429 `throttled`).
     *
     * @unauthenticated
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', Str::lower(trim($data['email'])))->first();

        // Always do one password check, even for an unknown email, so timing gives nothing away.
        $valid = Hash::check($data['password'], $user->password ?? self::DUMMY_HASH);

        if (! $user || ! $valid || ! $user->is_active) {
            // 422, not 401: a wrong password must not look like an expired session.
            throw ApiException::validation(self::BAD_CREDENTIALS);
        }

        return response()->json([
            'token' => $user->createToken('web')->plainTextToken,
            'user' => (new UserResource($user))->resolve(),
        ]);
    }

    /**
     * Sign out
     *
     * Revokes the token used for this request.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Current user
     *
     * The signed-in user: `{ id, name, email, role, honorific? }`. Role is `student`, `tutor` or `admin`.
     */
    public function me(Request $request): JsonResponse
    {
        // A plain object, not wrapped in { data }, to match the frontend's User type.
        return response()->json((new UserResource($request->user()))->resolve());
    }
}

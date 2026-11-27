<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
     * From the web app this starts a session: the reply sets an httpOnly cookie and carries just `{ user }`
     * (call `GET /sanctum/csrf-cookie` first and send the `X-XSRF-TOKEN` header, as Laravel Sanctum describes).
     * From any other client it returns `{ token, user }`: send the token as a Bearer header. It expires after 12 hours.
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

        // The web app (a request from FRONTEND_URL) gets a session cookie that scripts cannot read. Any other
        // client gets a Bearer token to keep and send itself.
        if ($request->hasSession()) {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();

            return response()->json(['user' => (new UserResource($user))->resolve()]);
        }

        return response()->json([
            'token' => $user->createToken('web')->plainTextToken,
            'user' => (new UserResource($user))->resolve(),
        ]);
    }

    /**
     * Sign out
     *
     * Ends the session (web app) or revokes the token used for this request (any other client).
     */
    public function logout(Request $request): JsonResponse
    {
        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        } else {
            $request->user()->currentAccessToken()->delete();
        }

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

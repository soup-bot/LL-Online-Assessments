<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    /** Authenticated requests in one test share a guard, so forget the previous user first. */
    private function as(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private const BAD = "That email and password don't match. Please try again.";

    public function test_login_returns_a_token_and_the_user(): void
    {
        $user = User::factory()->tutor()->create(['email' => 'aishath@ll.test', 'honorific' => 'Ms']);

        $this->postJson('/api/v1/auth/login', ['email' => 'aishath@ll.test', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']])
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'tutor')
            ->assertJsonPath('user.honorific', 'Ms');
    }

    public function test_email_is_not_case_sensitive(): void
    {
        User::factory()->create(['email' => 'hawwa@ll.test']);

        $this->postJson('/api/v1/auth/login', ['email' => ' Hawwa@LL.test ', 'password' => 'password'])->assertOk();
    }

    public function test_wrong_password_and_unknown_email_look_the_same(): void
    {
        User::factory()->create(['email' => 'hawwa@ll.test']);

        $wrong = $this->postJson('/api/v1/auth/login', ['email' => 'hawwa@ll.test', 'password' => 'nope']);
        $unknown = $this->postJson('/api/v1/auth/login', ['email' => 'nobody@ll.test', 'password' => 'password']);

        foreach ([$wrong, $unknown] as $response) {
            $response->assertStatus(422)->assertJson(['code' => 'validation', 'message' => self::BAD]);
        }
    }

    public function test_a_deactivated_account_cannot_sign_in(): void
    {
        User::factory()->create(['email' => 'old@ll.test', 'is_active' => false]);

        $this->postJson('/api/v1/auth/login', ['email' => 'old@ll.test', 'password' => 'password'])
            ->assertStatus(422)
            ->assertJson(['message' => self::BAD]);
    }

    public function test_missing_fields_are_a_validation_error(): void
    {
        $this->postJson('/api/v1/auth/login', [])->assertStatus(422)->assertJsonPath('code', 'validation');
    }

    public function test_the_sixth_attempt_in_a_minute_is_throttled(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'x@ll.test', 'password' => 'bad'])->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'x@ll.test', 'password' => 'bad'])
            ->assertStatus(429)
            ->assertJson(['code' => 'throttled']);
    }

    public function test_logout_revokes_the_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    /** A request that looks like it came from the web app: the Origin Sanctum treats as stateful. */
    private function fromWebApp(): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/']);
    }

    /** The session cookie a response set, to send back on the next request like a browser would. */
    private function sessionCookieOf(\Illuminate\Testing\TestResponse $response): string
    {
        $cookie = collect($response->headers->getCookies())->first(fn ($c) => $c->getName() === config('session.cookie'));
        $this->assertNotNull($cookie, 'the reply should set a session cookie');
        $this->assertTrue($cookie->isHttpOnly(), 'scripts must not be able to read the session cookie');

        return $cookie->getValue();
    }

    public function test_the_web_app_signs_in_with_an_httponly_cookie_and_gets_no_token(): void
    {
        User::factory()->tutor()->create(['email' => 'aishath@ll.test']);

        $response = $this->fromWebApp()->postJson('/api/v1/auth/login', ['email' => 'aishath@ll.test', 'password' => 'password']);

        $response->assertOk()->assertJsonPath('user.role', 'tutor')->assertJsonMissingPath('token');
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->sessionCookieOf($response);
    }

    public function test_the_session_cookie_signs_later_requests_in_and_logout_ends_it(): void
    {
        $user = User::factory()->create(['email' => 'sam@ll.test']);
        $cookie = $this->sessionCookieOf($this->fromWebApp()->postJson('/api/v1/auth/login', ['email' => 'sam@ll.test', 'password' => 'password']));
        $name = config('session.cookie');

        $this->fromWebApp()->withUnencryptedCookie($name, $cookie)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('id', $user->id);
        $this->fromWebApp()->withUnencryptedCookie($name, $cookie)->postJson('/api/v1/auth/logout')->assertOk();

        $this->fromWebApp()->withUnencryptedCookie($name, $cookie)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_a_wrong_password_from_the_web_app_gets_no_session(): void
    {
        User::factory()->create(['email' => 'sam@ll.test']);

        $this->fromWebApp()->postJson('/api/v1/auth/login', ['email' => 'sam@ll.test', 'password' => 'nope'])->assertStatus(422);
        $this->fromWebApp()->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_deactivating_a_user_ends_their_browser_session_too(): void
    {
        config(['session.driver' => 'database']);
        $admin = User::factory()->admin()->create();
        $student = User::factory()->create(['email' => 'sam@ll.test']);
        \Illuminate\Support\Facades\DB::table('sessions')->insert([
            'id' => 'abc', 'user_id' => $student->id, 'payload' => '', 'last_activity' => now()->timestamp,
        ]);

        $this->as($admin->createToken('t')->plainTextToken)
            ->patchJson("/api/v1/admin/users/{$student->id}", ['name' => $student->name, 'email' => $student->email, 'role' => 'student', 'isActive' => false])
            ->assertOk();

        $this->assertDatabaseMissing('sessions', ['user_id' => $student->id]);
    }

    public function test_the_whole_api_has_a_generous_limit_counted_per_user(): void
    {
        config(['exam.api_per_minute' => 3]);
        $one = User::factory()->create();
        $two = User::factory()->create();
        $tokenOne = $one->createToken('t')->plainTextToken;
        $tokenTwo = $two->createToken('t')->plainTextToken;

        foreach (range(1, 3) as $_) {
            $this->as($tokenOne)->getJson('/api/v1/auth/me')->assertOk();
        }
        $this->as($tokenOne)->getJson('/api/v1/auth/me')->assertStatus(429)->assertJsonPath('code', 'throttled');

        // someone else on the same address is not held up by it
        $this->as($tokenTwo)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_me_returns_the_signed_in_user(): void
    {
        $user = User::factory()->admin()->create();

        $this->withToken($user->createToken('web')->plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJson(['id' => $user->id, 'role' => 'admin'])
            ->assertJsonMissingPath('password');
    }

    public function test_each_area_is_for_its_own_role(): void
    {
        Route::middleware(['auth:sanctum', 'role:tutor,admin'])->get('/api/v1/_test/staff', fn () => ['ok' => true]);
        Route::middleware(['auth:sanctum', 'role:student'])->get('/api/v1/_test/student', fn () => ['ok' => true]);

        $student = User::factory()->create()->createToken('t')->plainTextToken;
        $tutor = User::factory()->tutor()->create()->createToken('t')->plainTextToken;

        $this->getJson('/api/v1/_test/staff')->assertUnauthorized();
        $this->as($student)->getJson('/api/v1/_test/staff')->assertForbidden()->assertJson(['code' => 'forbidden']);
        $this->as($tutor)->getJson('/api/v1/_test/staff')->assertOk();
        $this->as($tutor)->getJson('/api/v1/_test/student')->assertForbidden();
        $this->as($student)->getJson('/api/v1/_test/student')->assertOk();
    }

    public function test_a_deactivated_user_is_turned_away_from_role_routes(): void
    {
        Route::middleware(['auth:sanctum', 'role:student'])->get('/api/v1/_test/student', fn () => ['ok' => true]);
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $user->update(['is_active' => false]);

        $this->withToken($token)->getJson('/api/v1/_test/student')->assertForbidden();
    }
}

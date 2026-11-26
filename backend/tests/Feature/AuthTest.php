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

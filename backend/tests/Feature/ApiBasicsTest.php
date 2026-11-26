<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiBasicsTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_answers_under_the_versioned_prefix(): void
    {
        $this->getJson('/api/v1/health')->assertOk()->assertJson(['status' => 'ok']);
    }

    public function test_unknown_routes_use_the_error_shape(): void
    {
        $this->getJson('/api/v1/nope')
            ->assertNotFound()
            ->assertJson(['code' => 'not_found'])
            ->assertJsonStructure(['code', 'message', 'errors']);
    }

    public function test_missing_token_is_unauthorized_in_the_same_shape(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJson(['code' => 'unauthorized']);
    }

    public function test_a_valid_token_reaches_the_protected_route(): void
    {
        $user = User::factory()->create();

        $this->withToken($user->createToken('test')->plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJson(['email' => $user->email]);
    }
}

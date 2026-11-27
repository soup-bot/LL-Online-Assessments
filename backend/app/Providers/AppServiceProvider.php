<?php

namespace App\Providers;

use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Responses are plain objects, not wrapped in { data }, to match the frontend's types.
        JsonResource::withoutWrapping();

        // Five sign-in attempts a minute for one email from one address.
        // The docs page gets an Authorize button for the Bearer token returned by /auth/login.
        Scramble::afterOpenApiGenerated(function (OpenApi $openApi) {
            $openApi->secure(SecurityScheme::http('bearer'));
        });

        // The whole API: generous, per signed-in user (or per address when nobody is signed in).
        RateLimiter::for('api', function (Request $request) {
            $user = $request->user('sanctum');

            return $user
                ? Limit::perMinute((int) config('exam.api_per_minute'))->by('user:'.$user->id)
                : Limit::perMinute((int) config('exam.api_guest_per_minute'))->by('ip:'.$request->ip());
        });

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip()));
    }
}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>LL Assessments API</title>
    <style>
        body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #fbfaf8; color: #1f2433;
               font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
        main { max-width: 440px; padding: 24px; display: flex; flex-direction: column; gap: 10px; }
        h1 { margin: 0; font-size: 28px; }
        p { margin: 0; line-height: 1.6; color: #5e6372; }
        a { color: #5236d6; }
        .ok { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #187a4a; }
        .ok::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: #187a4a; }
    </style>
</head>
<body>
    <main>
        <span class="ok">Running</span>
        <h1>LL Assessments API</h1>
        <p>This is the server behind the exam app. There is nothing to see here.</p>
        @if ($app = config('cors.allowed_origins.0'))
            <p>Open the app at <a href="{{ $app }}">{{ $app }}</a>.</p>
        @endif
        @if (app()->environment('local'))
            <p>API reference: <a href="/docs/api">/docs/api</a></p>
        @endif
    </main>
</body>
</html>

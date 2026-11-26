<?php

/*
 * Rules and limits shared by every exam screen. The values mirror frontend/lib/config.ts and
 * frontend/lib/grading.ts: change them in both places, or serve these to the app.
 */
return [
    // Third violation submits the exam automatically.
    'max_violations' => 3,

    // How long after the deadline a final save is still accepted.
    'save_grace_ms' => 5000,

    // Highest band first. A band applies from `min` percent upwards.
    'grade_bands' => [
        'A' => 80,
        'B' => 65,
        'C' => 50,
        'D' => 40,
        'U' => 0,
    ],

    // Shown on every cover page, above the exam's own rules.
    'global_rules' => [
        [
            'id' => 'violations',
            'text' => 'Switching tabs, switching apps or leaving the exam window counts as a violation. You will be warned each time; after 3 violations your exam is submitted automatically.',
        ],
        [
            'id' => 'autosave',
            'text' => 'Your answers save automatically. Stay connected to the internet while you work.',
        ],
        [
            'id' => 'timer',
            'text' => 'When the timer reaches zero your exam is submitted with whatever you have saved.',
        ],
    ],

    // Password given to a new account when the admin doesn't choose one. Change it in .env for any real deployment.
    'default_password' => env('DEFAULT_USER_PASSWORD', 'password'),

    // List endpoints: default and largest page size.
    'per_page' => 10,
    'max_per_page' => 100,
];

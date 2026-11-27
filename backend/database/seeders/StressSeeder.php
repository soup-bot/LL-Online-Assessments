<?php

namespace Database\Seeders;

use App\Models\User;
use Database\Seeders\Data\QuestionBank;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * A large school for stress-testing lists and paging: 11 more classes (one with 100 students),
 * 35 more exams in every state, and about 1,700 attempts with some 570 waiting to be marked.
 * It mirrors frontend/lib/mock/seed-large.ts. Run: php artisan db:seed --class=StressSeeder
 */
class StressSeeder extends Seeder
{
    private const FIRST = ['Aminath', 'Mohamed', 'Fathimath', 'Ahmed', 'Aishath', 'Ibrahim', 'Mariyam', 'Hussain', 'Khadheeja', 'Ali', 'Zahra', 'Yoosuf', 'Shaaira', 'Imran', 'Nuha', 'Rayyan', 'Hawwa', 'Adam', 'Laila', 'Sinan', 'Raniya', 'Ziyad', 'Eesa', 'Naila', 'Shifaz', 'Maeesha', 'Ismail', 'Sofa', 'Rishwan', 'Dhiyana'];

    private const LAST = ['Rasheed', 'Nashid', 'Zayan', 'Leena', 'Shareef', 'Faisal', 'Naseer', 'Waheed', 'Hameed', 'Latheef', 'Saeed', 'Adnan', 'Rizwan', 'Shiyam', 'Mohamed', 'Abdulla', 'Ismail', 'Zahir', 'Moosa', 'Fahmy'];

    /** name, subject code, grade, teacher email, size, subject key */
    private const CLASSES = [
        ['IGCSE Economics, Batch C', '0455', 10, 'aishath@ll.test', 24, 'econ'],
        ['IGCSE Economics, Batch D', '0455', 10, 'aishath@ll.test', 18, 'econ'],
        ['IGCSE Economics, Batch E', '0455', 11, 'aishath@ll.test', 14, 'econ'],
        ['IGCSE Economics, Batch F', '0455', 11, 'aishath@ll.test', 12, 'econ'],
        ['IGCSE Business Studies, Batch A', '0450', 10, 'aishath@ll.test', 30, 'biz'],
        ['IGCSE Business Studies, Batch B', '0450', 10, 'aishath@ll.test', 22, 'biz'],
        ['IGCSE Business Studies, Batch C', '0450', 11, 'aishath@ll.test', 12, 'biz'],
        ['IGCSE Business Studies, Batch D', '0450', 11, 'aishath@ll.test', 16, 'biz'],
        ['IGCSE Business Studies, Batch E', '0450', 11, 'aishath@ll.test', 100, 'biz'],
        ['IGCSE Accounting, Batch A', '0452', 10, 'ali@ll.test', 16, 'acc'],
        ['IGCSE Accounting, Batch B', '0452', 10, 'ali@ll.test', 20, 'acc'],
    ];

    private const TOPICS = [
        'econ' => ['Unit 1 Quiz: The Basic Economic Problem', 'Unit 2 Quiz: Allocation of Resources', 'Unit 4 Test: Government Intervention', 'Unit 5 Test: The Macroeconomy', 'Unit 6 Test: Inflation and Unemployment', 'Revision Quiz: Elasticity', 'Revision Quiz: Market Failure', 'Term 1 Exam: Economics', 'Term 2 Exam: Economics', 'Data Response Practice 1', 'Data Response Practice 2', 'Mock Paper 1: Economics', 'Mock Paper 2: Economics', 'Trade and Globalisation Test'],
        'biz' => ['Unit 1 Quiz: Understanding Business', 'Unit 2 Test: People in Business', 'Unit 3 Test: Marketing', 'Unit 4 Test: Operations', 'Unit 5 Test: Finance', 'Revision Quiz: Business Objectives', 'Revision Quiz: Cash Flow', 'Term 1 Exam: Business Studies', 'Term 2 Exam: Business Studies', 'Case Study Practice 1', 'Case Study Practice 2', 'Mock Paper 1: Business', 'Mock Paper 2: Business', 'Entrepreneurship Test'],
        'acc' => ['Unit 1 Quiz: Fundamentals', 'Unit 2 Test: Double Entry', 'Unit 3 Test: Final Accounts', 'Term 1 Exam: Accounting', 'Revision Quiz: Depreciation', 'Mock Paper 1: Accounting'],
    ];

    private const PLANS = ['released', 'marking', 'live', 'released', 'ready', 'marking', 'draft', 'released', 'live', 'marking', 'released', 'ready', 'marking'];

    private const WRITTEN = [
        'It would change because people respond to the price, so the amount bought moves in the opposite direction.',
        'One benefit is higher output, because workers get better at one task. A cost is that the work can become boring.',
        'Firms want to grow to lower their average costs and to reach more customers, which should raise profit.',
        'Interest rates go up so borrowing is more expensive, which means people spend less and save more.',
        'The business records this so that the figures balance and mistakes are easier to find.',
    ];

    private array $classes = [];

    private array $answers = [];

    public function run(): void
    {
        $this->call(DemoSeeder::class);
        mt_srand(20251125);

        DB::transaction(function () {
            $this->makeClasses();
            $this->makeExams();
        });
    }

    private function rand(): float
    {
        return mt_rand() / mt_getrandmax();
    }

    private function pick(array $list): mixed
    {
        return $list[intdiv(mt_rand(0, 9999) * count($list), 10000)];
    }

    private function makeClasses(): void
    {
        $hash = Hash::make('password');
        $counter = 100;

        foreach (self::CLASSES as [$name, $code, $grade, $tutorEmail, $size, $subject]) {
            $tutor = User::where('email', $tutorEmail)->value('id');
            $classId = DB::table('school_classes')->insertGetId([
                'name' => $name, 'subject_code' => $code, 'grade' => $grade, 'tutor_id' => $tutor, 'created_at' => now(), 'updated_at' => now(),
            ]);

            $studentIds = [];
            for ($i = 0; $i < $size; $i++) {
                $n = $counter++;
                $studentIds[] = DB::table('users')->insertGetId([
                    'name' => self::FIRST[($n * 7) % count(self::FIRST)].' '.self::LAST[($n * 11 + 3) % count(self::LAST)],
                    'email' => "student{$n}@ll.test", 'password' => $hash, 'role' => 'student', 'is_active' => true,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('class_student')->insert(array_map(
                fn ($id) => ['school_class_id' => $classId, 'student_id' => $id, 'subject_code' => $code, 'created_at' => now()],
                $studentIds,
            ));

            $this->classes[] = ['id' => $classId, 'subject' => $subject, 'tutor' => $tutor, 'students' => $studentIds, 'size' => $size];
        }
    }

    private function makeExams(): void
    {
        $demoClassIds = DB::table('school_classes')->whereIn('name', ['IGCSE Economics, Batch A', 'IGCSE Economics, Batch B'])->pluck('id')->all();
        $aishath = User::where('email', 'aishath@ll.test')->value('id');
        $ali = User::where('email', 'ali@ll.test')->value('id');
        $n = 0;

        foreach (self::TOPICS['econ'] as $i => $title) {
            $this->makeExam($title, $aishath, 'econ', self::PLANS[$n++ % count(self::PLANS)], $i, 20 + ($i % 4) * 10, $demoClassIds);
        }
        foreach (self::TOPICS['biz'] as $i => $title) {
            $this->makeExam($title, $aishath, 'biz', self::PLANS[($n++ + 3) % count(self::PLANS)], $i, 20 + ($i % 4) * 10, $demoClassIds);
        }
        foreach (self::TOPICS['acc'] as $i => $title) {
            $this->makeExam($title, $ali, 'acc', self::PLANS[($n++ + 5) % count(self::PLANS)], $i, 25, $demoClassIds);
        }
        $this->makeExam('Whole-school Mock Paper (all batches)', $aishath, 'mock', 'live', 0, 60, $demoClassIds);

        foreach (array_chunk($this->answers, 500) as $chunk) {
            DB::table('answers')->insert($chunk);
        }
    }

    private function makeExam(string $title, int $ownerId, string $subject, string $plan, int $k, int $minutes, array $demoClassIds): void
    {
        $published = $plan !== 'draft';
        $examId = DB::table('exams')->insertGetId([
            'owner_id' => $ownerId, 'title' => $title, 'time_limit_minutes' => $minutes, 'question_order' => 'in_order',
            'rules' => 'Calculators are not allowed.', 'status' => $published ? 'published' : 'draft',
            'published_at' => $published ? now()->subDays(30 - $k) : null, 'created_at' => now(), 'updated_at' => now(),
        ]);

        // Drafts: about half the questions approved, so the builder shows partial progress.
        $definitions = QuestionBank::generic($subject === 'mock' ? 'econ' : $subject);
        $questions = [];
        foreach ($definitions as $i => $definition) {
            $definition['approved'] = $published || $i % 2 === 0;
            $row = QuestionBank::attributes($examId, $i + 1, $definition);
            $questions[] = ['id' => DB::table('questions')->insertGetId($row), 'definition' => $definition];
        }

        $targets = match ($subject) {
            'mock' => array_merge($demoClassIds, array_column(array_filter($this->classes, fn ($c) => $c['tutor'] === $ownerId), 'id')),
            'econ' => array_merge($demoClassIds, array_column(array_filter($this->classes, fn ($c) => $c['subject'] === 'econ'), 'id')),
            default => array_column(array_filter($this->classes, fn ($c) => $c['subject'] === $subject), 'id'),
        };
        $byId = array_column($this->classes, null, 'id');

        foreach (array_values($targets) as $ci => $classId) {
            $isDemo = in_array($classId, $demoClassIds, true);
            $status = 'not_open';
            $mode = 'none';
            $releasedAt = null;

            if ($plan === 'released' && ! $isDemo) {
                [$status, $mode, $releasedAt] = ['closed', 'marked', now()->subDays(3 + $k)];
            } elseif ($plan === 'marking' && ! $isDemo) {
                [$status, $mode] = ['closed', 'mixed'];
            } elseif ($plan === 'live' && ! $isDemo && $ci % 3 !== 2) {
                [$status, $mode] = ['open', 'live'];
            } elseif (in_array($plan, ['released', 'marking'], true) && $isDemo) {
                $status = 'closed';
            }

            $sessionId = DB::table('exam_sessions')->insertGetId([
                'exam_id' => $examId, 'school_class_id' => $classId, 'status' => $status,
                'opened_at' => $status === 'not_open' ? null : ($status === 'open' ? now()->subMinutes(25) : now()->subDays(2 + $k)),
                'closed_at' => $status === 'closed' ? now()->subDays(1 + $k) : null,
                'results_released_at' => $releasedAt, 'created_at' => now(), 'updated_at' => now(),
            ]);

            if ($mode === 'none' || ! $published || ! isset($byId[$classId])) {
                continue;
            }

            $class = $byId[$classId];
            $count = $class['size'] > 50 ? min($class['size'], 70) : min($class['size'], 8 + ($k % 5));
            foreach (array_slice($class['students'], 0, $count) as $si => $studentId) {
                $this->makeAttempt($sessionId, $studentId, $questions, $mode, $si, $k, $minutes, $releasedAt !== null);
            }
        }
    }

    private function makeAttempt(int $sessionId, int $studentId, array $questions, string $mode, int $si, int $k, int $minutes, bool $released): void
    {
        $sitting = $mode === 'live' && $si % 5 === 0;
        $started = $sitting ? now()->subMinutes(3 + ($si % 12)) : now()->subDays(2 + $k)->addMinutes($si);
        $toMark = ! $sitting && ($mode === 'live' || ($mode === 'mixed' && $this->rand() < 0.45));
        $state = $sitting ? 'in_progress' : ($toMark ? 'submitted' : 'marked');
        $violations = $this->rand() < 0.12 ? 1 + intdiv(mt_rand(0, 99), 50) : 0;

        $attemptId = DB::table('attempts')->insertGetId([
            'exam_session_id' => $sessionId, 'student_id' => $studentId,
            'started_at' => $started, 'deadline_at' => $started->copy()->addMinutes($minutes),
            'submitted_at' => $sitting ? null : $started->copy()->addMinutes(12 + ($si % 14)),
            'submit_reason' => $sitting ? null : 'manual', 'status' => $state, 'violation_count' => $violations,
            'overall_comment' => $state === 'marked' && $this->rand() < 0.4 ? 'Good work. Keep linking each point back to the question.' : null,
            'result_viewed_at' => $released && $this->rand() < 0.5 ? now()->subDays($k) : null,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        for ($v = 0; $v < $violations; $v++) {
            DB::table('violations')->insert(['attempt_id' => $attemptId, 'kind' => $this->rand() < 0.7 ? 'hidden' : 'blur', 'occurred_at' => $started->copy()->addMinutes(3 + $v * 4)]);
        }

        foreach ($questions as $qi => ['id' => $questionId, 'definition' => $q]) {
            if ($sitting && $qi > 2 + ($si % 3)) {
                continue; // partway through
            }
            [$response, $awarded] = $this->answer($q, $state);
            $this->answers[] = [
                'attempt_id' => $attemptId, 'question_id' => $questionId, 'response' => $response, 'flagged' => $this->rand() < 0.04,
                'awarded_marks' => $sitting ? null : $awarded,
                'feedback' => $state === 'marked' && $q['kind'] === 'written' && $this->rand() < 0.35 ? 'Clear point. Add one more step of explanation.' : null,
                'created_at' => now(), 'updated_at' => now(),
            ];
        }
    }

    /** A believable answer and the marks it earns (null for a written answer still waiting). */
    private function answer(array $q, string $state): array
    {
        switch ($q['kind']) {
            case 'mcq':
                $right = $this->rand() < 0.6;
                $response = $this->rand() < 0.08 ? null : ($right ? $q['correct'] : $this->pick(array_values(array_diff(['A', 'B', 'C', 'D'], [$q['correct']]))));

                return [$response, $response === $q['correct'] ? $q['points'] : 0];
            case 'true_false':
                $response = $this->rand() < 0.08 ? null : ($this->rand() < 0.6 ? ($q['correct'] ? 'true' : 'false') : ($q['correct'] ? 'false' : 'true'));

                return [$response, $response === ($q['correct'] ? 'true' : 'false') ? $q['points'] : 0];
            case 'fill_blank':
                $response = $this->rand() < 0.1 ? null : ($this->rand() < 0.5 ? $q['accepted'][0] : $this->pick(['demand', 'price', 'cost', 'profit']));

                return [$response, $response !== null && in_array($response, $q['accepted'], true) ? $q['points'] : 0];
            default:
                $response = $this->rand() < 0.1 ? null : $this->pick(self::WRITTEN);
                $awarded = $state === 'marked' ? ($response ? min($q['points'], 1 + intdiv(mt_rand(0, 99) * $q['points'], 100)) : 0) : null;

                return [$response, $awarded];
        }
    }
}

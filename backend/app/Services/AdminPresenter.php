<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\Role;
use App\Models\Attempt;
use App\Models\ExamSession;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Builds the JSON the admin screens read (the DTOs in frontend/lib/staff-types.ts). */
class AdminPresenter
{
    public function __construct(private AttemptService $attempts, private TeacherPresenter $teacher) {}

    /** "Teaches Batch A, Batch B", "Batch A", "Economics Batch A, Business Studies Batch C"... */
    private function classesText(User $user): string
    {
        if ($user->role === Role::Admin) {
            return 'All classes';
        }
        if ($user->role === Role::Tutor) {
            $mine = $user->classesTaught->map->batch();

            return $mine->isEmpty() ? 'No classes yet' : 'Teaches '.$mine->implode(', ');
        }
        $classes = $user->classes;

        return match ($classes->count()) {
            0 => 'Not in a class',
            1 => $classes->first()->batch(),
            default => $classes->map(fn (SchoolClass $c) => $c->subjectShort().' '.$c->batch())->implode(', '),
        };
    }

    public function user(User $u): array
    {
        return $this->teacher->person($u) + [
            'email' => $u->email,
            'role' => $u->role->value,
            'isActive' => (bool) $u->is_active,
            'classes' => $this->classesText($u),
        ];
    }

    /**
     * @return array{users: list<array<string, mixed>>, counts: array<string, int>, meta: array<string, int>}
     */
    public function users(?string $search, ?string $role, int $page, int $perPage): array
    {
        $counts = User::selectRaw('role, count(*) as n')->groupBy('role')->pluck('n', 'role');
        $q = trim((string) $search);

        $query = User::query()
            ->when(in_array($role, ['tutor', 'student', 'admin'], true), fn ($x) => $x->where('role', $role))
            ->when($q !== '', fn ($x) => $x->where(fn ($y) => $y->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%")));
        $total = (clone $query)->count();
        $users = $query->orderBy('name')->orderBy('id')->forPage($page, $perPage)->get()->load(['classesTaught', 'classes']);

        return [
            'users' => $users->map(fn (User $u) => $this->user($u))->all(),
            'counts' => ['tutors' => (int) ($counts['tutor'] ?? 0), 'students' => (int) ($counts['student'] ?? 0), 'admins' => (int) ($counts['admin'] ?? 0)],
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $total],
        ];
    }

    public function schoolClass(SchoolClass $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'subjectCode' => $c->subject_code,
            'grade' => (int) $c->grade,
            'tutorId' => $c->tutor_id,
            'students' => $c->students->sortBy('name')->map(fn (User $s) => $this->teacher->person($s))->values()->all(),
        ];
    }

    /**
     * @return array{classes: list<array<string, mixed>>, tutors: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function classes(?string $search, int $page, int $perPage): array
    {
        $q = trim((string) $search);
        $query = SchoolClass::query()->when($q !== '', fn ($x) => $x->where('name', 'like', "%{$q}%")->orWhere('subject_code', 'like', "%{$q}%"));
        $total = (clone $query)->count();
        $classes = $query->with('students')->orderBy('name')->forPage($page, $perPage)->get();

        return [
            'classes' => $classes->map(fn (SchoolClass $c) => $this->schoolClass($c))->all(),
            'tutors' => User::where('role', Role::Tutor->value)->orderBy('name')->get()->map(fn (User $u) => $this->teacher->person($u))->all(),
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $total],
        ];
    }

    /**
     * Students for the class picker, each with the classes they already sit in.
     *
     * @return array{students: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function students(?string $search, int $page, int $perPage): array
    {
        $q = trim((string) $search);
        $query = User::where('role', Role::Student->value)->when($q !== '', fn ($x) => $x->where('name', 'like', "%{$q}%"));
        $total = (clone $query)->count();
        $students = $query->with('classes')->orderBy('name')->orderBy('id')->forPage($page, $perPage)->get();

        return [
            'students' => $students->map(fn (User $s) => $this->teacher->person($s) + [
                'classes' => $s->classes->map(fn (SchoolClass $c) => ['id' => $c->id, 'name' => $c->name, 'subjectCode' => $c->subject_code])->values()->all(),
            ])->all(),
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $total],
        ];
    }

    /**
     * One row per published exam and class, newest exam first.
     *
     * @return array{rows: list<array<string, mixed>>, teachers: list<array<string, mixed>>, classes: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function exams(?int $teacherId, ?int $classId, ?string $status, ?string $search, int $page, int $perPage): array
    {
        $q = mb_strtolower(trim((string) $search));
        $query = ExamSession::query()
            ->whereHas('exam', fn ($e) => $e->where('status', 'published')
                ->when($teacherId, fn ($x) => $x->where('owner_id', $teacherId))
                ->when($q !== '', fn ($x) => $x->where('title', 'like', "%{$q}%")))
            ->when($classId, fn ($x) => $x->where('school_class_id', $classId));

        $this->attempts->expireOverdue((clone $query)->pluck('id'));

        $all = $query->with(['exam.owner', 'schoolClass'])->orderByDesc('exam_id')->orderBy('school_class_id')->get();
        $label = fn (ExamSession $s) => $s->results_released_at ? 'released' : $s->status->value;
        if (in_array($status, ['not_open', 'open', 'closed', 'released'], true)) {
            $all = $all->filter(fn ($s) => $label($s) === $status)->values();
        }
        $total = $all->count();
        $sessions = $all->forPage($page, $perPage)->values();

        $attempts = Attempt::whereIn('exam_session_id', $sessions->pluck('id'))->withSum('answers as score_sum', 'awarded_marks')->get()->groupBy('exam_session_id');
        $students = DB::table('class_student')->whereIn('school_class_id', $sessions->pluck('school_class_id'))->selectRaw('school_class_id, count(*) as n')->groupBy('school_class_id')->pluck('n', 'school_class_id');
        $totals = DB::table('questions')->whereIn('exam_id', $sessions->pluck('exam_id'))->selectRaw('exam_id, sum(points) as pts')->groupBy('exam_id')->pluck('pts', 'exam_id');

        $rows = $sessions->map(function (ExamSession $s) use ($attempts, $students, $totals, $label) {
            $mine = $attempts->get($s->id, collect());
            $marked = $mine->where('status', AttemptStatus::Marked);
            $total = (int) ($totals[$s->exam_id] ?? 0);

            return [
                'sessionId' => $s->id,
                'examId' => $s->exam_id,
                'title' => $s->exam->title,
                'teacher' => $s->exam->owner->name,
                'teacherId' => $s->exam->owner_id,
                'classId' => $s->school_class_id,
                'className' => $s->schoolClass->batch(),
                'status' => $label($s),
                'handedIn' => $mine->where('status', '!=', AttemptStatus::InProgress)->count(),
                'students' => (int) ($students[$s->school_class_id] ?? 0),
                'marked' => $marked->count(),
                // Only once results are out, so an admin never reads a half-marked average
                'averagePercent' => $s->results_released_at && $marked->isNotEmpty() && $total > 0
                    ? round($marked->avg(fn ($a) => (int) $a->score_sum / $total * 100), 1)
                    : null,
            ];
        })->all();

        return [
            'rows' => $rows,
            'teachers' => User::where('role', Role::Tutor->value)->orderBy('name')->get()->map(fn (User $u) => $this->teacher->person($u))->all(),
            'classes' => SchoolClass::orderBy('name')->get()->map(fn (SchoolClass $c) => ['id' => $c->id, 'name' => $c->name, 'label' => $c->batch()])->all(),
            'meta' => ['page' => $page, 'perPage' => $perPage, 'total' => $total],
        ];
    }
}

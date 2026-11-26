<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Exam;
use App\Models\SchoolClass;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The admin side against the demo school: two Economics batches (A has Hawwa, Ibrahim and Mariyam; B has Ahmed),
 * two teachers (Aishath owns every exam, Ali has none) and one admin.
 */
class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DemoSeeder::class);
        $this->as('admin@ll.test');
    }

    private function as(string $email): static
    {
        Sanctum::actingAs(User::where('email', $email)->firstOrFail());

        return $this;
    }

    private function user(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    private function batch(string $letter): SchoolClass
    {
        return SchoolClass::where('name', "IGCSE Economics, Batch {$letter}")->firstOrFail();
    }

    private function body(array $over = []): array
    {
        return array_merge(['name' => 'Sara Ahmed', 'email' => 'sara@ll.test', 'role' => 'student'], $over);
    }

    private function classBody(array $over = []): array
    {
        return array_merge([
            'name' => 'IGCSE Business Studies, Batch A', 'subjectCode' => '0450', 'grade' => 10,
            'tutorId' => $this->user('aishath@ll.test')->id, 'studentIds' => [],
        ], $over);
    }

    /* ---------------------------------------------------------------- access */

    public function test_only_admins_reach_the_admin_area(): void
    {
        foreach (['aishath@ll.test', 'hawwa@ll.test'] as $email) {
            $this->as($email);
            foreach (['/users', '/classes', '/students', '/exams'] as $path) {
                $this->getJson("/api/v1/admin{$path}")->assertForbidden();
            }
            $this->postJson('/api/v1/admin/users', $this->body())->assertForbidden();
            $this->postJson('/api/v1/admin/classes', $this->classBody())->assertForbidden();
        }
    }

    public function test_signed_out_requests_are_unauthorized(): void
    {
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/users')->assertUnauthorized();
    }

    /* ----------------------------------------------------------------- users */

    public function test_the_user_list_shows_each_role_and_class_text(): void
    {
        $response = $this->getJson('/api/v1/admin/users?per_page=50')->assertOk();

        $response->assertJsonPath('counts', ['tutors' => 2, 'students' => 4, 'admins' => 1])->assertJsonPath('meta.total', 7);
        $users = collect($response->json('users'))->keyBy('email');
        $this->assertSame('Teaches Batch A, Batch B', $users['aishath@ll.test']['classes']);
        $this->assertSame('No classes yet', $users['ali@ll.test']['classes']);
        $this->assertSame('Batch A', $users['hawwa@ll.test']['classes']);
        $this->assertSame('Batch B', $users['ahmed@ll.test']['classes']);
        $this->assertSame('All classes', $users['admin@ll.test']['classes']);
        $this->assertSame(['AR', 'tutor', true], [$users['aishath@ll.test']['initials'], $users['aishath@ll.test']['role'], $users['aishath@ll.test']['isActive']]);
    }

    public function test_a_student_in_two_subjects_lists_both(): void
    {
        $business = SchoolClass::factory()->create(['name' => 'IGCSE Business Studies, Batch C', 'subject_code' => '0450']);
        $business->addStudent($this->user('hawwa@ll.test'));

        $users = collect($this->getJson('/api/v1/admin/users?q=hawwa')->json('users'));

        $this->assertSame('Business Studies Batch C, Economics Batch A', $users->first()['classes']);
    }

    public function test_the_user_list_filters_searches_and_pages(): void
    {
        $names = fn (string $q) => collect($this->getJson("/api/v1/admin/users?{$q}")->assertOk()->json('users'))->pluck('name')->all();

        $this->assertSame(['Ahmed Nashid', 'Hawwa Nadheema', 'Ibrahim Zayan', 'Mariyam Leena'], $names('role=student'));
        $this->assertSame(['Aishath Rasheed', 'Ali Shareef'], $names('role=tutor'));
        $this->assertSame(['Ibrahim Zayan'], $names('q=ibra'));
        $this->assertSame(['Mohamed Faisal'], $names('q=admin@'));
        $this->assertSame(['Ahmed Nashid', 'Aishath Rasheed'], $names('per_page=2'));
        $this->getJson('/api/v1/admin/users?per_page=3&page=3')->assertJsonPath('meta', ['page' => 3, 'perPage' => 3, 'total' => 7])->assertJsonCount(1, 'users');
        $this->getJson('/api/v1/admin/users?role=student')->assertJsonPath('counts.tutors', 2);
    }

    public function test_a_new_account_signs_in_with_the_default_password(): void
    {
        $this->postJson('/api/v1/admin/users', $this->body(['email' => ' Sara@LL.test ']))
            ->assertCreated()->assertJsonPath('email', 'sara@ll.test')->assertJsonPath('classes', 'Not in a class');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => 'sara@ll.test', 'password' => 'password'])->assertOk()->assertJsonPath('user.role', 'student');
        $this->assertSame(1, AuditLog::where('action', 'user.create')->count());
    }

    public function test_the_default_password_comes_from_settings(): void
    {
        config(['exam.default_password' => 'welcome-2026']);

        $this->postJson('/api/v1/admin/users', $this->body())->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => 'sara@ll.test', 'password' => 'welcome-2026'])->assertOk();
    }

    public function test_an_admin_can_choose_the_password(): void
    {
        $this->postJson('/api/v1/admin/users', $this->body(['password' => 'a-chosen-pass']))->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => 'sara@ll.test', 'password' => 'a-chosen-pass'])->assertOk();
        $this->as('admin@ll.test')->postJson('/api/v1/admin/users', $this->body(['email' => 'x@ll.test', 'password' => 'short']))
            ->assertStatus(422)->assertJsonPath('message', 'A password needs at least 8 characters.');
    }

    public function test_user_details_are_validated(): void
    {
        $this->postJson('/api/v1/admin/users', $this->body(['name' => '']))->assertStatus(422)->assertJsonPath('message', 'Enter a name.');
        $this->postJson('/api/v1/admin/users', $this->body(['email' => 'not-an-email']))->assertStatus(422)->assertJsonPath('message', 'Enter a valid email address.');
        $this->postJson('/api/v1/admin/users', $this->body(['role' => 'principal']))->assertStatus(422);
        $this->postJson('/api/v1/admin/users', $this->body(['email' => 'HAWWA@ll.test']))
            ->assertStatus(422)->assertJsonPath('message', 'Someone already uses that email address.');
        $this->assertSame(7, User::count());
    }

    public function test_editing_a_user(): void
    {
        $ahmed = $this->user('ahmed@ll.test');

        $this->patchJson("/api/v1/admin/users/{$ahmed->id}", $this->body(['name' => 'Ahmed N.', 'email' => 'ahmed.n@ll.test']))
            ->assertOk()->assertJsonPath('name', 'Ahmed N.')->assertJsonPath('classes', 'Batch B');

        $this->assertSame('ahmed.n@ll.test', $ahmed->fresh()->email);
        $this->patchJson('/api/v1/admin/users/9999', $this->body())->assertNotFound();
        $this->patchJson("/api/v1/admin/users/{$ahmed->id}", $this->body(['email' => 'hawwa@ll.test']))->assertStatus(422);
        $this->patchJson("/api/v1/admin/users/{$ahmed->id}", $this->body(['name' => 'Ahmed N.', 'email' => 'ahmed.n@ll.test']))->assertOk();
    }

    public function test_deactivating_signs_the_account_out_everywhere(): void
    {
        $ahmed = $this->user('ahmed@ll.test');
        $token = $ahmed->createToken('web')->plainTextToken;

        $this->patchJson("/api/v1/admin/users/{$ahmed->id}", $this->body(['name' => $ahmed->name, 'email' => $ahmed->email, 'isActive' => false]))->assertOk()->assertJsonPath('isActive', false);

        $this->assertSame(0, $ahmed->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => 'ahmed@ll.test', 'password' => 'password'])->assertStatus(422);
        $this->assertNotSame('', $token);

        $this->as('admin@ll.test')->patchJson("/api/v1/admin/users/{$ahmed->id}", $this->body(['name' => $ahmed->name, 'email' => $ahmed->email, 'isActive' => true]))->assertOk();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => 'ahmed@ll.test', 'password' => 'password'])->assertOk();
    }

    public function test_an_admin_cannot_lock_themselves_out(): void
    {
        $me = $this->user('admin@ll.test');

        $this->patchJson("/api/v1/admin/users/{$me->id}", $this->body(['name' => $me->name, 'email' => $me->email, 'role' => 'admin', 'isActive' => false]))
            ->assertStatus(422)->assertJsonPath('message', "You can't deactivate your own account.");
        $this->patchJson("/api/v1/admin/users/{$me->id}", $this->body(['name' => $me->name, 'email' => $me->email, 'role' => 'student']))
            ->assertStatus(422)->assertJsonPath('message', "You can't remove your own admin access.");
    }

    public function test_a_role_cannot_change_while_it_would_orphan_work(): void
    {
        $edit = fn (User $u, string $role) => $this->patchJson("/api/v1/admin/users/{$u->id}", ['name' => $u->name, 'email' => $u->email, 'role' => $role]);

        $edit($this->user('aishath@ll.test'), 'student')->assertStatus(409)->assertJsonPath('message', 'This teacher still has classes. Give those classes another teacher first.');
        $edit($this->user('hawwa@ll.test'), 'tutor')->assertStatus(409)->assertJsonPath('message', "This student has exam attempts, so their role can't change.");

        $ali = $this->user('ali@ll.test');
        Exam::factory()->create(['owner_id' => $ali->id]);
        $edit($ali, 'student')->assertStatus(409)->assertJsonPath('message', "This teacher still owns exams, so their role can't change.");
    }

    public function test_a_student_with_no_attempts_can_become_a_teacher_and_leaves_their_class(): void
    {
        $ahmed = $this->user('ahmed@ll.test');

        $this->patchJson("/api/v1/admin/users/{$ahmed->id}", ['name' => $ahmed->name, 'email' => $ahmed->email, 'role' => 'tutor'])
            ->assertOk()->assertJsonPath('role', 'tutor')->assertJsonPath('classes', 'No classes yet');

        $this->assertSame(0, $this->batch('B')->students()->count());
    }

    /* --------------------------------------------------------------- classes */

    public function test_the_class_list_has_students_and_the_teachers(): void
    {
        $response = $this->getJson('/api/v1/admin/classes')->assertOk();

        $response->assertJsonPath('meta.total', 2)->assertJsonCount(2, 'tutors');
        $a = collect($response->json('classes'))->firstWhere('name', 'IGCSE Economics, Batch A');
        $this->assertSame(['Hawwa Nadheema', 'Ibrahim Zayan', 'Mariyam Leena'], collect($a['students'])->pluck('name')->all());
        $this->assertSame(['0455', 10, $this->user('aishath@ll.test')->id], [$a['subjectCode'], $a['grade'], $a['tutorId']]);
        $this->assertCount(1, $this->getJson('/api/v1/admin/classes?q=Batch B')->json('classes'));
    }

    public function test_a_new_class_with_its_roster(): void
    {
        $sara = User::factory()->create();
        $hawwa = $this->user('hawwa@ll.test');

        $response = $this->postJson('/api/v1/admin/classes', $this->classBody(['studentIds' => [$sara->id, $hawwa->id]]))->assertCreated();

        $response->assertJsonCount(2, 'students');
        $class = SchoolClass::findOrFail($response->json('id'));
        $this->assertSame('0450', $class->subject_code);
        $this->assertSame(['0450', '0450'], $class->students()->get()->map(fn ($s) => $s->pivot->subject_code)->all());
        $this->assertCount(2, $hawwa->classes()->get(), 'Hawwa now takes two subjects');
        $this->assertSame(1, AuditLog::where('action', 'class.create')->count());
    }

    public function test_class_details_are_validated(): void
    {
        $this->postJson('/api/v1/admin/classes', $this->classBody(['name' => '']))->assertStatus(422)->assertJsonPath('message', 'Enter a class name.');
        $this->postJson('/api/v1/admin/classes', $this->classBody(['subjectCode' => '']))->assertStatus(422)->assertJsonPath('message', 'Enter a subject code.');
        $this->postJson('/api/v1/admin/classes', $this->classBody(['grade' => 14]))->assertStatus(422)->assertJsonPath('message', 'Grade must be between 1 and 13.');
        $this->postJson('/api/v1/admin/classes', $this->classBody(['tutorId' => $this->user('hawwa@ll.test')->id]))
            ->assertStatus(422)->assertJsonPath('message', 'Choose a teacher for this class.');
        $this->assertSame(2, SchoolClass::count());
    }

    public function test_a_student_cannot_be_in_two_classes_for_one_subject(): void
    {
        $hawwa = $this->user('hawwa@ll.test');

        $this->postJson('/api/v1/admin/classes', $this->classBody(['name' => 'IGCSE Economics, Batch C', 'subjectCode' => '0455', 'studentIds' => [$hawwa->id]]))
            ->assertStatus(409)->assertJsonPath('message', 'Hawwa Nadheema is already in IGCSE Economics, Batch A. A student can only be in one class for each subject.');
        $this->assertSame(2, SchoolClass::count(), 'nothing was created');

        $ahmed = $this->user('ahmed@ll.test');
        $this->patchJson("/api/v1/admin/classes/{$this->batch('A')->id}", $this->classBody([
            'name' => 'IGCSE Economics, Batch A', 'subjectCode' => '0455', 'studentIds' => [$hawwa->id, $ahmed->id],
        ]))->assertStatus(409)->assertJsonPath('message', 'Ahmed Nashid is already in IGCSE Economics, Batch B. A student can only be in one class for each subject.');
    }

    public function test_editing_a_roster_adds_and_removes_students(): void
    {
        $batchA = $this->batch('A');
        $sara = User::factory()->create();
        $ibrahim = $this->user('ibrahim@ll.test');
        $keep = [$this->user('hawwa@ll.test')->id, $this->user('mariyam@ll.test')->id, $sara->id];

        $this->patchJson("/api/v1/admin/classes/{$batchA->id}", $this->classBody(['name' => 'IGCSE Economics, Batch A', 'subjectCode' => '0455', 'studentIds' => $keep]))
            ->assertOk()->assertJsonCount(3, 'students');

        $this->assertEqualsCanonicalizing($keep, $batchA->students()->pluck('users.id')->all());
        $this->assertCount(0, $ibrahim->classes()->get());
        $this->assertSame(1, AuditLog::where('action', 'class.update')->count());
        $this->patchJson('/api/v1/admin/classes/9999', $this->classBody())->assertNotFound();
    }

    public function test_a_student_who_sat_an_exam_in_the_class_cannot_be_removed(): void
    {
        $batchA = $this->batch('A');
        $roster = fn (array $emails) => collect($emails)->map(fn ($e) => $this->user($e)->id)->all();
        $same = ['name' => 'IGCSE Economics, Batch A', 'subjectCode' => '0455'];

        $this->patchJson("/api/v1/admin/classes/{$batchA->id}", $this->classBody($same + ['studentIds' => $roster(['hawwa@ll.test', 'ibrahim@ll.test'])]))
            ->assertStatus(409)->assertJsonPath('message', "Mariyam Leena has already sat an exam in this class, so they can't be removed.");
        $this->patchJson("/api/v1/admin/classes/{$batchA->id}", $this->classBody($same + ['studentIds' => $roster(['mariyam@ll.test', 'ibrahim@ll.test'])]))
            ->assertStatus(409)->assertJsonPath('message', "Hawwa Nadheema has already sat an exam in this class, so they can't be removed.");
        $this->assertSame(3, $batchA->students()->count());
    }

    public function test_the_teacher_of_a_class_with_exams_cannot_change(): void
    {
        $ali = $this->user('ali@ll.test');

        $this->patchJson("/api/v1/admin/classes/{$this->batch('B')->id}", $this->classBody([
            'name' => 'IGCSE Economics, Batch B', 'subjectCode' => '0455', 'tutorId' => $ali->id, 'studentIds' => [$this->user('ahmed@ll.test')->id],
        ]))->assertStatus(409)->assertJsonPath('message', "This class already has exams from its teacher, so the teacher can't change.");

        $fresh = SchoolClass::factory()->create(['tutor_id' => $this->user('aishath@ll.test')->id, 'subject_code' => '0450', 'name' => 'IGCSE Business Studies, Batch Z']);
        $this->patchJson("/api/v1/admin/classes/{$fresh->id}", $this->classBody(['name' => $fresh->name, 'tutorId' => $ali->id]))->assertOk()->assertJsonPath('tutorId', $ali->id);
    }

    public function test_changing_a_subject_code_moves_the_roster_with_it(): void
    {
        $fresh = SchoolClass::factory()->create(['tutor_id' => $this->user('aishath@ll.test')->id, 'subject_code' => '0450', 'name' => 'IGCSE Business Studies, Batch Z']);
        $sara = User::factory()->create();
        $fresh->addStudent($sara);

        $this->patchJson("/api/v1/admin/classes/{$fresh->id}", $this->classBody(['name' => $fresh->name, 'subjectCode' => '0452', 'studentIds' => [$sara->id]]))->assertOk();

        $this->assertSame('0452', $fresh->fresh()->subject_code);
        $this->assertSame('0452', $sara->classes()->first()->pivot->subject_code);
    }

    public function test_changing_a_subject_code_into_a_clash_is_refused(): void
    {
        $tutor = $this->user('aishath@ll.test')->id;
        $business = SchoolClass::factory()->create(['tutor_id' => $tutor, 'subject_code' => '0450', 'name' => 'IGCSE Business Studies, Batch Z']);
        $sara = User::factory()->create();
        $sara->classes()->attach($business->id, ['subject_code' => '0450']);
        $other = SchoolClass::factory()->create(['tutor_id' => $tutor, 'subject_code' => '0452', 'name' => 'IGCSE Accounting, Batch Z']);
        $other->addStudent($sara);

        $this->patchJson("/api/v1/admin/classes/{$other->id}", $this->classBody(['name' => $other->name, 'subjectCode' => '0450', 'studentIds' => [$sara->id]]))
            ->assertStatus(409);
        $this->assertSame('0452', $other->fresh()->subject_code);
    }

    /* -------------------------------------------------------------- students */

    public function test_the_student_picker_shows_each_students_classes(): void
    {
        $response = $this->getJson('/api/v1/admin/students?q=ha')->assertOk();

        $this->assertSame(['Hawwa Nadheema'], collect($response->json('students'))->pluck('name')->all());
        $hawwa = collect($response->json('students'))->firstWhere('name', 'Hawwa Nadheema');
        $this->assertSame([['id' => $this->batch('A')->id, 'name' => 'IGCSE Economics, Batch A', 'subjectCode' => '0455']], $hawwa['classes']);
        $this->getJson('/api/v1/admin/students?per_page=2&page=2')->assertJsonPath('meta', ['page' => 2, 'perPage' => 2, 'total' => 4])->assertJsonCount(2, 'students');
        $this->getJson('/api/v1/admin/students?q=aishath')->assertJsonCount(0, 'students');
    }

    /* ----------------------------------------------------------------- exams */

    public function test_all_exams_has_one_row_per_published_exam_and_class(): void
    {
        $response = $this->getJson('/api/v1/admin/exams')->assertOk();

        $response->assertJsonPath('meta.total', 3)->assertJsonCount(2, 'teachers')->assertJsonCount(2, 'classes');
        $rows = collect($response->json('rows'));
        // newest exam first (Unit 2 was created after Unit 3), then by class
        $this->assertSame(['Unit 2 Test: Elasticity', 'Unit 3 Test: Demand and Supply', 'Unit 3 Test: Demand and Supply'], $rows->pluck('title')->all());

        $unit3A = $rows->first(fn ($r) => str_starts_with($r['title'], 'Unit 3') && $r['className'] === 'Batch A');
        $this->assertSame(['open', 1, 3, 0, null, 'Aishath Rasheed'], [$unit3A['status'], $unit3A['handedIn'], $unit3A['students'], $unit3A['marked'], $unit3A['averagePercent'], $unit3A['teacher']]);
        $unit3B = $rows->first(fn ($r) => str_starts_with($r['title'], 'Unit 3') && $r['className'] === 'Batch B');
        $this->assertSame(['not_open', 0, 1], [$unit3B['status'], $unit3B['handedIn'], $unit3B['students']]);
        $unit2 = $rows->first(fn ($r) => str_starts_with($r['title'], 'Unit 2'));
        $this->assertSame(['released', 1, 1, 75.0], [$unit2['status'], $unit2['handedIn'], $unit2['marked'], (float) $unit2['averagePercent']]);
    }

    public function test_all_exams_filters_and_pages(): void
    {
        $titles = fn (string $q) => collect($this->getJson("/api/v1/admin/exams?{$q}")->assertOk()->json('rows'))->pluck('title')->all();
        $aishath = $this->user('aishath@ll.test')->id;

        $this->assertCount(3, $titles("teacher={$aishath}"));
        $this->assertCount(0, $titles('teacher='.$this->user('ali@ll.test')->id));
        $this->assertCount(2, $titles("class={$this->batch('A')->id}"));
        $this->assertSame(['Unit 2 Test: Elasticity'], $titles('status=released'));
        $this->assertCount(1, $titles('status=open'));
        $this->assertSame(['Unit 2 Test: Elasticity'], $titles('q=elasticity'));
        $this->assertSame(['Unit 3 Test: Demand and Supply'], $titles('per_page=2&page=2'));
        $this->getJson('/api/v1/admin/exams?status=released')->assertJsonPath('meta.total', 1);
    }

    public function test_a_draft_never_appears_in_all_exams(): void
    {
        $this->assertNotContains('Unit 4 Test: Market Failure', collect($this->getJson('/api/v1/admin/exams?per_page=100')->json('rows'))->pluck('title')->all());
    }
}

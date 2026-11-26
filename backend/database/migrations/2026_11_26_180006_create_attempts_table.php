<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        // One student sitting one session. The deadline is fixed here when the attempt starts.
        Schema::create('attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_session_id')->constrained('exam_sessions')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('deadline_at');
            $table->timestamp('submitted_at')->nullable();
            $table->enum('submit_reason', ['manual', 'timeout', 'violations', 'closed'])->nullable();
            $table->enum('status', ['in_progress', 'submitted', 'marked'])->default('in_progress');
            $table->unsignedTinyInteger('violation_count')->default(0);
            $table->unsignedSmallInteger('total_score')->nullable();
            $table->text('overall_comment')->nullable();
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('marked_at')->nullable();
            // Drives the "New" badge on a released result.
            $table->timestamp('result_viewed_at')->nullable();
            $table->timestamps();

            $table->unique(['exam_session_id', 'student_id']);
            $table->index(['exam_session_id', 'status']);
            $table->index(['student_id', 'status']);
            // The once-a-minute sweep for attempts that ran out of time.
            $table->index(['status', 'deadline_at']);
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('attempts');
    }
};

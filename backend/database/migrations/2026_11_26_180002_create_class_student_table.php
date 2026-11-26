<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        // Roster. A student can take several subjects with one class in each: subject_code is copied
        // from the class so the database itself refuses two classes for the same subject.
        Schema::create('class_student', function (Blueprint $table) {
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->string('subject_code', 10);
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['school_class_id', 'student_id']);
            $table->unique(['student_id', 'subject_code']);
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('class_student');
    }
};

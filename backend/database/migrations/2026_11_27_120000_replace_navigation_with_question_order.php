<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Navigation" (any order or in order) was never enforced. It becomes the order of the questions:
     * the teacher's order for everyone, or a random order for each student.
     */
    public function up(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->string('question_order', 10)->default('in_order')->after('time_limit_minutes');
        });

        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn('navigation');
        });
    }

    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->enum('navigation', ['any', 'in_order'])->default('any');
        });

        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn('question_order');
        });
    }
};

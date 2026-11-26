<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        // A batch of students taught by one teacher, e.g. "IGCSE Economics, Batch A".
        Schema::create('school_classes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('subject_code', 10);
            $table->unsignedTinyInteger('grade');
            $table->foreignId('tutor_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index('tutor_id');
            $table->index('subject_code');
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('school_classes');
    }
};

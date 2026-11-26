<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        // An exam opened for one class. Opening, closing and releasing results all happen here.
        Schema::create('exam_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->enum('status', ['not_open', 'open', 'closed'])->default('not_open');
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('results_released_at')->nullable();
            $table->timestamps();

            $table->unique(['exam_id', 'school_class_id']);
            $table->index(['school_class_id', 'status']);
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('exam_sessions');
    }
};

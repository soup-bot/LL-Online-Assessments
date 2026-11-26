<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 120);
            $table->unsignedSmallInteger('time_limit_minutes')->default(30);
            $table->enum('navigation', ['any', 'in_order'])->default('any');
            $table->text('rules')->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'status']);
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('exams');
    }
};

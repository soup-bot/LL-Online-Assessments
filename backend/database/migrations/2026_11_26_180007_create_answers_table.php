<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        Schema::create('answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            // mcq: option key | true_false: "true" or "false" | fill_blank and written: free text
            $table->text('response')->nullable();
            $table->boolean('flagged')->default(false);
            // null while a written answer waits for the teacher
            $table->unsignedSmallInteger('awarded_marks')->nullable();
            $table->text('feedback')->nullable();
            // indexes of the marking points the teacher ticked
            $table->json('marking_ticks')->nullable();
            // A late, retried save must not overwrite newer typing: older writes are ignored.
            $table->timestamp('client_saved_at', 3)->nullable();
            $table->timestamps();

            $table->unique(['attempt_id', 'question_id']);
            $table->index('question_id');
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('answers');
    }
};

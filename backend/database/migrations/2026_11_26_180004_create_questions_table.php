<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->enum('kind', ['mcq', 'true_false', 'fill_blank', 'written']);
            $table->text('prompt');
            $table->unsignedTinyInteger('points')->default(1);
            // mcq: [{ key: "A", text: "..." }] x 4
            $table->json('options')->nullable();
            // mcq {correct} | true_false {correct} | fill_blank {accepted[]} | written {markingPoints[]}
            // Never sent to a student: hidden on the model and left out of every student resource.
            $table->json('answer_key')->nullable();
            $table->boolean('approved')->default(false);
            $table->timestamps();

            $table->unique(['exam_id', 'position']);
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};

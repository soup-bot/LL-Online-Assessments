<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\QuestionKind;
use App\Exceptions\ApiException;
use App\Models\Answer;
use App\Models\Attempt;
use App\Models\AuditLog;
use App\Models\Question;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Saving a teacher's marks for the written answers of one submission. */
class MarkingService
{
    /**
     * Saving marks completes the marking: every written question needs a mark, and the attempt
     * becomes `marked`. Not allowed while the student is still sitting, or after results are released.
     *
     * @param  array{answers: list<array{questionId: int, awarded: int, feedback?: ?string, ticks?: list<int>}>, overallComment?: ?string}  $input
     * @return array{score: int, total: int, grade: string}
     */
    public function save(User $teacher, Attempt $attempt, array $input): array
    {
        if ($attempt->isInProgress()) {
            throw ApiException::conflict('This student is still sitting the exam.');
        }
        if ($attempt->session->results_released_at) {
            throw ApiException::conflict("Results are already released, so marks can't change.");
        }

        $written = Question::where('exam_id', $attempt->session->exam_id)->where('kind', QuestionKind::Written->value)->orderBy('position')->get();
        $patches = collect($input['answers'])->keyBy('questionId');

        foreach ($written as $question) {
            $patch = $patches->get($question->id) ?? throw ApiException::validation("Mark question {$question->position} before saving.");
            $awarded = $patch['awarded'];
            if (! is_int($awarded) || $awarded < 0 || $awarded > $question->points) {
                throw ApiException::validation("Question {$question->position} is out of {$question->points} marks.");
            }
        }

        DB::transaction(function () use ($teacher, $attempt, $written, $patches, $input) {
            foreach ($written as $question) {
                $patch = $patches->get($question->id);
                $answer = Answer::firstOrNew(['attempt_id' => $attempt->id, 'question_id' => $question->id]);
                $answer->awarded_marks = $patch['awarded'];
                $answer->feedback = trim((string) ($patch['feedback'] ?? '')) ?: null;
                $answer->marking_ticks = array_values($patch['ticks'] ?? []);
                $answer->save();
            }

            $score = (int) Answer::where('attempt_id', $attempt->id)->sum('awarded_marks');
            $attempt->update([
                'overall_comment' => trim((string) ($input['overallComment'] ?? '')) ?: null,
                'status' => AttemptStatus::Marked,
                'total_score' => $score,
                'marked_by' => $teacher->id,
                'marked_at' => now(),
            ]);
        });

        $score = (int) $attempt->total_score;
        $total = (int) Question::where('exam_id', $attempt->session->exam_id)->sum('points');
        AuditLog::record($teacher, 'attempt.mark', $attempt, ['score' => $score, 'total' => $total]);

        return ['score' => $score, 'total' => $total, 'grade' => Grader::gradeFor($score, $total)];
    }
}

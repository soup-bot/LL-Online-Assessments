<?php

namespace App\Http\Controllers\Tutor;

use App\Enums\QuestionKind;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tutor\ApprovalRequest;
use App\Http\Requests\Tutor\ReorderQuestionsRequest;
use App\Http\Requests\Tutor\ImportQuestionsRequest;
use App\Http\Requests\Tutor\SaveQuestionRequest;
use App\Models\Exam;
use App\Models\Question;
use App\Services\ExamBuilderService;
use App\Services\StaffAccess;
use App\Services\TeacherPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The questions of an exam. Only drafts can change; every edit removes the question's approval.
 */
class QuestionController extends Controller
{
    public function __construct(
        private StaffAccess $access,
        private ExamBuilderService $builder,
        private TeacherPresenter $present,
    ) {}

    private function question(Exam $exam, int $id): Question
    {
        return Question::where('exam_id', $exam->id)->whereKey($id)->first() ?? throw ApiException::notFound("We couldn't find that question.");
    }

    /**
     * Blank question
     *
     * The editor's starting point for a new question of the given `kind` (mcq, true_false, fill_blank, written).
     *
     * @response array<string, mixed>
     */
    public function template(Request $request, int $exam): JsonResponse
    {
        $user = $request->user();
        $kind = QuestionKind::tryFrom((string) $request->query('kind', 'mcq')) ?? QuestionKind::Mcq;

        return response()->json($this->present->editor($this->access->exam($user, $exam), null, $kind, $user));
    }

    /**
     * One question
     *
     * The editor's view of a question, answer key included. Teachers and admins only; `locked` is true once
     * the exam is published or for an admin.
     *
     * @response array<string, mixed>
     */
    public function show(Request $request, int $exam, int $question): JsonResponse
    {
        $user = $request->user();
        $exam = $this->access->exam($user, $exam);

        return response()->json($this->present->editor($exam, $this->question($exam, $question), QuestionKind::Mcq, $user));
    }

    /**
     * Add a question
     *
     * Saved unapproved unless `approved` is true and the answer key is complete (422 with what is missing).
     * A fill-in-the-blank question has exactly one blank.
     *
     * @response 201 array{questionId: int}
     */
    public function store(SaveQuestionRequest $request, int $exam): JsonResponse
    {
        $exam = $this->access->draft($request->user(), $exam);
        $saved = $this->builder->saveQuestion($exam, null, $request->validated());

        return response()->json(['questionId' => $saved['question']->id], 201);
    }

    /**
     * Save a question
     *
     * Replaces the question's content. Any change removes its approval; send `approved: true` with a complete
     * answer key to approve it in the same save.
     *
     * @response array{questionId: int}
     */
    public function update(SaveQuestionRequest $request, int $exam, int $question): JsonResponse
    {
        $exam = $this->access->draft($request->user(), $exam);
        $saved = $this->builder->saveQuestion($exam, $this->question($exam, $question), $request->validated());

        return response()->json(['questionId' => $saved['question']->id]);
    }

    /**
     * Delete a question
     *
     * The questions after it move up one place.
     */
    public function destroy(Request $request, int $exam, int $question): JsonResponse
    {
        $exam = $this->access->draft($request->user(), $exam);
        $this->builder->deleteQuestion($exam, $this->question($exam, $question));

        return response()->json(['ok' => true]);
    }

    /**
     * Rearrange the questions
     *
     * Send every question id once, in the order you want (422 otherwise). Only drafts can be rearranged; a published
     * exam answers 409. Approvals are kept.
     */
    public function reorder(ReorderQuestionsRequest $request, int $exam): JsonResponse
    {
        $exam = $this->access->draft($request->user(), $exam);
        $this->builder->reorderQuestions($exam, $request->validated('ids'));

        return response()->json(['ok' => true]);
    }

    /**
     * Approve or unapprove
     *
     * Approving needs a complete answer key (422 saying what is missing).
     */
    public function approval(ApprovalRequest $request, int $exam, int $question): JsonResponse
    {
        $exam = $this->access->draft($request->user(), $exam);
        $this->builder->setApproved($this->question($exam, $question), $request->boolean('approved'));

        return response()->json(['ok' => true]);
    }

    /**
     * Import questions
     *
     * Adds questions parsed from an AI reply. They always arrive unapproved, so the teacher still checks every key.
     *
     * @response array{added: int}
     */
    public function import(ImportQuestionsRequest $request, int $exam): JsonResponse
    {
        $exam = $this->access->draft($request->user(), $exam);

        return response()->json(['added' => $this->builder->import($exam, $request->validated('questions'))]);
    }
}

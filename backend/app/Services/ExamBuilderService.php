<?php

namespace App\Services;

use App\Enums\ExamStatus;
use App\Enums\Navigation;
use App\Enums\QuestionKind;
use App\Enums\SessionStatus;
use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Building an exam: creating the draft, its settings and classes, its questions, and publishing it.
 * Published exams are locked: every method here that changes content is for drafts only.
 */
class ExamBuilderService
{
    public function create(User $teacher): Exam
    {
        return DB::transaction(function () use ($teacher) {
            $exam = Exam::create([
                'owner_id' => $teacher->id,
                'title' => 'Untitled exam',
                'time_limit_minutes' => 30,
                'navigation' => Navigation::Any,
                'rules' => '',
                'status' => ExamStatus::Draft,
            ]);

            // Start with every class the teacher has; they can untick the ones that shouldn't sit it.
            foreach (SchoolClass::where('tutor_id', $teacher->id)->get() as $class) {
                ExamSession::create(['exam_id' => $exam->id, 'school_class_id' => $class->id, 'status' => SessionStatus::NotOpen]);
            }

            return $exam;
        });
    }

    /**
     * @param  array{title?: string, timeLimitMinutes?: int, navigation?: string, rules?: ?string, classIds?: list<int>}  $patch
     */
    public function update(Exam $exam, array $patch): void
    {
        DB::transaction(function () use ($exam, $patch) {
            if (array_key_exists('title', $patch)) {
                $exam->title = mb_substr(trim((string) $patch['title']), 0, 120);
            }
            if (array_key_exists('timeLimitMinutes', $patch)) {
                $exam->time_limit_minutes = (int) $patch['timeLimitMinutes'];
            }
            if (array_key_exists('navigation', $patch)) {
                $exam->navigation = Navigation::from($patch['navigation']);
            }
            if (array_key_exists('rules', $patch)) {
                $exam->rules = (string) ($patch['rules'] ?? '');
            }
            $exam->save();

            if (array_key_exists('classIds', $patch)) {
                $wanted = SchoolClass::where('tutor_id', $exam->owner_id)->whereIn('id', $patch['classIds'])->pluck('id');
                // A draft has no attempts, so dropping a class is safe.
                ExamSession::where('exam_id', $exam->id)->whereNotIn('school_class_id', $wanted)->delete();
                $existing = ExamSession::where('exam_id', $exam->id)->pluck('school_class_id');
                foreach ($wanted->diff($existing) as $classId) {
                    ExamSession::create(['exam_id' => $exam->id, 'school_class_id' => $classId, 'status' => SessionStatus::NotOpen]);
                }
            }
        });
    }

    /** Locks the exam: from now on its questions, answer keys and settings never change. */
    public function publish(Exam $exam, User $actor): void
    {
        $questions = $exam->questions()->get();

        if (trim($exam->title) === '') {
            throw ApiException::validation('Give the exam a title first.');
        }
        if ($questions->isEmpty()) {
            throw ApiException::validation('Add at least one question first.');
        }
        if ($questions->contains(fn (Question $q) => ! $q->approved)) {
            throw ApiException::validation('Approve every question before publishing.');
        }
        if (! ExamSession::where('exam_id', $exam->id)->exists()) {
            throw ApiException::validation('Choose at least one class first.');
        }

        $exam->update(['status' => ExamStatus::Published, 'published_at' => now()]);
        AuditLog::record($actor, 'exam.publish', $exam, ['questions' => $questions->count()]);
    }

    /**
     * Create or update one question from the editor's draft. Any change removes the approval; it is
     * given back only when the teacher asks for it and the answer key is complete.
     *
     * @param  array<string, mixed>  $draft
     * @return array{question: Question}
     */
    public function saveQuestion(Exam $exam, ?Question $existing, array $draft): array
    {
        $content = $this->content($draft);
        $candidate = new Question($content);

        if (trim((string) $candidate->prompt) === '') {
            throw ApiException::validation('Write the question first.');
        }
        if ((int) $candidate->points < 1) {
            throw ApiException::validation('Give the question at least 1 mark.');
        }
        if ($candidate->kind === QuestionKind::FillBlank && preg_match_all('/_{3,}/', (string) $candidate->prompt) > 1) {
            throw ApiException::validation('Use one blank per question. Split it into separate questions if you need more.');
        }

        $wantApproved = (bool) ($draft['approved'] ?? false);
        if ($wantApproved && ($issue = QuestionKeyValidator::issue($candidate))) {
            throw ApiException::validation("Finish the answer key before approving. {$issue}");
        }

        $question = DB::transaction(function () use ($exam, $existing, $content, $wantApproved) {
            $question = $existing ?? new Question(['exam_id' => $exam->id, 'position' => ($exam->questions()->max('position') ?? 0) + 1]);
            $question->fill($content);
            $question->approved = false;
            $question->save();

            if ($wantApproved) {
                $question->approved = true;
                $question->save();
            }

            return $question;
        });

        return ['question' => $question];
    }

    public function deleteQuestion(Exam $exam, Question $question): void
    {
        DB::transaction(function () use ($exam, $question) {
            $question->delete();
            $exam->questions()->get()->each(fn (Question $q, int $i) => $q->position === $i + 1 ?: $q->update(['position' => $i + 1]));
        });
    }

    public function setApproved(Question $question, bool $approved): void
    {
        if ($approved && ($issue = QuestionKeyValidator::issue($question))) {
            throw ApiException::validation("Question {$question->position} isn't ready to approve. {$issue}");
        }
        $question->approved = $approved;
        $question->save();
    }

    /**
     * Add questions from an AI import. They arrive unapproved, so the teacher still checks every key.
     *
     * @param  list<array<string, mixed>>  $drafts
     */
    public function import(Exam $exam, array $drafts): int
    {
        return DB::transaction(function () use ($exam, $drafts) {
            $position = (int) ($exam->questions()->max('position') ?? 0);
            foreach ($drafts as $draft) {
                $draft['points'] = max(1, (int) ($draft['points'] ?? 1));
                Question::create($this->content($draft) + ['exam_id' => $exam->id, 'position' => ++$position, 'approved' => false]);
            }

            return count($drafts);
        });
    }

    /** The editor's draft as question columns. */
    private function content(array $d): array
    {
        $kind = QuestionKind::from($d['kind']);
        $options = null;
        $key = [];

        switch ($kind) {
            case QuestionKind::Mcq:
                $texts = array_values($d['options'] ?? []);
                $options = array_map(fn ($i) => ['key' => chr(65 + $i), 'text' => trim((string) ($texts[$i] ?? ''))], range(0, 3));
                $key = ['correct' => (string) ($d['correct'] ?? '')];
                break;
            case QuestionKind::TrueFalse:
                $key = ['correct' => $d['trueFalse'] ?? null];
                break;
            case QuestionKind::FillBlank:
                $key = ['accepted' => array_values(array_filter(array_map(fn ($a) => trim((string) $a), $d['accepted'] ?? []), fn ($a) => $a !== ''))];
                break;
            case QuestionKind::Written:
                $key = ['markingPoints' => array_values(array_filter(array_map(fn ($p) => trim((string) $p), $d['markingPoints'] ?? []), fn ($p) => $p !== ''))];
                break;
        }

        return [
            'kind' => $kind,
            'prompt' => trim((string) ($d['prompt'] ?? '')),
            'points' => (int) ($d['points'] ?? 0),
            'options' => $options,
            'answer_key' => $key,
        ];
    }
}

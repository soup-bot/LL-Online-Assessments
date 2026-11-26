<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Question counts and total marks for many exams in one query, so lists never loop over exams. */
class ExamStats
{
    /**
     * @param  iterable<int>  $examIds
     * @return array<int, array{questionCount: int, totalMarks: int, kindCounts: array<string, int>}>
     */
    public static function for(iterable $examIds): array
    {
        $ids = collect($examIds)->unique()->values();
        $stats = [];
        foreach ($ids as $id) {
            $stats[$id] = ['questionCount' => 0, 'totalMarks' => 0, 'kindCounts' => ['mcq' => 0, 'true_false' => 0, 'fill_blank' => 0, 'written' => 0]];
        }
        if ($ids->isEmpty()) {
            return $stats;
        }

        $rows = DB::table('questions')
            ->whereIn('exam_id', $ids)
            ->select('exam_id', 'kind', DB::raw('count(*) as n'), DB::raw('sum(points) as pts'))
            ->groupBy('exam_id', 'kind')
            ->get();

        foreach ($rows as $row) {
            $stats[$row->exam_id]['questionCount'] += (int) $row->n;
            $stats[$row->exam_id]['totalMarks'] += (int) $row->pts;
            $stats[$row->exam_id]['kindCounts'][$row->kind] = (int) $row->n;
        }

        return $stats;
    }
}

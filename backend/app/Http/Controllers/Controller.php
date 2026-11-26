<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * `page` and `per_page` from the query string, kept inside sensible limits.
     *
     * @return array{int, int} [page, perPage]
     */
    protected function paging(Request $request): array
    {
        $max = (int) config('exam.max_per_page');
        $perPage = max(1, min($max, (int) $request->query('per_page', config('exam.per_page'))));
        $page = max(1, (int) $request->query('page', 1));

        return [$page, $perPage];
    }
}

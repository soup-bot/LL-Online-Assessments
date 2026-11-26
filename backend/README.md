# LL Assessments API

Laravel 12 API for the LL online exam module. Setup, the seeders, the decisions behind it and what is next are in
the [top-level README](../README.md).

- API reference (generated, local only): run `php artisan serve`, then open http://localhost:8000/docs/api
- Tests: `php artisan test`
- Rules live in `app/Services` (`AttemptService`, `SessionManager`, `MarkingService`, `ExamBuilderService`,
  `Grader`); the limits and grade bands are in `config/exam.php`.

# LL Online Assessments

An online exam module for Limitless Learning: a Laravel API (`backend/`) and a Next.js app (`frontend/`).

## Run it

You need PHP 8.2+, Composer, and Node 20+ with npm. Use two terminals.

**Terminal 1: the API**

```bash
cd backend
composer install
cp .env.example .env          # Windows: copy .env.example .env
php artisan key:generate
touch database/database.sqlite   # Windows: type nul > database\database.sqlite
php artisan migrate --seed
php artisan serve
```

The API runs at http://localhost:8000.

**Terminal 2: the app**

```bash
cd frontend
cp .env.example .env.local    # Windows: copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`, so sign-in cookies work).

## Sign in

Every account uses the password `password`.

| Role | Email |
|---|---|
| Teacher | aishath@ll.test |
| Student | ibrahim@ll.test (also hawwa@, mariyam@, ahmed@) |
| Admin | admin@ll.test |

## Optional

- **More data:** `php artisan migrate:fresh --seed --seeder=DemoSeeder` adds an open exam, a released result and a
  submission waiting to be marked. `--seeder=StressSeeder` adds a large school for trying lists and paging.
- **Hand in timed-out exams:** run `php artisan schedule:work` in a third terminal. It hands in any exam whose time has
  run out, even if the student never came back.
- **API reference:** http://localhost:8000/docs/api (while the API is running).
- **Tests:** `cd backend && php artisan test`

## Decisions made

- Rely on server clock to make it so students can't cheat by altering data client side 
- Used SQLite so you don't have to do much work to set it up
- 5 second grace period after exam timer is up to account for internet problems / delays throughout exam
- Tutors can't delete exams after publishing (only deletable at draft stage)
- Server side filtering/paginating for scaling
- A student can be in several classes but only one per subject.
- Admins can look at exams and submissions but not change them.

## Potential future stuff

- Setup MCP server so tutors can easily set up exams
- Maybe keep questions categorized and independant from exams, so they can be reused later
- Usedful analytics for tutors/students to identify weak points
- Questions with images

# LL Assessments app

Next.js 15 app with the student, teacher and admin areas. Setup, accounts, decisions and next steps are in the
[top-level README](../README.md).

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

| Setting | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | The Laravel API, including `/api/v1` (default `http://localhost:8000/api/v1`) |
| `NEXT_PUBLIC_USE_MOCK=1` | Run the student screens on in-browser demo data, no server needed. Teacher and admin screens always need the API. |
| `NEXT_PUBLIC_DEMO_TOOLS=0` | Hide the demo tools tab |
| `NEXT_DIST_DIR=.next-test` | Give a second dev server its own build folder |

Every call to the server goes through `lib/api.ts` (auth and student), `lib/api-staff.ts` (teacher and admin) and
`lib/http.ts` (token, error mapping), so screens never use `fetch` directly.

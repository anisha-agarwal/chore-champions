# E2E Tests

You are a pipeline agent running and fixing Playwright E2E tests for Chore Champions.

## Context

- **Plan file**: `{{PLAN_FILE}}`
- **Session dir**: `{{SESSION_DIR}}`
- **Base ref**: `{{BASE_REF}}`

## Pre-flight: Run New Migrations

Before running tests, check if there are new Supabase migrations:

```bash
git diff {{BASE_REF}}...HEAD -- supabase/migrations/
```

If new migrations exist, run them against the live database using the Management API:
1. Source `.env.local` for `SUPABASE_ACCESS_TOKEN`
2. For each new migration file, execute the SQL via:
   ```bash
   curl -s -X POST "https://api.supabase.com/v1/projects/eebssnhneusiyuffoajj/database/query" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"query\": \"$(cat <migration_file>)\"}"
   ```

## Run E2E Tests

```bash
npm run test:e2e
```

## Test Infrastructure

- Auth setup: `e2e/auth.setup.ts` creates `.auth/parent.json` and `.auth/child.json`
- Global setup: `e2e/global-setup.ts` bootstraps test users and family
- Global teardown: `e2e/global-teardown.ts` cleans up test data
- Test accounts: `e2e-parent@chore-champions-test.local` / `e2e-child@chore-champions-test.local`
- New spec files must be added to `testMatch` in `playwright.config.ts`

## Fix Failures

If tests fail:
1. Read the error output carefully — identify root cause.
2. Check if it's a test issue or a source code issue.
3. Fix the code (not the test expectations, unless the test is wrong).
4. Re-run: `npm run test:e2e`
5. Repeat up to 3 times.

## Output

After tests pass: `forge execute pass e2e`
If tests cannot be fixed: `forge execute fail e2e "reason"`

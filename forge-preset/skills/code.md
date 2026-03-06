# Implement Plan

You are a pipeline agent implementing code changes for Chore Champions.

## Context

- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind CSS v4
- **Plan file**: `{{PLAN_FILE}}`
- **Base ref**: `{{BASE_REF}}`
- **Session dir**: `{{SESSION_DIR}}`

## Instructions

1. Read the plan file thoroughly. Understand every file to create or modify.
2. Read `CLAUDE.md` for project conventions.
3. Read existing code before modifying — understand patterns already in use.
4. Implement all changes described in the plan:
   - Server Components by default. `'use client'` only when needed.
   - Use existing `components/ui/` before creating new ones.
   - Mobile-first Tailwind: base styles, then `sm:`, `md:` breakpoints.
   - Strict TypeScript. No `any`. Shared types in `lib/types.ts`.
   - New tables/columns need migrations in `supabase/migrations/`.
   - Always add RLS policies for new tables.
5. Run `npm run build` to verify the build passes.

## Tests

You MUST write tests for all new code. Target 100% coverage on new files.

- **Unit tests** (`__tests__/`): Test all utility functions, hooks, and component behavior using React Testing Library. Follow existing patterns in `__tests__/`.
- **DB integration tests** (`__tests__/db/`): If the plan adds new RPCs or migrations, write `.db.test.ts` files that test the RPCs against the real database using `callRpcAsUser()` from `__tests__/db/helpers/db-test-helpers.ts`.
- Run `npm test -- --coverage` and verify new files have 100% coverage.
- Run `npm run test:db` if you wrote DB tests.
- Tests must be self-contained: create data, clean up after.
- Test behavior, not implementation.

## Supabase Migrations

If the plan requires database changes:
- Create migration files in `supabase/migrations/` using the sequential naming pattern (e.g., `013_feature_name.sql`).
- Include RLS policies. Use `SECURITY DEFINER` for elevated permissions.
- Test SQL locally if possible.

## Output

Write a checklist of completed items to `{{SESSION_DIR}}/code-checklist.json`:

```json
{
  "checklist": [
    {"id": "1", "criteria": "Created component X", "evidence": "app/components/x.tsx exists"},
    {"id": "2", "criteria": "Added migration", "evidence": "supabase/migrations/013_foo.sql exists"}
  ]
}
```

Then call: `forge execute pass code`
If you cannot complete the implementation: `forge execute fail code "reason"`

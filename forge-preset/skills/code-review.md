# Code Review

You are reviewing code changes you did not write for Chore Champions. Be thorough but fair.

## Context

- **Plan file**: `{{PLAN_FILE}}`
- **Session dir**: `{{SESSION_DIR}}`
- **Base ref**: `{{BASE_REF}}`

## Instructions

1. Read the plan file to understand the intended changes.
2. Read `CLAUDE.md` for project conventions and rules.
3. Run `git diff {{BASE_REF}}...HEAD` to see all changes.
4. Review for:
   - **Correctness**: Does the code do what the plan says? Logic bugs?
   - **Security**: Injection, XSS, credential leaks, missing RLS policies, OWASP top-10?
   - **Types**: Strict TypeScript, no `any`, proper type guards for `unknown`?
   - **Tests**: Are new features tested? Do tests verify behavior, not implementation?
   - **Supabase**: Migrations have RLS policies? `SECURITY DEFINER` used correctly?
   - **React**: Server Components where possible? `'use client'` only when needed?
   - **Style**: Consistent naming (kebab-case files, PascalCase components, camelCase functions)?
   - **Simplicity**: Over-engineering? Unnecessary abstractions? Premature optimization?
   - **Accessibility**: Semantic HTML, keyboard accessible, labels on form inputs?

## Output

Write a JSON verdict file to `{{SESSION_DIR}}/code-review-verdict.json`:

```json
{
  "verdict": "CLEAN",
  "issues": []
}
```

Or if issues are found:

```json
{
  "verdict": "HAS_ISSUES",
  "issue_count": 3,
  "issues": [
    {
      "file": "src/foo.ts",
      "line": 42,
      "severity": "error",
      "message": "SQL injection via unsanitized user input"
    }
  ]
}
```

Severity levels: `error` (must fix), `warning` (should fix), `info` (suggestion).

After writing the verdict, call `forge execute pass code_review` if CLEAN,
or `forge execute fail code_review` if HAS_ISSUES.

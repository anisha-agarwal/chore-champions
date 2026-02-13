# Chore Champions

A family chore tracking app where kids earn points for completing tasks ("quests").

## Global Rules

### Mindset
- Correctness over speed. Stop and think before acting.
- If unsure, ask — don't guess.
- Read existing code before modifying.
- Find root causes, don't patch symptoms.

### Code Quality
- Simple > clever. Use existing libraries over custom code.
- Imports at top: external → internal → types.
- Comments explain *why*, not *what*.
- Handle errors with user-friendly messages.

### React & Next.js
- Server Components by default. `'use client'` only when needed.
- Use existing `components/ui/` before creating new ones.
- Mobile-first Tailwind: base styles, then `sm:`, `md:` breakpoints.

### TypeScript
- Strict types. Avoid `any` — use `unknown` with type guards.
- Shared types in `lib/types.ts`, component-specific types colocated.

### Supabase
- New tables/columns need migrations in `supabase/migrations/`.
- Always add RLS policies. Use `SECURITY DEFINER` for elevated permissions.

### Security
- Never trust user input. No secrets in code — use env variables.

### Testing
- Test behavior, not implementation. E2E for flows, unit for logic.
- Tests are self-contained: create data, clean up after.
- Run all tests after changes: `npm run lint && npm test && npm run test:e2e`

### Accessibility
- Semantic HTML: `<button>` for actions, `<a>` for navigation.
- Keyboard accessible. Form inputs need `<label>` elements.

### Performance
- Lazy load with `dynamic()`. Only `useMemo`/`useCallback` when measured.
- Batch queries. Select only needed columns.

### UX
- Show loading states. Disable buttons during submission.
- Provide feedback (toasts, error messages). Guide users in empty states.

### Naming
- Files: `kebab-case` | Components: `PascalCase` | Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` | Types: `PascalCase` | Tests: `*.test.tsx`

### Workflow
1. Start: `git checkout main && git pull`, create branch `feature/issue-N-desc`
2. Develop: Small commits, run tests frequently, update browser automation if needed
3. Push: Run full test suite, self-review diff, check for console.logs/secrets
4. PR: Summary + test plan + `Closes #N`, screenshots for UI changes
5. Merge: Return to main, delete branch, run migrations, verify in prod

### When Stuck
- Re-read error messages. Check existing code for patterns.
- Step back if it feels too complex. Ask rather than assume.

### Working with Claude Code
- Start complex features with an ADR. Reference issue numbers.
- Ask for tests after features. Give specific UI feedback.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Build for production
- `npm test` — Run unit tests (Jest)
- `npm run test:e2e` — Run E2E tests (Playwright)
- `npm run lint` — Run ESLint

## Tech Stack

Next.js 16 (App Router) • React 19 • TypeScript • Supabase • Tailwind CSS v4

## Project Structure

```
app/(auth)/        — Login, signup, join
app/(dashboard)/   — Quests, rewards, family, me
components/ui/     — Button, Modal, Avatar, etc.
components/tasks/  — TaskCard, TaskForm, TaskList
components/family/ — Member components
lib/               — Supabase client, types, utils
```

## Testing

- Unit tests in `__tests__/` (React Testing Library)
- E2E tests in `e2e/` (Playwright)
- Auth: `e2e/auth.setup.ts` → `.auth/parent.json`, `.auth/child.json`
- Smoke: `npm run pw:smoke` | Demo: `scripts/playwright-demo.ts`

## Database

Tables: `profiles`, `families`, `tasks`, `task_completions`, `rewards`

## Architecture Decision Records

Located in `docs/adr/`. Create ADR before complex features. Review existing ADRs for patterns.

# Chore Champions

A family chore tracking app where kids earn points for completing tasks ("quests").

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm test` - Run unit tests (Jest)
- `npm run test:e2e` - Run E2E tests (Playwright)
- `npm run lint` - Run ESLint

## Tech Stack

- Next.js 16 with App Router
- React 19, TypeScript
- Supabase (auth + database)
- Tailwind CSS v4

## Code Style

- Functional React components with hooks
- Use `'use client'` directive for client components
- Import from `@/components`, `@/lib` (absolute paths)
- Use `cn()` from `@/lib/utils` for conditional classNames

## Project Structure

```
app/
  (auth)/      - Login, signup, join pages
  (dashboard)/ - Main app pages (quests, rewards, family, me)
components/
  ui/          - Reusable UI components (Button, Modal, Avatar, etc.)
  tasks/       - Task-related components (TaskCard, TaskForm, TaskList)
  family/      - Family member components
  layout/      - NavBar, WeekPicker
lib/
  supabase/    - Supabase client setup
  types.ts     - TypeScript types
  utils.ts     - Utility functions
```

## Testing

- Unit tests in `__tests__/` mirroring source structure
- Use React Testing Library
- Run single test: `npm test -- task-card`
- Add/update tests with every bug fix and new feature (unit and e2e as needed)

## Database

- Supabase tables: `profiles`, `families`, `tasks`, `task_completions`, `rewards`
- Recurring tasks use `completion_date` in `task_completions` for per-day tracking

## Git Workflow

- Create a separate branch for each bug fix or feature
- Open a PR for review
- Only merge after CI passes

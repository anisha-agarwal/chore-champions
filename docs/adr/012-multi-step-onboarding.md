# ADR-012: Multi-Step Onboarding Flow

**Status:** Proposed
**Issue:** #35
**Date:** 2026-02-21

## Context

Currently, the signup page collects display name, role, email, and password on a single page, then drops users directly into the dashboard. Users who sign up without an invite code have no family and see empty states everywhere — no quests, no family members, no rewards. This creates a confusing first-run experience that likely contributes to early abandonment.

The app needs a post-authentication onboarding flow that ensures every user belongs to a family and has a role and avatar configured before reaching the dashboard. This flow must work for both email signup and OAuth authentication, and must handle the case where a user already has a family (e.g., they signed up via an invite link on the `/join/[code]` page).

## Decision

### Separate `/onboarding` Route

The onboarding flow lives at `app/(auth)/onboarding/page.tsx`, separate from the signup page. This keeps signup simple (just credentials) and ensures onboarding runs regardless of how the user authenticated — email signup, OAuth callback, or invite code join. All post-auth redirects point to `/onboarding` instead of `/quests`.

### Two-Step Flow with Conditional Step Skipping

The onboarding has two logical steps:

1. **Family step** — Join an existing family via invite code, or create a new family
2. **Role + Avatar step** — Select parent/child role and pick an avatar

Users who already have a `family_id` (e.g., invite code signups via the `/join/[code]` page) skip step 1 entirely and go straight to step 2. This avoids redundant prompts while ensuring every user completes role and avatar selection.

### Dashboard Layout Redirect Guard

Rather than adding complex middleware logic (which cannot efficiently query Supabase for profile data), the `app/(dashboard)/layout.tsx` checks `profile.family_id` after authentication. If `family_id` is null, the user is redirected to `/onboarding`. This prevents users from accessing any dashboard page without completing onboarding, using a check that runs on every dashboard page load via the shared layout.

### Middleware Protects `/onboarding`

The `/onboarding` route is added to the middleware's protected route list, ensuring unauthenticated users cannot access it. The middleware's default redirect for authenticated users visiting auth pages (login, signup) is changed from `/quests` to `/onboarding`.

### Role Removed from Signup and Join Pages

The `RoleSelector` component is removed from both the signup page and the join page. Role selection moves entirely to onboarding step 2. This simplifies the signup form and consolidates profile configuration into one place. The default role remains `'child'` (set during signup), updated during onboarding.

### Family Membership Mandatory, Inviting Members Optional

Users must either join or create a family to proceed past step 1 — there is no "skip" option. However, after creating a family, inviting additional members is not part of the onboarding flow. Invite codes are accessible from the family management page in the dashboard. This keeps onboarding focused on the minimum viable setup.

### Client-Side Step State Management

The onboarding page is a client component that manages step state internally: `'family-choose' | 'family-join' | 'family-create' | 'role-avatar'`. On mount, it fetches the user's profile to determine the starting step. Step transitions are handled via callbacks passed to child components. No server actions or URL-based step routing — the entire flow is a single page with component swapping.

### Reuse Existing Components

The `RoleSelector` component (`components/ui/role-selector.tsx`) is reused directly in the role+avatar step. The avatar grid follows the existing pattern from `app/(dashboard)/me/page.tsx`, using `AVATAR_OPTIONS` from `lib/types.ts`. The family join flow reuses the existing `get_family_by_invite_code` RPC. No new database tables, columns, or RLS policies are needed.

## Consequences

### Positive
- Every user is guaranteed to have a family, role, and avatar before reaching the dashboard, eliminating empty-state confusion on first login
- Works identically for email signup, OAuth, and invite code flows — a single onboarding path regardless of authentication method
- No database migration required — the flow uses existing tables and columns (`profiles.family_id`, `profiles.role`, `profiles.avatar_url`, `families`)
- Removing role selection from signup simplifies the signup form, reducing friction at the account creation step
- Conditional step skipping means invite code users get a streamlined experience (one step instead of two)
- Dashboard layout guard is a reliable catch-all — even if a user somehow bypasses onboarding, they cannot access the dashboard without a family

### Negative
- Adds a new page and three new components, increasing the codebase surface area
- Dashboard layout now makes a profile query on every page load to check `family_id`, adding a small performance cost (mitigated by Supabase's connection pooling and the query being a simple single-row fetch by user ID)
- Client-side step management means the step state is lost on page refresh — the user restarts from the beginning (mitigated by the profile check determining the correct starting step on mount)
- Changing the default redirect from `/quests` to `/onboarding` affects all authentication flows, requiring coordinated updates to signup, join, callback, and middleware

## Alternatives Considered

1. **Embed onboarding in the signup form**: Add family creation/joining and avatar selection as additional fields on the existing signup page. This would make the signup form significantly longer and more complex, increasing abandonment risk. It also would not work for OAuth users who bypass the signup form entirely. Rejected because a separate post-auth flow handles all authentication methods uniformly.

2. **URL-based step routing (`/onboarding/family`, `/onboarding/role`)**: Use separate routes for each onboarding step instead of client-side state management. This would make steps bookmarkable and support browser back/forward navigation, but adds routing complexity, requires server-side step validation, and is over-engineered for a two-step flow that most users complete in under a minute. Rejected for unnecessary complexity.

3. **Middleware-based profile check instead of layout guard**: Check `profile.family_id` in the Supabase middleware and redirect to `/onboarding` before the dashboard loads. Middleware runs on the edge and cannot efficiently query the Supabase database for profile data — it only has access to the auth session. Adding a database call to middleware would add latency to every request. Rejected because the layout-level check is simpler and runs only on dashboard page loads.

4. **Optional onboarding with "skip" button**: Allow users to skip onboarding and reach the dashboard without a family, showing a persistent banner prompting them to complete setup. This would preserve the current empty-state problem for users who skip, and the app's core features (quests, rewards) require a family to function at all. Rejected because family membership is a prerequisite for the app to be useful.

5. **Server Component with server actions for step transitions**: Implement onboarding as a Server Component using `redirect()` and server actions instead of client-side state. This would require form submissions for every step transition and lose the smooth single-page-app feel. The onboarding flow benefits from immediate client-side transitions and optimistic updates. Rejected for worse user experience.

## Diagram

```mermaid
flowchart TD
    A[User authenticates] --> B{Auth method?}

    B -->|Email signup| C[Signup page]
    B -->|OAuth| D[Auth callback]
    B -->|Invite code| E[Join page]

    C -->|Redirect| F[/onboarding]
    D -->|Redirect| F
    E -->|Sets family_id, redirect| F

    F --> G[Fetch profile]
    G --> H{family_id exists?}

    H -->|No| I[Step 1: Family]
    H -->|Yes| L[Step 2: Role + Avatar]

    I --> J{Choose mode}
    J -->|Join existing| K1[Enter invite code]
    J -->|Create new| K2[Enter family name]

    K1 -->|Validate code, set family_id| L
    K2 -->|Insert family, set family_id| L

    L --> M[Select role]
    M --> N[Select avatar]
    N --> O[Update profile]
    O --> P[Redirect to /quests]

    P --> Q[Dashboard layout]
    Q --> R{family_id exists?}
    R -->|Yes| S[Render dashboard]
    R -->|No| F
```

## Implementation

Key files and changes:

**New files (4 source, 4 test, 1 E2E):**
- `app/(auth)/onboarding/page.tsx` — Client component with step state management, profile fetch on mount, step transitions, redirect to `/quests` on completion
- `components/onboarding/step-indicator.tsx` — Horizontal step progress indicator with circles and connecting lines, supports variable step count and labels
- `components/onboarding/family-step.tsx` — Three sub-modes (choose, join, create) with invite code validation via Supabase RPC and family creation via insert
- `components/onboarding/role-avatar-step.tsx` — Reuses `RoleSelector`, adds avatar grid from `AVATAR_OPTIONS`, updates profile on completion
- `__tests__/components/onboarding/step-indicator.test.tsx` — Step rendering, current step highlighting, label display
- `__tests__/components/onboarding/family-step.test.tsx` — Sub-mode transitions, join/create flows, error handling
- `__tests__/components/onboarding/role-avatar-step.test.tsx` — Role selection, avatar selection, profile update, loading/error states
- `__tests__/components/onboarding/onboarding-page.test.tsx` — Conditional step skipping, step transitions, completion redirect
- `e2e/onboarding.spec.ts` — Full onboarding flow, join family flow, invite code signup flow, dashboard redirect guard

**Modified files (5):**
- `app/(auth)/signup/page.tsx` — Remove `RoleSelector`, remove role state, redirect to `/onboarding` instead of `/quests`
- `app/(auth)/join/[code]/page.tsx` — Remove `RoleSelector`, remove role state, redirect to `/onboarding`
- `app/auth/callback/route.ts` — Change default redirect from `/quests` to `/onboarding`
- `lib/supabase/middleware.ts` — Add `/onboarding` to protected routes, change auth redirect to `/onboarding`
- `app/(dashboard)/layout.tsx` — Add profile fetch and `family_id` null check with redirect to `/onboarding`

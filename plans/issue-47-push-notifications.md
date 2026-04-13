# Issue #47 — Push Notifications & Reminders

**Status:** Draft — awaiting review
**Branch:** `feature/issue-47-push-notifications`
**Related:** #46 (approval workflow — not yet built), #38–40 (gamification), #57 (initiative reward)

---

## 1. Goal

Let families opt in to web push notifications so kids and parents get timely, relevant nudges about chores, milestones, and family activity — without pulling them back into the app manually.

## 2. Scope

### In scope (this PR — "Phase 1: foundation + event-driven pushes")

- `push_subscriptions` + `notification_preferences` tables with RLS
- VAPID keypair generation + env-var wiring
- Service worker at `public/sw.js` handling `push` and `notificationclick`
- Client subscribe/unsubscribe flow (registers SW, asks permission, posts subscription to API)
- Server send helper `lib/push/send.ts` using `web-push` npm package
- API routes:
  - `POST /api/push/subscribe` — store subscription
  - `POST /api/push/unsubscribe` — remove subscription
  - `GET /api/push/preferences` — read prefs (auto-creates default row)
  - `PATCH /api/push/preferences` — update prefs
- Settings UI: new **Notifications** tab on `/me` with enable toggle, per-type toggles, quiet-hours inputs, and a "Send test notification" button
- **Two event-driven push types wired end-to-end:**
  1. **Task completed (parent)** — when a child inserts a `task_completions` row, each parent in the family with the `task_completed` pref enabled gets a push: *"Leo completed 'Take out trash'"*. Fires from a new `POST /api/tasks/complete` route that wraps the existing client-side insert (see §6 for why we're refactoring this path).
  2. **Streak milestone (child)** — when `claim_streak_milestone` RPC returns success on the client, the client calls `POST /api/push/trigger/streak-milestone` which sends the child a celebratory push. Parents in the family also get one if they have the pref on.
- Quiet hours + per-type preference enforcement inside `lib/push/send.ts`
- Full unit + E2E test coverage (see §9)
- Observability events: `push_subscription_created`, `push_subscription_deleted`, `push_notification_sent`, `push_notification_failed`

### Explicitly out of scope (defer to issue #47b / new issue)

- Scheduled notifications: morning task reminders, overdue alerts, streak-at-risk warnings, weekly summary. These need Vercel Cron or Supabase Edge Function scheduling — separate infra decision, separate PR.
- Approval request / approval result pushes — blocked on issue #46 (approval workflow doesn't exist yet).
- Achievement-unlocked pushes for badges (blocked on issue #39).
- iOS Safari home-screen PWA push — web push works on iOS 16.4+ only for installed PWAs; we'll document the limitation in the UI but not build install prompts here.
- Rich notification actions (Accept/Dismiss buttons in the notification itself).
- Notification history / in-app inbox.

**Reason to split:** Scheduled pushes are a separate architectural conversation (where does the cron run? who pays? what's the failure mode?). Bundling them makes the PR unreviewable and couples unrelated risks.

## 3. Architecture

```
┌──────────────┐   subscribe    ┌─────────────────────┐
│   Browser    │ ─────────────► │  /api/push/*        │
│              │                │  (Next.js routes)    │
│  sw.js       │                └──────────┬──────────┘
│  ↑ push      │                           │
│  ↑ notif     │                           ▼
└──────┬───────┘                ┌─────────────────────┐
       │                        │  Supabase           │
       │        web-push        │  push_subscriptions │
       │      ◄────────────     │  notification_prefs │
       │                        └─────────────────────┘
       │
       │                        ┌─────────────────────┐
       └────────────────────────│  Web Push Service   │
              (VAPID)           │  (FCM / Mozilla)    │
                                └─────────────────────┘
```

**Send path:** Event happens (task completion, streak milestone) → API route handler calls `sendPushToUser(userId, { type, title, body, url })` → helper reads `notification_preferences` (skips if disabled or in quiet hours) → reads all `push_subscriptions` rows → `web-push.sendNotification()` in parallel → on `410 Gone`, deletes the stale subscription → logs observability event.

## 4. Database changes

**Migration:** `supabase/migrations/017_add_push_notifications.sql`

```sql
-- ============================================================================
-- Push Notifications
-- ============================================================================

CREATE TABLE push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  p256dh_key   text        NOT NULL,
  auth_key     text        NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_subscriptions" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_subscriptions" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------

CREATE TYPE notification_type AS ENUM (
  'task_completed',       -- parent: child completed a task
  'streak_milestone',     -- child + parent: streak milestone hit
  'test'                  -- "Send test notification" button
);

CREATE TABLE notification_preferences (
  user_id          uuid        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled     boolean     NOT NULL DEFAULT true,
  types_enabled    jsonb       NOT NULL DEFAULT '{"task_completed":true,"streak_milestone":true,"test":true}'::jsonb,
  quiet_hours_start smallint   CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end   smallint   CHECK (quiet_hours_end BETWEEN 0 AND 23),
  timezone         text        NOT NULL DEFAULT 'UTC',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Design notes:**
- `types_enabled` as JSONB (not a join table) keeps the common path cheap — one row per user, one query per send.
- `quiet_hours_start/end` are ints in the user's local timezone. `NULL` = no quiet hours. Overnight ranges (e.g. 22→7) handled in app logic (`start > end` means the range wraps midnight).
- Using a Postgres ENUM for `notification_type` for server-side validation; client passes strings.
- `UNIQUE (user_id, endpoint)` prevents duplicate rows when a user re-subscribes from the same device.
- No `SECURITY DEFINER` RPC needed — all writes are scoped to `auth.uid()` and expressible as plain RLS.

## 5. File tree

```
plans/issue-47-push-notifications.md                    (this file)

supabase/migrations/017_add_push_notifications.sql      NEW

public/sw.js                                            NEW — service worker
next.config.ts                                          EDIT — sw.js cache headers

lib/push/
  send.ts                                               NEW — sendPushToUser helper
  subscribe.ts                                          NEW — client SW register + subscribe
  vapid.ts                                              NEW — VAPID key helpers, urlBase64ToUint8Array
  quiet-hours.ts                                        NEW — pure isWithinQuietHours(now, start, end, tz)
  types.ts                                              NEW — NotificationType, Preferences types

lib/observability/constants.ts                          EDIT — add 4 new APP_EVENT_TYPES

lib/types.ts                                            EDIT — export new types

app/api/push/subscribe/route.ts                         NEW
app/api/push/unsubscribe/route.ts                       NEW
app/api/push/preferences/route.ts                       NEW — GET + PATCH
app/api/push/test/route.ts                              NEW — "send test" button
app/api/push/trigger/streak-milestone/route.ts          NEW — called after claim_streak_milestone

app/api/tasks/complete/route.ts                         NEW — wraps completion insert + fires parent push

app/(dashboard)/quests/page.tsx                         EDIT — call new API route instead of direct insert
components/streaks/streak-tab.tsx                       EDIT — call trigger route after claim (if that's the claim site)

app/(dashboard)/me/page.tsx                             EDIT — add "Notifications" tab

components/me/notification-settings-tab.tsx             NEW — the settings UI
components/me/permission-prompt.tsx                     NEW — "Enable notifications" CTA with browser permission state

__tests__/lib/push/send.test.ts                         NEW
__tests__/lib/push/subscribe.test.ts                    NEW
__tests__/lib/push/quiet-hours.test.ts                  NEW
__tests__/lib/push/vapid.test.ts                        NEW
__tests__/api/push/subscribe.test.ts                    NEW
__tests__/api/push/unsubscribe.test.ts                  NEW
__tests__/api/push/preferences.test.ts                  NEW
__tests__/api/push/test.test.ts                         NEW
__tests__/api/push/trigger-streak-milestone.test.ts     NEW
__tests__/api/tasks/complete.test.ts                    NEW
__tests__/components/me/notification-settings-tab.test.tsx   NEW
__tests__/components/me/permission-prompt.test.tsx      NEW

__tests__/db/push-notifications.test.ts                 NEW — RLS + constraints (npm run test:db)

e2e/push-notifications.spec.ts                          NEW
e2e/push-delivery.spec.ts                               NEW
e2e/push-helpers.ts                                     NEW
playwright.config.ts                                    EDIT — add to testMatch regex

.env.local                                              EDIT — VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
package.json                                            EDIT — add web-push dep
```

**Estimated diff:** ~1,800 LOC production + ~1,400 LOC tests.

## 6. Implementation notes

### 6.1 Why a new `POST /api/tasks/complete` route?

Currently `app/(dashboard)/quests/page.tsx:277` inserts into `task_completions` directly from the client. To send a push to the parent when a child completes a task, we need server code that runs after the insert. Options considered:

| Option | Pros | Cons |
|---|---|---|
| DB trigger → Edge Function | Robust, decoupled | Needs edge function infra — out of scope |
| pg_net from trigger | No extra infra | Brittle, hard to test, secrets in DB |
| **Server route (chosen)** | Easy to test, same stack as rest of app, observable | Requires refactoring one client call |

The new route validates the caller owns the task's family, inserts the completion, then triggers the push. The client swaps one `supabase.from(...).insert(...)` call for `fetch('/api/tasks/complete', ...)`. All existing completion behavior (points award, streak update via DB triggers) is preserved because we're still writing the same row to the same table.

### 6.2 `web-push` package

- Installed as a regular dependency (server-only code path; not bundled client-side because `lib/push/send.ts` is only imported from route handlers).
- Types: `@types/web-push`.
- VAPID keys generated once with `npx web-push generate-vapid-keys`, stored in `.env.local` and GitHub secrets.

### 6.3 Service worker (`public/sw.js`)

Kept intentionally tiny and dependency-free:

```js
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/notification-192.png',
      badge: '/icons/badge-72.png',
      data: { url: payload.url || '/' },
      tag: payload.tag,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
```

Served with `Cache-Control: public, max-age=0, must-revalidate` via `next.config.ts` header rule.

### 6.4 Quiet hours logic

`lib/push/quiet-hours.ts` exports a pure function — no DB, no clock reads — so it's trivially unit-testable:

```ts
export function isWithinQuietHours(
  now: Date,
  startHour: number | null,
  endHour: number | null,
  timezone: string
): boolean
```

Handles `null` (no quiet hours), same-day range (9→17), and overnight range (22→7). Uses `Intl.DateTimeFormat` with the user's tz to get the current hour.

### 6.5 Stale subscription cleanup

`web-push.sendNotification()` throws with `statusCode: 410` (Gone) or `404` when the subscription is dead. `sendPushToUser` catches these and deletes the row. Any other error is logged as `push_notification_failed` observability event and swallowed — a push failure must never break the triggering user action.

### 6.6 Observability

Add to `lib/observability/constants.ts` `APP_EVENT_TYPES`:
- `push_subscription_created`
- `push_subscription_deleted`
- `push_notification_sent`
- `push_notification_failed`

Add allowed metadata keys: `notificationType`, `subscriberCount`, `failureReason`.

## 7. UI design

### 7.1 Notifications tab on `/me`

```
┌─ Notifications ──────────────────────────────────────┐
│                                                      │
│  Push notifications                     [   ○]      │   ← master toggle
│  Get reminders and celebrations on this device.     │
│                                                      │
│  ┌─ Permission: Allowed ────────┐                   │   (or "Blocked" / "Not asked")
│  │  Unsubscribe from this device │                   │
│  └───────────────────────────────┘                   │
│                                                      │
│  ─ What to notify me about ──                        │
│                                                      │
│  Kid completes a task              [●  ]            │   (parents only)
│  Streak milestone reached          [●  ]            │
│                                                      │
│  ─ Quiet hours ──                                    │
│                                                      │
│  Don't send between  [22:00]  and  [07:00]           │
│                                                      │
│  ─────────────────────────                           │
│                                                      │
│  [Send test notification]                            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Master toggle off → all type toggles disabled + greyed
- Permission `denied` → show instruction: "You'll need to enable notifications in your browser settings"
- Permission `default` → "Enable notifications" CTA triggers subscribe flow
- Per-role visibility: "Kid completes a task" toggle only shown to parents
- Changes debounced 500ms then PATCH to `/api/push/preferences`
- Test button disabled if master toggle off or permission not granted

### 7.2 Notification content

| Type | Title | Body | URL |
|---|---|---|---|
| task_completed | `🎉 {childName} completed a task` | `"{taskTitle}" — tap to see` | `/quests` |
| streak_milestone | `🔥 {days}-day streak!` | `{childName} hit a {days}-day streak` | `/me?tab=streaks` |
| test | `Chore Champions test` | `Notifications are working on this device.` | `/me?tab=notifications` |

## 8. Test plan — target 100% coverage on new code

### 8.1 Unit tests (Jest + RTL)

**`lib/push/quiet-hours.test.ts`** (pure function)
- `null start/end` → `false`
- Same-day range 9→17, current 10 → `true`
- Same-day range 9→17, current 20 → `false`
- Overnight range 22→7, current 23 → `true`
- Overnight range 22→7, current 3 → `true`
- Overnight range 22→7, current 12 → `false`
- Non-UTC timezone (`'America/Los_Angeles'`) — mock Date to an absolute moment, verify tz conversion
- Boundary: exactly `start` → `true`; exactly `end` → `false`

**`lib/push/vapid.test.ts`**
- `urlBase64ToUint8Array` round-trip with known VAPID public key
- Padding handling (length % 4)

**`lib/push/subscribe.test.ts`** (client helper; mock `navigator.serviceWorker` and `PushManager`)
- `subscribe()` returns existing subscription if already subscribed
- `subscribe()` registers SW, requests permission, subscribes, POSTs to `/api/push/subscribe`
- Rejects if permission denied
- `unsubscribe()` unsubs browser side + POSTs to `/api/push/unsubscribe`
- SW registration failure bubbles up

**`lib/push/send.test.ts`** (mock `web-push` module + supabase)
- No preferences row → auto-creates default + sends
- `push_enabled = false` → no send
- Type disabled in `types_enabled` → no send
- Within quiet hours → no send (verify via injected `now`)
- Multiple subscriptions → all notified in parallel
- `410 Gone` response → row deleted, observability event logged
- Other error → `push_notification_failed` logged, no throw
- `subscriberCount` in sent observability event matches actual count

**`app/api/push/subscribe/route.test.ts`**
- 401 when unauthenticated
- 400 on missing/invalid payload (no endpoint, no keys)
- 200 on valid payload; row upserted
- Idempotent: second call with same endpoint returns 200, no duplicate

**`app/api/push/unsubscribe/route.test.ts`**
- 401 when unauthed
- 400 on missing endpoint
- 200 on success, row deleted
- 200 when row didn't exist (idempotent)

**`app/api/push/preferences/route.test.ts`** (GET + PATCH)
- GET 401 unauthed
- GET auto-creates default row if none exists
- GET returns existing row
- PATCH 401 unauthed
- PATCH 400 on invalid `quiet_hours_start` (<0, >23, non-int)
- PATCH 400 on invalid `types_enabled` shape
- PATCH 200 and merges partial updates (only `push_enabled` provided leaves other fields untouched)

**`app/api/push/test/route.test.ts`**
- 401 unauthed
- Calls `sendPushToUser` with type `'test'`
- Returns 200 + `{ sent: count }`

**`app/api/push/trigger/streak-milestone/route.test.ts`**
- 401 unauthed
- 400 on missing `days` in body
- Sends push to child
- Sends push to all parents in family
- Parent pref off → only child notified

**`app/api/tasks/complete/route.test.ts`**
- 401 unauthed
- 400 on missing `taskId`
- 403 if user not in task's family
- Inserts completion row
- Fires `sendPushToUser` once per parent with type `'task_completed'`
- Push failure does NOT fail the request (critical: completion must succeed)

**`components/me/notification-settings-tab.test.tsx`**
- Renders master toggle based on fetched prefs
- Parent sees "Kid completes a task" toggle; child does not
- Toggling master → PATCH debounced call
- Toggling a type → PATCH with merged `types_enabled`
- Permission denied → shows blocked message, CTA disabled
- Permission default → clicking "Enable" calls subscribe helper
- "Send test notification" → POSTs to `/api/push/test`, shows toast on success
- Loading state shows skeleton
- Error state shows retry

**`components/me/permission-prompt.test.tsx`**
- Renders state based on `Notification.permission` (mock)
- Click calls `Notification.requestPermission`
- Calls `onGranted` callback on grant

### 8.2 E2E tests — UI flows (`e2e/push-notifications.spec.ts`)

Pre-grant notification permission at the context level (`permissions: ['notifications']`) so the real subscribe path runs. No request stubbing for push endpoints — we want the real rows written and read, and we'll clean them up in `afterEach` via `runSQL` helper (already available from `e2e/supabase-admin.ts`).

**parent project:**
- Navigate to `/me`, click `Notifications` tab
- Master toggle reflects fetched prefs (default on)
- Toggle master off → PATCH to `/api/push/preferences` lands → reload → still off
- Toggle master on → `subscribe()` runs → row appears in `push_subscriptions` (assert via `runSQL`)
- Toggle `task_completed` off → PATCH with merged types → reload confirms
- Set quiet hours 22→7 → PATCH observed → row reflects values
- Click `Send test` button → see success toast
- Unsubscribe via the tab → row deleted from `push_subscriptions` (assert via `runSQL`)

**child project:**
- Navigate to `/me` → `Notifications` tab
- Parent-only `task_completed` toggle NOT rendered
- `streak_milestone` toggle rendered and togglable

### 8.3 E2E push delivery tests (`e2e/push-delivery.spec.ts`)

These tests exercise the real end-to-end path — our server calls `web-push.sendNotification()`, and we use Chrome DevTools Protocol `ServiceWorker.deliverPushMessage` to deliver the push payload to the SW without going through FCM/Mozilla push. The SW's `push` handler runs for real, `registration.showNotification()` is called for real, and we assert the resulting notification via `registration.getNotifications()` evaluated in the page context.

**Helper (`e2e/push-helpers.ts`):**

```ts
export async function getShownNotifications(page: Page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const notifs = await reg.getNotifications();
    return notifs.map((n) => ({ title: n.title, body: n.body, tag: n.tag, data: n.data }));
  });
}

export async function clearNotifications(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const notifs = await reg.getNotifications();
    notifs.forEach((n) => n.close());
  });
}

export async function waitForNotification(page: Page, predicate: (n: { title: string }) => boolean, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const notifs = await getShownNotifications(page);
    const match = notifs.find(predicate);
    if (match) return match;
    await page.waitForTimeout(100);
  }
  throw new Error('Timed out waiting for notification');
}
```

We don't need to call CDP `deliverPushMessage` manually — `web-push.sendNotification()` POSTs to the browser's push endpoint which, in CI, is Chrome's test-mode push service that delivers synchronously in the same browser instance. If that proves flaky, we fall back to an explicit CDP session:

```ts
const cdp = await context.newCDPSession(page);
await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data });
```

**Tests:**

1. **Test-button delivery (parent)** — subscribe, click "Send test", assert notification with title matching "Chore Champions test" appears via `waitForNotification`.
2. **Click → navigation** — after #1, call `notification.click()` via `page.evaluate`, assert page navigates to `/me?tab=notifications`.
3. **Task completion → parent push (two contexts in one spec)** — launch a second browser context with `.auth/child.json` alongside the parent context with `.auth/parent.json`. Both subscribe. Child completes a real task via the UI (using the existing quests flow). Assert the parent context's SW has a notification whose body contains the task title. Assert the child context has no such notification.
4. **Streak milestone → child push** — same two-context pattern. Claim milestone (seed the streak via `runSQL` to a pre-milestone state first). Assert child context received streak push; assert parent also received it if their pref is on; flip parent pref off and repeat, assert parent does NOT receive it.
5. **Type toggle suppresses send** — as parent, toggle `task_completed` off. Have child complete a task. `getShownNotifications` returns empty for parent. (Wait a fixed 1s to give any racing send time to land, then assert still empty.)
6. **Quiet hours suppress send** — set quiet hours spanning the current hour (compute via `new Date().getHours()` and set start=current-1, end=current+1). Trigger test button. Assert no notification. Restore prefs.
7. **Permission revoked → UI reflects state** — call `context.clearPermissions()`. Navigate to `/me?tab=notifications`. Assert the "Blocked" message renders. Attempting to subscribe is disabled.
8. **Stale subscription cleanup** — seed a fake row via `runSQL` with a known-bad endpoint (points to a deliberately invalid push service URL). Trigger test button. Assert the bad row is deleted (via `runSQL`) and the valid row remains. Observability event `push_subscription_deleted` logged (check via `runSQL` on observability table).

**Cleanup:** `afterEach` calls `runSQL` to delete any `push_subscriptions` or `notification_preferences` rows belonging to the test users, so tests are idempotent.

**Registration:** add `push-notifications.spec.ts` and `push-delivery.spec.ts` to the `testMatch` regex in `playwright.config.ts` for both `parent` and `child` projects where applicable.

### 8.4 DB integration tests (`__tests__/db/push-notifications.test.ts`)

Runs against real Supabase via `npm run test:db`. Uses existing helpers from `__tests__/db/helpers/db-test-helpers.ts` — `callRpcAsUser()`, `ensureDbTestUser()`, plus direct `runSQL` for setup/cleanup. `maxWorkers: 1` already set in `jest.db.config.ts`.

**Setup / teardown:**
- Create two test profiles (`db-test-a`, `db-test-b`) in a shared family via `runSQL`
- Each test clears `push_subscriptions` and `notification_preferences` for both users in `afterEach`
- Use `set_config('request.jwt.claim.sub', <uuid>, true)` pattern already in helpers to simulate `auth.uid()`

**`push_subscriptions` RLS + constraints:**
- Insert as user A with `user_id = A` → succeeds
- Insert as user A with `user_id = B` → RLS denies (WITH CHECK)
- `SELECT` as user A sees only A's rows, not B's
- `DELETE` as user A on A's row → succeeds
- `DELETE` as user A on B's row → 0 rows affected (RLS filter)
- `UNIQUE (user_id, endpoint)` — second insert with same pair fails with unique violation
- Different user, same endpoint → succeeds (two devices shared by family members is allowed)
- Cascade: delete profile A → A's `push_subscriptions` rows gone

**`notification_preferences` RLS + constraints:**
- First SELECT auto-create path (done in app code, not DB): verify app layer handles missing row — covered in API unit tests; here we verify the raw SQL insert path works
- Insert as A with `user_id = A` → succeeds
- Insert as A with `user_id = B` → RLS denies
- SELECT as A sees only A's row (primary key = user_id ensures one row per user)
- UPDATE as A on A's row → succeeds
- UPDATE as A on B's row → 0 rows affected
- `quiet_hours_start = -1` → check constraint rejects
- `quiet_hours_start = 24` → check constraint rejects
- `quiet_hours_start = 23` → accepted
- `quiet_hours_start = NULL` → accepted
- `types_enabled` accepts valid JSONB, rejects non-JSONB (implicit via column type)
- Cascade: delete profile A → A's prefs row gone

**`notification_type` enum:**
- Casting `'task_completed'::notification_type` succeeds
- Casting `'bogus'::notification_type` fails with invalid enum
- Adding new enum value in future migration is non-breaking (documented, not tested)

**Observability integration:**
- None — observability is written by app code, not DB triggers, so DB tests don't assert on it.

### 8.5 Remaining manual step

Only one item can't be automated — it's a one-time setup, not a recurring test:

- [ ] Generate VAPID keypair via `npx web-push generate-vapid-keys` and add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to `.env.local` and GitHub repo secrets.

### 8.6 Coverage gate

Target 100% line + branch coverage on:
- `lib/push/*`
- `app/api/push/**`
- `app/api/tasks/complete/route.ts`
- `components/me/notification-settings-tab.tsx`
- `components/me/permission-prompt.tsx`

Run `npm test -- --coverage --collectCoverageFrom='lib/push/**' --collectCoverageFrom='app/api/push/**' ...` and fail the task if any of the above files are below 100%.

Not targeted for 100% (tested manually / integration):
- `public/sw.js` (runs in SW context; logic is intentionally trivial)

## 9. Risks & open questions

| Risk | Mitigation |
|---|---|
| iOS Safari web push only works for installed PWAs | Document in UI; don't block feature for other platforms |
| User revokes browser permission — our DB still has their subscription | `web-push` returns `410`, cleanup logic deletes row |
| VAPID keys committed by accident | Add to `.env.local` (already gitignored) + document in README |
| Push sent during task completion adds latency | Run send in `waitUntil`-equivalent: fire and return response immediately, `await` the send in a non-blocking pattern (`Promise.resolve().then(...)` inside the handler after `NextResponse` is constructed) — but keep the send synchronous in tests so assertions are deterministic. Use a `runAfterResponse` helper. |
| `types_enabled` JSONB drift if we add new types | Merge defaults at read time in `getPreferences` |
| Test user has real push subscriptions polluting DB | E2E `afterEach` deletes test users' `push_subscriptions` + `notification_preferences` rows via `runSQL`; unit tests use mocked supabase |
| CDP `deliverPushMessage` / Chrome test-mode push delivery is flaky in CI | Start with direct `web-push.sendNotification` (Chrome's in-browser push service handles it); fall back to explicit CDP session if flakes appear; last resort, mark the delivery spec as serial |
| Existing client-side completion insert is called from multiple places? | Audit `quests/page.tsx` for other insert sites before refactor; there may be a modal |

**Open questions for reviewer:**
1. Is wiring `task_completed` (parent gets notified when child finishes) acceptable as the proof-of-concept, or do you want a different event since #46 approval flow isn't built?
2. OK with refactoring `quests/page.tsx` to use a new `/api/tasks/complete` route? Alternative is a DB trigger + Edge Function, but that's new infra.
3. OK with `web-push` as a runtime dep (~500kb, but server-only)? Alternative is hand-rolling VAPID/encryption, which is materially more code to own.
4. Should prefs default to `push_enabled: true` or `false`? Plan currently says `true` but user hasn't granted browser permission yet — actual push delivery still requires that. Leaving as `true` means one fewer click once they grant permission.
5. Where is `claim_streak_milestone` called from today? The plan assumes a client-side call site — need to verify during implementation and adjust trigger location.

## 10. PR sequencing

The work ships as **five independent PRs** off `main`. Each PR is complete on its own: migration + code + unit + DB-integration + E2E tests + green CI. Each is safe to ship in isolation — shipping PR 1 without PR 2 just adds unused tables; shipping PR 2 without PR 3 gives users a subscribe UI whose test button is hidden. Code review scope stays under ~600 LOC per PR (tests included).

### PR 1 — DB schema + preferences API + observability constants
**Branch:** `feature/issue-47-push-1-schema`
**Depends on:** nothing
**Size:** ~400 LOC

- `supabase/migrations/017_add_push_notifications.sql` (tables, enum, RLS policies)
- `lib/push/types.ts` (shared TS types)
- `lib/push/quiet-hours.ts` (pure helper)
- `lib/observability/constants.ts` — add 4 new `APP_EVENT_TYPES` + metadata keys
- `app/api/push/preferences/route.ts` — GET (auto-creates default) + PATCH
- **Tests:**
  - `__tests__/db/push-notifications.test.ts` — **DB integration tests for the new tables ship in this PR** (runs via `npm run test:db`). Covers every case in §8.4: RLS on `push_subscriptions` (insert/select/delete scoped to `auth.uid()`, cross-user blocked), `UNIQUE (user_id, endpoint)` constraint, RLS on `notification_preferences`, `quiet_hours_start`/`quiet_hours_end` check constraints (reject -1, reject 24, accept 0–23, accept NULL), `notification_type` enum casting (valid + invalid), and cascade-on-profile-delete for both tables.
  - `__tests__/lib/push/quiet-hours.test.ts`
  - `__tests__/api/push/preferences.test.ts`
- **Acceptance:** migration applied in prod Supabase; `npm run test:db` green including the new DB integration file; unit tests green; `lib/push/quiet-hours.ts` + `app/api/push/preferences/route.ts` at 100% coverage.
- **User-visible:** nothing.
- **Rollback risk:** zero — new tables only, no existing code touched.

### PR 2 — Service worker + subscribe flow + settings UI
**Branch:** `feature/issue-47-push-2-subscribe-ui`
**Depends on:** PR 1 merged
**Size:** ~600 LOC

- `package.json` — add `web-push`, `@types/web-push`
- `.env.local` + GitHub secrets — VAPID keys (one-time; done before this PR opens)
- `next.config.ts` — `/sw.js` cache-control header
- `public/sw.js` — push + notificationclick handlers
- `lib/push/vapid.ts` — `urlBase64ToUint8Array` + public-key export
- `lib/push/subscribe.ts` — client `subscribe()` / `unsubscribe()`
- `app/api/push/subscribe/route.ts` + `app/api/push/unsubscribe/route.ts`
- `components/me/permission-prompt.tsx`
- `components/me/notification-settings-tab.tsx` (without test button — added in PR 3)
- `app/(dashboard)/me/page.tsx` — add Notifications tab
- **Tests:**
  - `__tests__/lib/push/vapid.test.ts`
  - `__tests__/lib/push/subscribe.test.ts`
  - `__tests__/api/push/subscribe.test.ts`
  - `__tests__/api/push/unsubscribe.test.ts`
  - `__tests__/components/me/permission-prompt.test.tsx`
  - `__tests__/components/me/notification-settings-tab.test.tsx` (covers prefs, toggles, quiet hours — no test-button cases)
  - `e2e/push-notifications.spec.ts` (the §8.2 UI flows spec — subscribe, unsubscribe, toggles, quiet hours, cleanup via `runSQL`)
- **Acceptance:** all listed files at 100% coverage; UI spec green on parent + child projects; screenshot of Notifications tab in PR description.
- **User-visible:** new Notifications tab on `/me`. Users can opt in, manage prefs, unsubscribe. **No notifications are ever delivered** because there are no triggers yet.
- **Rollback risk:** low — additive UI only; no existing flow touched.

### PR 3 — Send helper + test button + delivery E2E harness
**Branch:** `feature/issue-47-push-3-send-helper`
**Depends on:** PR 2 merged
**Size:** ~500 LOC

- `lib/push/send.ts` — `sendPushToUser(userId, payload)` with prefs + quiet-hours gate, parallel send, 410-cleanup, observability events
- `app/api/push/test/route.ts`
- `components/me/notification-settings-tab.tsx` — add "Send test notification" button
- `e2e/push-helpers.ts` — `getShownNotifications`, `waitForNotification`, `clearNotifications`
- `e2e/push-delivery.spec.ts` — initial version covering §8.3 items **1 (test-button delivery)**, **2 (click → navigation)**, **7 (permission revoked)**, **8 (stale subscription cleanup)**. Two-context parent/child tests land in PRs 4 and 5.
- **Tests:**
  - `__tests__/lib/push/send.test.ts` (all of §8.1 send tests — prefs off, type off, quiet hours, 410 cleanup, other error, parallel)
  - `__tests__/api/push/test.test.ts`
  - `__tests__/components/me/notification-settings-tab.test.tsx` — extend with test-button cases
  - `e2e/push-delivery.spec.ts` (items 1, 2, 7, 8)
- **Acceptance:** `lib/push/send.ts` + `app/api/push/test/route.ts` at 100%; delivery E2E green (real SW push via Chrome); observability rows created correctly (asserted via `runSQL`).
- **User-visible:** "Send test notification" button now works. Users get a real push on their device.
- **Rollback risk:** low — only new routes + button. Reverting removes the button; prefs and subscribe flow from PR 2 keep working.

### PR 4 — Task completion → parent push
**Branch:** `feature/issue-47-push-4-task-completed`
**Depends on:** PR 3 merged
**Size:** ~400 LOC

- `app/api/tasks/complete/route.ts` — wraps completion insert, fires `sendPushToUser` for each parent in family (fire-and-forget so completion latency is unchanged)
- `app/(dashboard)/quests/page.tsx` — replace direct `task_completions` insert with `fetch('/api/tasks/complete', ...)`. Audit for all call sites before refactor.
- **Tests:**
  - `__tests__/api/tasks/complete.test.ts` — auth, 403 not-in-family, insert happens, push fires per parent, push failure does NOT fail the request
  - `__tests__/app/dashboard/quests.test.tsx` — existing tests updated for new API call
  - `e2e/push-delivery.spec.ts` — extend with §8.3 items **3 (two-context child-completes → parent-receives)**, **5 (type toggle suppresses send)**, **6 (quiet hours suppress send)**
  - Existing `e2e/quests.spec.ts` must still pass — critical regression gate
- **Acceptance:** `app/api/tasks/complete/route.ts` at 100%; no regression in quest completion flow; two-context delivery spec green.
- **User-visible:** parents with prefs on get a push when their kid finishes a task.
- **Rollback risk:** **moderate** — this refactors a hot path. Keep the PR diff small, test the golden path in Playwright, and have a clean revert plan (just revert the `quests/page.tsx` change; the new route can stay unused).

### PR 5 — Streak milestone → child + parent push
**Branch:** `feature/issue-47-push-5-streak-milestone`
**Depends on:** PR 3 merged (can go in parallel with PR 4)
**Size:** ~300 LOC

- `app/api/push/trigger/streak-milestone/route.ts` — validates caller, sends push to child + opted-in parents
- `components/streaks/streak-tab.tsx` (or wherever `claim_streak_milestone` is called) — POST to the trigger route after successful RPC
- **Tests:**
  - `__tests__/api/push/trigger-streak-milestone.test.ts` — auth, missing `days`, child pushed, parents pushed when pref on, parents skipped when pref off
  - `e2e/push-delivery.spec.ts` — extend with §8.3 item **4 (streak milestone → child push; parent too when pref on)**
- **Acceptance:** trigger route at 100%; streak-delivery spec green.
- **User-visible:** celebratory push on milestone claim.
- **Rollback risk:** low — additive only.

---

### Per-PR acceptance criteria (applies to every PR 1–5)

- [ ] `npm run lint` clean
- [ ] `npm test` green; new code at 100% line + branch coverage
- [ ] `npm run test:db` green (PR 1 adds tests; PRs 2–5 must keep them green)
- [ ] `npm run test:e2e` green on both parent + child projects
- [ ] No regression in pre-existing specs
- [ ] PR description links to this plan, states which section(s) of §10 it implements, and what the next PR in the sequence is
- [ ] Screenshots for any UI changes

### Cross-PR acceptance (when PR 5 merges — feature complete)

- [ ] All file paths listed in §5 exist and are at 100% coverage per §8.6
- [ ] VAPID keys present in GitHub repo secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] Follow-up issue opened for Phase 2 (scheduled pushes — morning reminders, overdue alerts, streak-at-risk, weekly summary) with a link back to this plan
- [ ] Issue #47 closed by PR 5

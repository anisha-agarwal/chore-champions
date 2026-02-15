# Chore Champions

A gamified family chore management app where kids earn points, level up, and redeem rewards for completing household tasks.

[![CI](https://github.com/anisha-agarwal/chore-champions/actions/workflows/ci.yml/badge.svg)](https://github.com/anisha-agarwal/chore-champions/actions)
[![GitHub issues](https://img.shields.io/github/issues/anisha-agarwal/chore-champions)](https://github.com/anisha-agarwal/chore-champions/issues)
[![GitHub stars](https://img.shields.io/github/stars/anisha-agarwal/chore-champions)](https://github.com/anisha-agarwal/chore-champions/stargazers)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright)

## Screenshots

<table>
  <tr>
    <td align="center"><strong>Landing Page</strong></td>
    <td align="center"><strong>Quests Dashboard</strong></td>
    <td align="center"><strong>Family Management</strong></td>
  </tr>
  <tr>
    <td><img src="screenshots/01-landing.png" alt="Landing" width="280"/></td>
    <td><img src="screenshots/04-quests.png" alt="Quests" width="280"/></td>
    <td><img src="screenshots/06-family.png" alt="Family" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><strong>Create Quest</strong></td>
    <td align="center"><strong>Rewards Store</strong></td>
    <td align="center"><strong>Profile</strong></td>
  </tr>
  <tr>
    <td><img src="screenshots/05-new-quest-modal.png" alt="New Quest" width="280"/></td>
    <td><img src="screenshots/09-rewards.png" alt="Rewards" width="280"/></td>
    <td><img src="screenshots/10-profile.png" alt="Profile" width="280"/></td>
  </tr>
</table>

## Features

```mermaid
%%{init: {'theme': 'default'}}%%
mindmap
  root((Chore Champions))
    Quests
      Daily tasks
      Recurring tasks
      Time-based scheduling
      Task assignments
    Rewards
      Points system
      Rewards store
      Custom rewards
      Savings goals
    Gamification
      Streaks
      Leaderboards
      Badges
      Levels & XP
    Family
      Multi-member support
      Parent/child roles
      Invite system
      Approval workflows
```

## Architecture

```mermaid
%%{init: {'theme': 'default'}}%%
flowchart TB
    subgraph Client["Frontend (Next.js 16)"]
        UI[React Components]
        Pages[App Router Pages]
        Hooks[Custom Hooks]
    end

    subgraph Auth["Authentication"]
        Supabase_Auth[Supabase Auth]
        RLS[Row Level Security]
    end

    subgraph Backend["Backend (Supabase)"]
        DB[(PostgreSQL)]
        Storage[File Storage]
        Edge[Edge Functions]
        Realtime[Realtime Subscriptions]
    end

    UI --> Pages
    Pages --> Hooks
    Hooks --> Supabase_Auth
    Supabase_Auth --> RLS
    RLS --> DB
    Hooks --> Storage
    Hooks --> Realtime
    Edge --> DB
```

## Database Schema

```mermaid
%%{init: {'theme': 'default'}}%%
erDiagram
    FAMILIES ||--o{ PROFILES : contains
    FAMILIES ||--o{ TASKS : has
    FAMILIES ||--o{ REWARDS : offers
    PROFILES ||--o{ TASK_COMPLETIONS : completes
    PROFILES ||--o{ REWARD_REDEMPTIONS : redeems
    PROFILES ||--o{ SAVINGS_GOALS : creates
    PROFILES ||--o{ USER_BADGES : earns
    TASKS ||--o{ TASK_COMPLETIONS : tracks
    REWARDS ||--o{ REWARD_REDEMPTIONS : tracks
    BADGES ||--o{ USER_BADGES : awards

    FAMILIES {
        uuid id PK
        string name
        string invite_code UK
        timestamp created_at
    }

    PROFILES {
        uuid id PK
        uuid family_id FK
        string display_name
        string avatar_url
        string role
        int points
        int level
        int current_streak
    }

    TASKS {
        uuid id PK
        uuid family_id FK
        string title
        int points
        string time_of_day
        string recurring
        boolean requires_approval
        boolean requires_photo
    }

    TASK_COMPLETIONS {
        uuid id PK
        uuid task_id FK
        uuid completed_by FK
        string status
        string photo_url
        timestamp completed_at
    }

    REWARDS {
        uuid id PK
        uuid family_id FK
        string title
        int points_cost
        int stock
    }

    BADGES {
        uuid id PK
        string name
        string criteria_type
        int criteria_value
    }
```

## User Flows

### Task Completion Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'actorBkg': '#ffffff', 'actorBorder': '#333333', 'actorTextColor': '#000000', 'actorLineColor': '#ffffff', 'signalColor': '#ffffff', 'signalTextColor': '#ffffff', 'labelTextColor': '#ffffff', 'loopTextColor': '#ffffff', 'labelBoxBkgColor': '#555555', 'labelBoxBorderColor': '#ffffff', 'noteBkgColor': '#ffffcc', 'noteTextColor': '#000000', 'noteBorderColor': '#ffffff', 'activationBkgColor': '#f0f0f0', 'activationBorderColor': '#ffffff'}}}%%
sequenceDiagram
    actor Kid
    participant App
    participant DB as Supabase
    actor Parent

    Kid->>App: Complete task

    alt Task requires photo
        App->>Kid: Request photo
        Kid->>App: Upload photo
        App->>DB: Store photo
    end

    alt Task requires approval
        App->>DB: Create pending completion
        DB->>Parent: Notify for approval
        Parent->>App: Review & approve
        App->>DB: Update status to approved
    else No approval needed
        App->>DB: Create approved completion
    end

    DB->>DB: Trigger: Award points
    DB->>DB: Trigger: Check badges
    DB->>DB: Trigger: Update streak
    App->>Kid: Show celebration
```

### Rewards Redemption Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#333333', 'lineColor': '#ffffff', 'secondaryColor': '#f5f5f5', 'tertiaryColor': '#eeeeee', 'stateBkg': '#ffffff', 'stateBorder': '#333333', 'transitionColor': '#ffffff', 'transitionLabelColor': '#ffffff', 'stateLabelColor': '#000000'}}}%%
stateDiagram-v2
    [*] --> Browsing: Kid opens store
    Browsing --> Selected: Select reward
    Selected --> Browsing: Cancel
    Selected --> InsufficientPoints: Not enough points
    InsufficientPoints --> Browsing: Back to store
    Selected --> Confirming: Has enough points
    Confirming --> Pending: Confirm redemption
    Pending --> Approved: Parent approves
    Pending --> Rejected: Parent rejects
    Approved --> Claimed: Points deducted
    Rejected --> Browsing: Try again
    Claimed --> [*]
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16 (App Router) | Server & client rendering |
| UI | React 19 + Tailwind v4 | Component library & styling |
| Language | TypeScript 5 | Type safety |
| Database | Supabase (PostgreSQL) | Data persistence |
| Auth | Supabase Auth | Authentication & RLS |
| Storage | Supabase Storage | Photo uploads |
| Testing | Jest + Playwright | Unit & E2E tests |
| CI/CD | GitHub Actions | Automated testing |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials

# Run development server
npm run dev

# Run tests
npm test              # Unit tests
npm run test:e2e      # E2E tests
npm run lint          # Linting
```

## Project Structure

```
chore-champions/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, signup, join)
│   ├── (dashboard)/       # Main app pages
│   │   ├── quests/        # Task management
│   │   ├── rewards/       # Rewards store
│   │   ├── family/        # Family members
│   │   └── me/            # Profile & settings
│   └── auth/              # Auth callbacks
├── components/
│   ├── ui/                # Reusable UI components
│   ├── tasks/             # Task-related components
│   ├── family/            # Family components
│   └── layout/            # Layout components
├── lib/
│   ├── supabase/          # Supabase client
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Utilities
├── supabase/
│   └── migrations/        # Database migrations
├── e2e/                   # Playwright E2E tests
├── __tests__/             # Jest unit tests
└── docs/
    └── adr/               # Architecture Decision Records
```

## Contributing

1. Create a feature branch from `main`
2. Follow the [ADR process](docs/adr/) for architectural decisions
3. Ensure all tests pass (`npm test && npm run test:e2e`)
4. Create a PR with clear description

## License

MIT

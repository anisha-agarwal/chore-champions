# Architecture Overview

## System Context

```mermaid
%%{init: {'theme': 'neutral'}}%%
C4Context
    title System Context Diagram

    Person(parent, "Parent", "Manages tasks, approves completions, creates rewards")
    Person(child, "Child", "Completes tasks, earns points, redeems rewards")

    System(app, "Chore Champions", "Gamified family chore management")

    System_Ext(supabase, "Supabase", "Auth, Database, Storage, Realtime")
    System_Ext(push, "Push Service", "Web Push Notifications")

    Rel(parent, app, "Uses", "HTTPS")
    Rel(child, app, "Uses", "HTTPS")
    Rel(app, supabase, "Uses", "HTTPS/WSS")
    Rel(app, push, "Sends", "Web Push")
```

## Component Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#64748b', 'secondaryColor': '#f1f5f9', 'tertiaryColor': '#e0e7ff', 'background': '#ffffff', 'nodeBkg': '#f8fafc', 'nodeBorder': '#94a3b8', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#cbd5e1', 'edgeLabelBackground': '#ffffff'}}}%%
flowchart TB
    subgraph Browser["Browser"]
        subgraph NextJS["Next.js Application"]
            subgraph Pages["Pages (App Router)"]
                Auth["(auth)/*"]
                Dashboard["(dashboard)/*"]
            end

            subgraph Components["Components"]
                UI["ui/*<br/>Button, Modal, Avatar..."]
                Tasks["tasks/*<br/>TaskCard, TaskForm..."]
                Family["family/*<br/>MemberCard, FamilyList..."]
                Rewards["rewards/*<br/>RewardCard, Store..."]
                Gamification["gamification/*<br/>Streak, Badge, Level..."]
            end

            subgraph Lib["Libraries"]
                SupabaseClient["Supabase Client"]
                Hooks["Custom Hooks"]
                Utils["Utilities"]
            end
        end

        SW["Service Worker<br/>(Push Notifications)"]
    end

    subgraph Supabase["Supabase Platform"]
        subgraph Auth["Auth"]
            AuthService["Authentication"]
            RLS["Row Level Security"]
        end

        subgraph Database["PostgreSQL"]
            Tables["Tables"]
            Functions["Functions"]
            Triggers["Triggers"]
        end

        Storage["Storage<br/>(Photos)"]
        Realtime["Realtime<br/>(Subscriptions)"]
    end

    Pages --> Components
    Components --> Lib
    Lib --> Auth
    Lib --> Database
    Lib --> Storage
    Lib --> Realtime
    SW --> Browser
```

## Data Flow

### Authentication Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#94a3b8', 'secondaryColor': '#f1f5f9', 'actorTextColor': '#1e293b', 'actorBkg': '#f8fafc', 'actorBorder': '#94a3b8', 'signalColor': '#334155', 'signalTextColor': '#1e293b'}}}%%
sequenceDiagram
    participant User
    participant App
    participant Supabase Auth
    participant Database

    User->>App: Sign up / Login
    App->>Supabase Auth: Authenticate
    Supabase Auth-->>App: Session + JWT

    alt New User
        Supabase Auth->>Database: Trigger: Create Profile
        Database-->>Database: Insert into profiles
    end

    App->>Database: Query with JWT
    Database->>Database: RLS Policy Check
    Database-->>App: Authorized Data
    App-->>User: Render Dashboard
```

### Points & Gamification Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#64748b', 'secondaryColor': '#f1f5f9', 'tertiaryColor': '#e0e7ff', 'background': '#ffffff', 'nodeBkg': '#f8fafc', 'nodeBorder': '#94a3b8', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#cbd5e1', 'edgeLabelBackground': '#ffffff'}}}%%
flowchart LR
    subgraph Trigger["Task Completion"]
        Complete["Complete Task"]
    end

    subgraph Chain["Trigger Chain"]
        Points["Award Points"]
        Streak["Update Streak"]
        Badge["Check Badges"]
        Level["Check Level Up"]
    end

    subgraph Notify["Notifications"]
        UI["UI Update"]
        Push["Push Notification"]
    end

    Complete --> Points
    Points --> Streak
    Streak --> Badge
    Badge --> Level
    Level --> UI
    Level --> Push
```

## Database Architecture

### Table Relationships

```mermaid
%%{init: {'theme': 'neutral'}}%%
erDiagram
    families ||--o{ profiles : "has members"
    families ||--o{ tasks : "has tasks"
    families ||--o{ rewards : "offers rewards"
    families ||--o{ task_templates : "has templates"

    profiles ||--o{ tasks : "creates"
    profiles ||--o{ tasks : "assigned to"
    profiles ||--o{ task_completions : "completes"
    profiles ||--o{ reward_redemptions : "redeems"
    profiles ||--o{ user_badges : "earns"
    profiles ||--o{ savings_goals : "creates"
    profiles ||--o{ allowance_transactions : "has"
    profiles ||--o{ push_subscriptions : "has"

    tasks ||--o{ task_completions : "tracked by"

    rewards ||--o{ reward_redemptions : "redeemed as"

    badges ||--o{ user_badges : "awarded as"
```

### RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| families | Own family | Anyone | Parents only | - |
| profiles | Family members | Own profile | Own profile | - |
| tasks | Family tasks | Family members | Family members | Parents + Creator |
| task_completions | Family completions | Family members | Parents (approval) | Parents |
| rewards | Family rewards | Parents | Parents | Parents |
| reward_redemptions | Family redemptions | Family members | Parents | Parents |

## State Management

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#64748b', 'secondaryColor': '#e0e7ff', 'stateBkg': '#f8fafc', 'stateBorder': '#94a3b8'}}}%%
stateDiagram-v2
    [*] --> Anonymous

    Anonymous --> Authenticated: Login/Signup
    Authenticated --> Anonymous: Logout

    state Authenticated {
        [*] --> NoFamily
        NoFamily --> HasFamily: Create/Join Family

        state HasFamily {
            [*] --> Dashboard
            Dashboard --> Quests
            Dashboard --> Rewards
            Dashboard --> Family
            Dashboard --> Profile

            Quests --> TaskDetail
            TaskDetail --> Quests

            Rewards --> RewardDetail
            RewardDetail --> Rewards
        }
    }
```

## Security Model

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#64748b', 'secondaryColor': '#f1f5f9', 'tertiaryColor': '#e0e7ff', 'background': '#ffffff', 'nodeBkg': '#f8fafc', 'nodeBorder': '#94a3b8', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#cbd5e1', 'edgeLabelBackground': '#ffffff'}}}%%
flowchart TB
    subgraph Client["Client Side"]
        JWT["JWT Token"]
        Session["Session Storage"]
    end

    subgraph Edge["Edge/API"]
        Validate["Validate JWT"]
        Refresh["Refresh Token"]
    end

    subgraph Database["Database"]
        RLS["Row Level Security"]
        Policies["Policy Evaluation"]
        Data["Protected Data"]
    end

    JWT --> Validate
    Validate -->|Valid| RLS
    Validate -->|Expired| Refresh
    Refresh --> Session
    RLS --> Policies
    Policies -->|Allowed| Data
    Policies -->|Denied| Reject["403 Forbidden"]
```

## Performance Considerations

### Caching Strategy

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#64748b', 'secondaryColor': '#f1f5f9', 'tertiaryColor': '#e0e7ff', 'background': '#ffffff', 'nodeBkg': '#f8fafc', 'nodeBorder': '#94a3b8', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#cbd5e1', 'edgeLabelBackground': '#ffffff'}}}%%
flowchart LR
    subgraph Request["Request"]
        Query["Query"]
    end

    subgraph Cache["Caching Layers"]
        React["React Query Cache<br/>(Client)"]
        SWR["Stale-While-Revalidate"]
        Edge["Edge Cache<br/>(Vercel)"]
    end

    subgraph Source["Data Source"]
        DB["PostgreSQL"]
    end

    Query --> React
    React -->|Miss| SWR
    SWR -->|Miss| Edge
    Edge -->|Miss| DB
    DB --> Edge
    Edge --> SWR
    SWR --> React
```

### Query Optimization

| Query Pattern | Optimization |
|--------------|--------------|
| Family tasks | Index on `family_id` + `due_date` |
| User completions | Index on `completed_by` + `completed_at` |
| Leaderboard | Materialized view with periodic refresh |
| Badge progress | Cached aggregations |

## Deployment Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#64748b', 'secondaryColor': '#f1f5f9', 'tertiaryColor': '#e0e7ff', 'background': '#ffffff', 'nodeBkg': '#f8fafc', 'nodeBorder': '#94a3b8', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#cbd5e1', 'edgeLabelBackground': '#ffffff'}}}%%
flowchart TB
    subgraph GitHub["GitHub"]
        Repo["Repository"]
        Actions["GitHub Actions"]
    end

    subgraph Vercel["Vercel"]
        Preview["Preview Deployments"]
        Production["Production"]
        Edge["Edge Network"]
    end

    subgraph Supabase["Supabase"]
        DB["PostgreSQL"]
        Auth["Auth"]
        Storage["Storage"]
    end

    Repo -->|Push| Actions
    Actions -->|Test| Actions
    Actions -->|Deploy| Vercel
    Vercel --> Edge
    Edge --> Supabase
```

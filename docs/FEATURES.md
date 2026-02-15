# Feature Documentation

## Feature Overview

```mermaid
mindmap
    root((Features))
        Core
            Task Management
            Family System
            Points Economy
        Gamification
            Streaks
            Leaderboards
            Badges
            Levels
        Rewards
            Store
            Custom Rewards
            Savings Goals
            Allowance
        Engagement
            Photo Proof
            Approvals
            Notifications
            Analytics
```

## Gamification System

### Streaks

Track consecutive days of completing all assigned tasks.

```mermaid
stateDiagram-v2
    [*] --> Day1: Complete all tasks

    Day1 --> Day2: Next day, complete all
    Day1 --> Broken: Miss tasks

    Day2 --> Day3: Continue streak
    Day2 --> Broken: Miss tasks

    Day3 --> Growing: Keep going!
    Day3 --> Broken: Miss tasks

    Growing --> Growing: Daily completion
    Growing --> Broken: Miss tasks

    Broken --> Day1: Start over

    note right of Growing
        Milestone rewards at:
        7, 14, 30, 60, 100 days
    end note
```

**Streak Milestones:**
| Days | Badge | Bonus Points |
|------|-------|--------------|
| 7 | Week Warrior | +50 |
| 14 | Fortnight Fighter | +100 |
| 30 | Monthly Master | +250 |
| 60 | Dedication Star | +500 |
| 100 | Century Champion | +1000 |

### Levels & XP

```mermaid
xychart-beta
    title "XP Requirements per Level"
    x-axis [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    y-axis "Total XP Required" 0 --> 10000
    bar [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000]
```

**Level Progression:**

| Level | Title | XP Required | Unlocks |
|-------|-------|-------------|---------|
| 1 | Rookie | 0 | Basic avatars |
| 2 | Helper | 100 | 2 new avatars |
| 3 | Champion | 300 | Custom colors |
| 4 | Star | 600 | Animated avatar |
| 5 | Hero | 1000 | Profile badge |
| 6 | Legend | 1500 | Special effects |
| 7 | Master | 2500 | Exclusive avatar |
| 8 | Elite | 4000 | Title customization |
| 9 | Ultimate | 6000 | Legendary frame |
| 10 | Champion | 10000 | Everything unlocked |

### Badge System

```mermaid
flowchart TB
    subgraph Categories["Badge Categories"]
        subgraph Streaks["Streak Badges"]
            S1["7-Day Streak"]
            S2["30-Day Streak"]
            S3["100-Day Streak"]
        end

        subgraph Tasks["Task Badges"]
            T1["First Quest"]
            T2["Quest Master<br/>(100 tasks)"]
            T3["Legendary<br/>(1000 tasks)"]
        end

        subgraph Points["Point Badges"]
            P1["Century Club<br/>(100 pts)"]
            P2["High Roller<br/>(1000 pts)"]
            P3["Point King<br/>(10000 pts)"]
        end

        subgraph Special["Special Badges"]
            SP1["Early Bird<br/>(Morning tasks)"]
            SP2["Night Owl<br/>(Night tasks)"]
            SP3["Perfect Week"]
        end
    end
```

### Leaderboard

```mermaid
flowchart LR
    subgraph Views["Leaderboard Views"]
        Weekly["This Week"]
        Monthly["This Month"]
        AllTime["All Time"]
    end

    subgraph Display["Display"]
        Rank["Rank"]
        Avatar["Avatar"]
        Name["Name"]
        Points["Points"]
        Change["Change ▲▼"]
    end

    Weekly --> Display
    Monthly --> Display
    AllTime --> Display
```

## Rewards System

### Reward Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Parent creates reward

    Created --> Active: Activate
    Created --> Draft: Save as draft

    Draft --> Active: Publish

    Active --> Redeemed: Kid redeems
    Active --> OutOfStock: Stock depleted
    Active --> Inactive: Parent disables

    Redeemed --> PendingApproval: Requires approval
    Redeemed --> Fulfilled: Auto-approved

    PendingApproval --> Fulfilled: Parent approves
    PendingApproval --> Rejected: Parent rejects

    Rejected --> Active: Points refunded

    OutOfStock --> Active: Restock
    Inactive --> Active: Re-enable

    Fulfilled --> [*]
```

### Savings Goals

```mermaid
flowchart TB
    subgraph Goal["Savings Goal"]
        Target["Target: 500 pts"]
        Current["Current: 320 pts"]
        Progress["Progress: 64%"]
    end

    subgraph Sources["Point Sources"]
        Tasks["Task Completions"]
        Bonus["Streak Bonuses"]
        Manual["Manual Add"]
    end

    subgraph Visual["Visual Progress"]
        Bar["Progress Bar"]
        Jar["Filling Jar"]
        Ring["Progress Ring"]
    end

    Sources --> Goal
    Goal --> Visual
```

### Allowance Flow

```mermaid
sequenceDiagram
    participant Kid
    participant App
    participant Parent

    Note over App: Conversion Rate: 100pts = $1

    Kid->>App: Earns 50 points
    App->>App: Update balance (+$0.50)

    Kid->>App: Request payout
    App->>Parent: Payout request notification

    Parent->>App: Approve payout
    App->>App: Mark as paid
    App->>Kid: Payout confirmed

    Note over Kid: Receives allowance
```

## Task Management

### Task States

```mermaid
stateDiagram-v2
    [*] --> Pending: Task created

    Pending --> InProgress: Kid starts
    Pending --> Overdue: Past due date

    InProgress --> AwaitingPhoto: Photo required
    InProgress --> AwaitingApproval: Approval required
    InProgress --> Completed: Auto-complete

    AwaitingPhoto --> AwaitingApproval: Photo uploaded
    AwaitingPhoto --> Completed: Photo uploaded (no approval)

    AwaitingApproval --> Completed: Parent approves
    AwaitingApproval --> Rejected: Parent rejects

    Rejected --> InProgress: Kid retries

    Completed --> [*]: Points awarded

    Overdue --> InProgress: Late start
    Overdue --> Skipped: Day passes
```

### Recurring Tasks

```mermaid
flowchart TB
    subgraph Daily["Daily Tasks"]
        D1["Make Bed"]
        D2["Brush Teeth"]
        D3["Feed Pet"]
    end

    subgraph Weekly["Weekly Tasks"]
        W1["Clean Room"]
        W2["Take Out Trash"]
        W3["Mow Lawn"]
    end

    subgraph Schedule["Time of Day"]
        Morning["Morning<br/>6am-12pm"]
        Afternoon["Afternoon<br/>12pm-6pm"]
        Night["Night<br/>6pm-10pm"]
        Anytime["Anytime"]
    end

    Daily --> Schedule
    Weekly --> Schedule
```

## Analytics Dashboard

### Parent Analytics

```mermaid
pie showData
    title Task Completion Rate (This Week)
    "Completed" : 42
    "Pending" : 8
    "Overdue" : 3
    "Skipped" : 2
```

### Kid Analytics

```mermaid
xychart-beta
    title "Points Earned (Last 7 Days)"
    x-axis ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    y-axis "Points" 0 --> 100
    bar [45, 62, 38, 71, 55, 89, 67]
```

### Activity Heatmap

```
Contribution-style calendar showing daily activity:

     Mon Tue Wed Thu Fri Sat Sun
W1   ███ ███ ░░░ ███ ███ ███ ███
W2   ███ ███ ███ ███ ░░░ ███ ███
W3   ███ ███ ███ ███ ███ ███ ███
W4   ███ ░░░ ███ ███ ███ ███ ███

███ = All tasks completed
▓▓▓ = Partial completion
░░░ = No tasks completed
```

## Notification System

### Notification Types

```mermaid
flowchart TB
    subgraph Triggers["Triggers"]
        TaskDue["Task Due Soon"]
        TaskOverdue["Task Overdue"]
        StreakRisk["Streak at Risk"]
        Achievement["Achievement Unlocked"]
        Approval["Approval Needed"]
        Redeemed["Reward Redeemed"]
    end

    subgraph Channels["Channels"]
        Push["Push Notification"]
        InApp["In-App Alert"]
        Email["Email (Optional)"]
    end

    subgraph Recipients["Recipients"]
        Kids["Kids"]
        Parents["Parents"]
    end

    Triggers --> Channels
    Channels --> Recipients
```

### Notification Schedule

| Event | When | Who |
|-------|------|-----|
| Morning tasks reminder | 7:00 AM | Kids |
| Afternoon tasks reminder | 12:00 PM | Kids |
| Evening tasks reminder | 6:00 PM | Kids |
| Streak at risk | 8:00 PM | Kids |
| Overdue tasks | 9:00 PM | Kids + Parents |
| Approval pending | Immediate | Parents |
| Weekly summary | Sunday 8:00 PM | Parents |

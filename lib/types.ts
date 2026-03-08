// Database types for Supabase
export type Database = {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          invite_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          family_id: string | null
          display_name: string
          avatar_url: string | null
          nickname: string | null
          role: 'parent' | 'child'
          points: number
          created_at: string
        }
        Insert: {
          id: string
          family_id?: string | null
          display_name: string
          avatar_url?: string | null
          nickname?: string | null
          role?: 'parent' | 'child'
          points?: number
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string | null
          display_name?: string
          avatar_url?: string | null
          nickname?: string | null
          role?: 'parent' | 'child'
          points?: number
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          family_id: string
          title: string
          description: string | null
          assigned_to: string | null
          points: number
          time_of_day: 'morning' | 'afternoon' | 'night' | 'anytime'
          recurring: 'daily' | 'weekly' | null
          due_date: string | null
          due_time: string | null
          completed: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          title: string
          description?: string | null
          assigned_to?: string | null
          points?: number
          time_of_day?: 'morning' | 'afternoon' | 'night' | 'anytime'
          recurring?: 'daily' | 'weekly' | null
          due_date?: string | null
          due_time?: string | null
          completed?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          title?: string
          description?: string | null
          assigned_to?: string | null
          points?: number
          time_of_day?: 'morning' | 'afternoon' | 'night' | 'anytime'
          recurring?: 'daily' | 'weekly' | null
          due_date?: string | null
          due_time?: string | null
          completed?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      task_completions: {
        Row: {
          id: string
          task_id: string
          completed_by: string | null
          completed_at: string
          points_earned: number
          completion_date: string | null
        }
        Insert: {
          id?: string
          task_id: string
          completed_by?: string | null
          completed_at?: string
          points_earned: number
          completion_date?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          completed_by?: string | null
          completed_at?: string
          points_earned?: number
          completion_date?: string | null
        }
      }
      family_invites: {
        Row: {
          id: string
          family_id: string
          invited_by: string
          invited_user_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          family_id: string
          invited_by: string
          invited_user_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string
          invited_by?: string
          invited_user_id?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          responded_at?: string | null
        }
      }
    }
    Functions: {
      find_user_by_email: {
        Args: { lookup_email: string }
        Returns: {
          user_id: string
          display_name: string
          avatar_url: string | null
          has_family: boolean
        }[]
      }
      accept_family_invite: {
        Args: { invite_id: string }
        Returns: undefined
      }
      get_user_streaks: {
        Args: { p_user_id: string }
        Returns: UserStreaks
      }
      buy_streak_freeze: {
        Args: { p_user_id: string }
        Returns: { success: boolean; error?: string }
      }
      use_streak_freeze: {
        Args: { p_user_id: string; p_freeze_date: string; p_streak_type: string; p_task_id?: string }
        Returns: { success: boolean; error?: string }
      }
      claim_streak_milestone: {
        Args: { p_user_id: string; p_streak_type: string; p_task_id: string; p_milestone_days: number; p_current_streak: number }
        Returns: { success: boolean; error?: string; bonus?: number; badge?: string }
      }
      get_kid_analytics: {
        Args: { p_user_id: string; p_weeks?: number }
        Returns: KidAnalytics
      }
      get_kid_heatmap: {
        Args: { p_user_id: string }
        Returns: KidHeatmap
      }
      get_family_analytics: {
        Args: { p_family_id: string; p_weeks?: number }
        Returns: FamilyAnalytics
      }
    }
  }
}

// Convenience types
export type Family = Database['public']['Tables']['families']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskCompletion = Database['public']['Tables']['task_completions']['Row']
export type FamilyInvite = Database['public']['Tables']['family_invites']['Row']

// Invite with joined details for display
export type FamilyInviteWithDetails = FamilyInvite & {
  families: Pick<Family, 'name'>
  inviter: Pick<Profile, 'display_name' | 'avatar_url'>
}

// Extended types with relations
export type TaskWithAssignee = Task & {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'nickname'> | null
  task_completions?: Pick<TaskCompletion, 'id' | 'completed_at'>[]
}

export type ProfileWithFamily = Profile & {
  families: Pick<Family, 'id' | 'name' | 'invite_code'> | null
}

// Time of day options
export const TIME_OF_DAY_OPTIONS = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
] as const

// Streak types
export type StreakMilestone = {
  days: number
  bonus: number
  badge: string
}

export type TaskStreak = {
  task_id: string
  title: string
  current_streak: number
}

export type UserStreaks = {
  active_day_streak: number
  perfect_day_streak: number
  task_streaks: TaskStreak[]
}

export type StreakFreezes = {
  available: number
  used: number
}

export type ClaimedMilestone = {
  streak_type: string
  task_id: string | null
  milestone_days: number
  points_awarded: number
  badge_name: string
}

// Analytics types
export type Level = {
  level: number
  name: string
  minPoints: number
}

export type DailyPoint = {
  date: string        // ISO date (YYYY-MM-DD)
  points: number      // total points earned
  completions: number // tasks completed
}

export type TaskFrequency = {
  task_id: string
  title: string
  count: number
}

export type ChildStats = {
  profile: Pick<Profile, 'id' | 'display_name' | 'nickname' | 'avatar_url' | 'points'>
  completions_this_week: number
  completions_last_week: number
  completion_rate: number // 0-1
}

export type KidAnalytics = {
  daily_points: DailyPoint[]
  task_breakdown: TaskFrequency[]
  milestones: BadgeInfo[]
  total_points: number
  completions_this_week: number
  completions_last_week: number
}

export type KidHeatmap = {
  heatmap_data: DailyPoint[] // always 52 weeks
}

export type BadgeInfo = {
  badge_name: string
  milestone_days: number
  streak_type: 'active_day' | 'perfect_day' | 'task'
  task_id: string | null
  claimed_at: string | null
}

export type FamilyAnalytics = {
  children: ChildStats[]
  daily_totals: DailyPoint[]
  top_tasks: TaskFrequency[]
  bottom_tasks: TaskFrequency[]
  family_completion_rate: number // 0-1
}

export type AnalyticsTimeRange = 4 | 12 | 26 // weeks

export type AnalyticsInsight = {
  narrative: string | null
  generated_at: string
}

// Observability types
export type AppError = {
  id: string
  error_message: string
  error_type: 'rpc' | 'api' | 'client' | 'boundary' | 'middleware'
  error_code: string | null
  route: string
  method: string | null
  user_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type AppEvent = {
  id: string
  event_type: string
  user_id: string | null
  family_id: string | null
  metadata: Record<string, unknown>
  duration_ms: number | null
  created_at: string
}

export type ObservabilitySummary = {
  error_count: number
  prev_error_count: number
  active_users: number
  avg_latency_ms: number
  error_rate_trend: Array<{ time: string; count: number }>
  top_errors: Array<{ error_message: string; route: string; count: number }>
  route_latency: Array<{ route: string; p95_ms: number; avg_ms: number; count: number }>
}

export type RouteLatency = {
  route: string
  p95_ms: number
  avg_ms: number
  min_ms: number
  max_ms: number
  count: number
}

export type RpcTiming = {
  rpc_name: string
  p95_ms: number
  avg_ms: number
  min_ms: number
  max_ms: number
  count: number
}

export type LatencyTrend = {
  time: string
  avg_ms: number
}

export type PerformanceMetrics = {
  route_latency: RouteLatency[]
  rpc_timing: RpcTiming[]
  latency_trend: LatencyTrend[]
}

export type DailyActiveUsers = {
  date: string
  users: number
}

export type ChoreFrequency = {
  task_name: string
  count: number
}

export type PeakHour = {
  hour: number
  count: number
}

export type AiCallVolume = {
  date: string
  count: number
}

export type UsageAnalytics = {
  daily_active_users: DailyActiveUsers[]
  top_chores: ChoreFrequency[]
  least_chores: ChoreFrequency[]
  peak_hours: PeakHour[]
  ai_call_volume: AiCallVolume[]
  event_counts: Record<string, number>
}

export type ErrorListResult = {
  errors: AppError[]
  total: number
  page: number
  total_pages: number
}

// Avatar options
export const AVATAR_OPTIONS = [
  { id: 'panther', name: 'Panther', url: '/avatars/panther.svg' },
  { id: 'bison', name: 'Bison', url: '/avatars/bison.svg' },
  { id: 'fox', name: 'Fox', url: '/avatars/fox.svg' },
  { id: 'owl', name: 'Owl', url: '/avatars/owl.svg' },
  { id: 'bear', name: 'Bear', url: '/avatars/bear.svg' },
  { id: 'wolf', name: 'Wolf', url: '/avatars/wolf.svg' },
  { id: 'horse', name: 'Horse', url: '/avatars/horse.svg' },
  { id: 'snake', name: 'Snake', url: '/avatars/snake.svg' },
  { id: 'rabbit', name: 'Rabbit', url: '/avatars/rabbit.svg' },
  { id: 'cat', name: 'Cat', url: '/avatars/cat.svg' },
  { id: 'dog', name: 'Dog', url: '/avatars/dog.svg' },
  { id: 'dragon', name: 'Dragon', url: '/avatars/dragon.svg' },
] as const

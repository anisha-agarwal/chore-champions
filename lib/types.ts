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
        }
        Insert: {
          id?: string
          task_id: string
          completed_by?: string | null
          completed_at?: string
          points_earned: number
        }
        Update: {
          id?: string
          task_id?: string
          completed_by?: string | null
          completed_at?: string
          points_earned?: number
        }
      }
    }
    Functions: Record<string, never>
  }
}

// Convenience types
export type Family = Database['public']['Tables']['families']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskCompletion = Database['public']['Tables']['task_completions']['Row']

// Extended types with relations
export type TaskWithAssignee = Task & {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'nickname'> | null
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

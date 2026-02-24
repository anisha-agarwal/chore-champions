'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { StreakCard } from './streak-card'
import { FreezeSection } from './freeze-section'
import type { UserStreaks, StreakFreezes, ClaimedMilestone } from '@/lib/types'

interface StreakTabProps {
  userId: string
  userPoints: number
}

type RpcResult = { success: boolean; error?: string; bonus?: number; badge?: string }

export function StreakTab({ userId, userPoints }: StreakTabProps) {
  const [streaks, setStreaks] = useState<UserStreaks | null>(null)
  const [freezes, setFreezes] = useState<StreakFreezes>({ available: 0, used: 0 })
  const [claimedMilestones, setClaimedMilestones] = useState<ClaimedMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState(userPoints)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const [streakResult, freezeResult, milestoneResult] = await Promise.all([
      supabase.rpc('get_user_streaks', { p_user_id: userId }),
      supabase.from('streak_freezes').select('available, used').eq('user_id', userId).single(),
      supabase.from('streak_milestones').select('streak_type, task_id, milestone_days, points_awarded, badge_name').eq('user_id', userId),
    ])

    if (streakResult.data) {
      setStreaks(streakResult.data as UserStreaks)
    }

    if (freezeResult.data) {
      setFreezes(freezeResult.data)
    }

    if (milestoneResult.data) {
      setClaimedMilestones(milestoneResult.data)
    }

    setLoading(false)
    // createClient() returns a singleton — supabase reference is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchData()
  }, [fetchData])

  async function handleClaimMilestone(streakType: string, taskId: string | null, days: number, currentStreak: number) {
    const { data } = await supabase.rpc('claim_streak_milestone', {
      p_user_id: userId,
      p_streak_type: streakType,
      p_task_id: taskId ?? '00000000-0000-0000-0000-000000000000',
      p_milestone_days: days,
      p_current_streak: currentStreak,
    })

    const result = data as RpcResult | null
    if (result?.success) {
      toast.success(`${result.badge} unlocked! +${result.bonus} points`)
      setPoints((prev) => prev + (result.bonus ?? 0))
      fetchData()
    } else if (result?.error) {
      toast.error(result.error)
    }
  }

  async function handleBuyFreeze() {
    const { data } = await supabase.rpc('buy_streak_freeze', { p_user_id: userId })

    const result = data as RpcResult | null
    if (result?.success) {
      toast.success('Streak freeze purchased!')
      setPoints((prev) => prev - 50)
      fetchData()
    } else if (result?.error) {
      toast.error(result.error)
    }
  }

  function getClaimedDaysForStreak(streakType: string, taskId?: string): number[] {
    return claimedMilestones
      .filter((m) => {
        if (m.streak_type !== streakType) return false
        if (streakType === 'task') return m.task_id === taskId
        return true
      })
      .map((m) => m.milestone_days)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const activeStreakCount = [
    streaks?.active_day_streak ?? 0,
    streaks?.perfect_day_streak ?? 0,
    ...(streaks?.task_streaks?.map((t) => t.current_streak) ?? []),
  ].filter((s) => s > 0).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-center py-2">
        <p className="text-sm text-gray-500">
          <span className="font-bold text-purple-600 text-lg">{activeStreakCount}</span>{' '}
          active streak{activeStreakCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Active Day Streak */}
      <StreakCard
        type="active_day"
        label="Active Day"
        streak={streaks?.active_day_streak ?? 0}
        claimedMilestones={getClaimedDaysForStreak('active_day')}
        onClaimMilestone={(days) =>
          handleClaimMilestone('active_day', null, days, streaks?.active_day_streak ?? 0)
        }
      />

      {/* Perfect Day Streak */}
      <StreakCard
        type="perfect_day"
        label="Perfect Day"
        streak={streaks?.perfect_day_streak ?? 0}
        claimedMilestones={getClaimedDaysForStreak('perfect_day')}
        onClaimMilestone={(days) =>
          handleClaimMilestone('perfect_day', null, days, streaks?.perfect_day_streak ?? 0)
        }
      />

      {/* Task Streaks */}
      {streaks?.task_streaks?.map((task) => (
        <StreakCard
          key={task.task_id}
          type={`task_${task.task_id}`}
          label={task.title}
          streak={task.current_streak}
          claimedMilestones={getClaimedDaysForStreak('task', task.task_id)}
          onClaimMilestone={(days) =>
            handleClaimMilestone('task', task.task_id, days, task.current_streak)
          }
        />
      ))}

      {/* Freeze Section */}
      <FreezeSection
        available={freezes.available}
        used={freezes.used}
        userPoints={points}
        onBuy={handleBuyFreeze}
      />
    </div>
  )
}

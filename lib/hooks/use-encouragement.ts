'use client'

import { useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  getRandomFallback,
  detectMilestone,
  getTimeOfDay,
} from '@/lib/encouragement'
import type { EncouragementContext, ShowEncouragementParams } from '@/lib/encouragement'

export function useEncouragement() {
  const recentMessagesRef = useRef<string[]>([])

  const trackMessage = (message: string) => {
    const recent = recentMessagesRef.current
    recent.push(message)
    // Keep only last 5
    if (recent.length > 5) {
      recent.shift()
    }
  }

  const showToast = (message: string, isMilestone: boolean) => {
    trackMessage(message)

    if (isMilestone) {
      toast.success(message, {
        icon: '\uD83C\uDF89',
        duration: 5000,
      })
    } else {
      toast(message, {
        icon: '\u2B50',
        duration: 3000,
      })
    }
  }

  const showEncouragement = useCallback(({ task, pointsEarned, currentUser, tasks }: ShowEncouragementParams) => {
    // Compute completions today
    const completionsToday = tasks.filter((t) => t.completed).length + 1 // +1 for the one just completed
    const totalTasksToday = tasks.length

    const newTotalPoints = currentUser.points + pointsEarned

    const { isMilestone, milestoneType } = detectMilestone({
      totalPoints: newTotalPoints,
      pointsEarned,
      completionsToday,
      totalTasksToday,
    })

    const context: EncouragementContext = {
      taskTitle: task.title,
      pointsEarned,
      totalPoints: newTotalPoints,
      completionsToday,
      totalTasksToday,
      timeOfDay: getTimeOfDay(),
      userName: currentUser.nickname || currentUser.display_name,
      isOverdue: false,
      isMilestone,
      milestoneType,
    }

    // Fire-and-forget API call (returns promise for testability)
    return fetch('/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    })
      .then((res) => {
        if (!res.ok) throw new Error('API error')
        return res.json()
      })
      .then((data: { message: string | null; isMilestone?: boolean }) => {
        if (data.message) {
          showToast(data.message, isMilestone)
        } else {
          // AI returned null, use fallback
          const fallback = getRandomFallback(context, recentMessagesRef.current)
          showToast(fallback, isMilestone)
        }
      })
      .catch(() => {
        // Network error or API failure, use fallback
        const fallback = getRandomFallback(context, recentMessagesRef.current)
        showToast(fallback, isMilestone)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { showEncouragement }
}

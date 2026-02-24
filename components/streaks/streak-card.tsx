'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MilestoneBadge } from './milestone-badge'
import { STREAK_MILESTONES, getNextMilestone } from '@/lib/streaks'

interface StreakCardProps {
  type: string
  label: string
  streak: number
  claimedMilestones: number[]
  onClaimMilestone: (days: number) => void
}

export function StreakCard({ type, label, streak, claimedMilestones, onClaimMilestone }: StreakCardProps) {
  const nextMilestone = getNextMilestone(streak, claimedMilestones)
  const progressPercent = nextMilestone
    ? Math.min(100, Math.round((streak / nextMilestone.days) * 100))
    : 100

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span aria-hidden="true">🔥</span>
            <span>{label}</span>
          </CardTitle>
          <span className="text-2xl font-bold text-purple-600" data-testid={`streak-count-${type}`}>
            {streak}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{streak} day{streak !== 1 ? 's' : ''}</span>
            {nextMilestone && <span>Next: {nextMilestone.days} days</span>}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={streak}
              aria-valuemin={0}
              aria-valuemax={nextMilestone?.days ?? streak}
              aria-label={`${label} streak progress`}
            />
          </div>
        </div>

        {/* Milestone badges */}
        <div className="flex gap-2 justify-center flex-wrap">
          {STREAK_MILESTONES.map((milestone) => {
            const isClaimed = claimedMilestones.includes(milestone.days)
            const isClaimable = !isClaimed && streak >= milestone.days
            const status = isClaimed ? 'claimed' : isClaimable ? 'claimable' : 'locked'

            return (
              <MilestoneBadge
                key={milestone.days}
                milestone={milestone}
                status={status}
                onClaim={() => onClaimMilestone(milestone.days)}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

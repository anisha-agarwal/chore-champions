'use client'

import type { BadgeInfo, UserStreaks } from '@/lib/types'
import { getBadgeProgress } from '@/lib/analytics-utils'

interface BadgeCollectionProps {
  badges: BadgeInfo[]
  streaks: UserStreaks
}

const STREAK_TYPE_LABELS: Record<BadgeInfo['streak_type'], string> = {
  active_day: 'Active Day',
  perfect_day: 'Perfect Day',
  task: 'Task',
}

export function BadgeCollection({ badges, streaks }: BadgeCollectionProps) {
  if (badges.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        Complete streaks to earn badges!
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Badge collection">
      {badges.map((badge, i) => {
        const progress = getBadgeProgress(badge, streaks)
        const claimed = !!badge.claimed_at
        const pct = Math.round(progress * 100)

        return (
          <li
            key={i}
            className={`rounded-xl p-3 border text-center ${
              claimed
                ? 'border-purple-200 bg-purple-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="text-2xl mb-1" aria-hidden="true">
              {claimed ? '🏅' : '🔒'}
            </div>
            <p className="text-xs font-semibold text-gray-800 leading-tight mb-1">
              {badge.badge_name}
            </p>
            <p className="text-xs text-gray-400 mb-2">
              {STREAK_TYPE_LABELS[badge.streak_type]} · {badge.milestone_days}d
            </p>
            {/* Progress bar */}
            <div
              className="w-full bg-gray-200 rounded-full h-1.5"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${badge.badge_name} progress: ${pct}%`}
            >
              <div
                className={`h-1.5 rounded-full transition-all ${
                  claimed ? 'bg-purple-600' : 'bg-purple-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {claimed ? 'Claimed!' : `${pct}%`}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

'use client'

import type { StreakMilestone } from '@/lib/types'

type MilestoneStatus = 'claimed' | 'claimable' | 'locked'

interface MilestoneBadgeProps {
  milestone: StreakMilestone
  status: MilestoneStatus
  onClaim?: () => void
}

const statusStyles: Record<MilestoneStatus, string> = {
  claimed: 'bg-yellow-100 border-yellow-400 text-yellow-700',
  claimable: 'bg-purple-100 border-purple-400 text-purple-700 animate-pulse cursor-pointer',
  locked: 'bg-gray-100 border-gray-300 text-gray-400',
}

export function MilestoneBadge({ milestone, status, onClaim }: MilestoneBadgeProps) {
  const handleClick = () => {
    if (status === 'claimable' && onClaim) {
      onClaim()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status !== 'claimable'}
      className={`flex flex-col items-center p-2 rounded-full border-2 w-16 h-16 justify-center transition ${statusStyles[status]}`}
      aria-label={`${milestone.badge} - ${milestone.days} days - ${status}`}
    >
      <span className="text-xs font-bold">{milestone.days}d</span>
      <span className="text-[10px] leading-tight">+{milestone.bonus}</span>
    </button>
  )
}

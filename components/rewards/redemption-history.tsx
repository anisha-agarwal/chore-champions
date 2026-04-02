'use client'

import { Button } from '@/components/ui/button'
import { REWARD_ICON_OPTIONS } from '@/lib/types'
import type { RewardRedemptionWithDetails } from '@/lib/types'

export interface RedemptionHistoryProps {
  redemptions: RewardRedemptionWithDetails[]
  hasMore: boolean
  onLoadMore: () => void
  loadingMore: boolean
}

function getRewardEmoji(iconId: string): string {
  const option = REWARD_ICON_OPTIONS.find((o) => o.id === iconId)
  return option?.emoji ?? '🎁'
}

function StatusBadge({ status }: { status: RewardRedemptionWithDetails['status'] }) {
  if (status === 'approved') {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
        Approved
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
        Rejected — points refunded
      </span>
    )
  }
  return (
    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
      Waiting for approval
    </span>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

export function RedemptionHistory({
  redemptions,
  hasMore,
  onLoadMore,
  loadingMore,
}: RedemptionHistoryProps) {
  if (redemptions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No rewards redeemed yet.</p>
        <p className="text-sm mt-1">Browse the store to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {redemptions.map((redemption) => (
        <div
          key={redemption.id}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
        >
          <span className="text-2xl flex-shrink-0" role="img" aria-label={redemption.rewards.icon_id}>
            {getRewardEmoji(redemption.rewards.icon_id)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{redemption.rewards.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">
                {redemption.points_cost} pts · {formatRelativeTime(redemption.redeemed_at)}
              </span>
              <StatusBadge status={redemption.status} />
            </div>
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="text-center pt-2">
          <Button variant="secondary" size="sm" onClick={onLoadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

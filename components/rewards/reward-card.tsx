'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { REWARD_ICON_OPTIONS } from '@/lib/types'
import type { Reward } from '@/lib/types'

export interface RewardCardProps {
  reward: Reward
  userPoints: number
  userRole: 'parent' | 'child'
  isManageView?: boolean
  onRedeem?: (rewardId: string) => Promise<void>
  onEdit?: (reward: Reward) => void
  onToggle?: (reward: Reward) => Promise<void>
  onDelete?: (reward: Reward) => void
}

function getRewardEmoji(iconId: string): string {
  const option = REWARD_ICON_OPTIONS.find((o) => o.id === iconId)
  return option?.emoji ?? '🎁'
}

export function RewardCard({
  reward,
  userPoints,
  userRole,
  isManageView = false,
  onRedeem,
  onEdit,
  onToggle,
  onDelete,
}: RewardCardProps) {
  const [loadingAction, setLoadingAction] = useState<'redeem' | 'toggle' | null>(null)

  const emoji = getRewardEmoji(reward.icon_id)
  const canAfford = userPoints >= reward.points_cost
  const inStock = reward.stock === null || reward.stock > 0

  const handleRedeem = async () => {
    if (!onRedeem) return
    setLoadingAction('redeem')
    try {
      await onRedeem(reward.id)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleToggle = async () => {
    if (!onToggle) return
    setLoadingAction('toggle')
    try {
      await onToggle(reward)
    } finally {
      setLoadingAction(null)
    }
  }

  const redeemLabel = !inStock
    ? 'Out of stock'
    : !canAfford
      ? `Need ${reward.points_cost - userPoints} more pts`
      : 'Redeem'

  return (
    <div
      className={`rounded-xl bg-white shadow-sm border border-gray-100 p-4 ${
        isManageView && !reward.active ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl" role="img" aria-label={reward.icon_id}>
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{reward.title}</h3>
            {isManageView && !reward.active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>
          {reward.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{reward.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-sm font-bold text-purple-600">{reward.points_cost} pts</span>
            {reward.stock !== null && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  reward.stock === 0
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600'
                }`}
              >
                {reward.stock === 0 ? 'Out of stock' : `${reward.stock} left`}
              </span>
            )}
          </div>
        </div>
      </div>

      {isManageView ? (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={() => onEdit?.(reward)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            loading={loadingAction === 'toggle'}
          >
            {reward.active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete?.(reward)}>
            Delete
          </Button>
        </div>
      ) : (
        userRole === 'child' && (
          <div className="mt-3">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={handleRedeem}
              loading={loadingAction === 'redeem'}
              disabled={!inStock || !canAfford}
            >
              {redeemLabel}
            </Button>
          </div>
        )
      )}
    </div>
  )
}

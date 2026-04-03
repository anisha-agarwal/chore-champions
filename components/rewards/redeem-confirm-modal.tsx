'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { REWARD_ICON_OPTIONS } from '@/lib/types'
import type { Reward } from '@/lib/types'

export interface RedeemConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  reward: Reward | null
  userPoints: number
}

function getRewardEmoji(iconId: string): string {
  const option = REWARD_ICON_OPTIONS.find((o) => o.id === iconId)
  return option?.emoji ?? '🎁'
}

export function RedeemConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  reward,
  userPoints,
}: RedeemConfirmModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!reward) return null

  const emoji = getRewardEmoji(reward.icon_id)
  const balanceAfter = userPoints - reward.points_cost

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Redeem Reward">
      <div className="space-y-4">
        <div className="text-center">
          <span className="text-5xl" role="img" aria-label={reward.icon_id}>
            {emoji}
          </span>
          <h3 className="mt-3 text-lg font-semibold text-gray-900">{reward.title}</h3>
          <p className="mt-1 text-gray-600">
            Spend <span className="font-bold text-purple-600">{reward.points_cost} points</span> on this reward?
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Current balance</span>
            <span className="font-semibold">{userPoints} pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cost</span>
            <span className="font-semibold text-red-600">−{reward.points_cost} pts</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
            <span className="text-gray-700 font-medium">Balance after</span>
            <span className="font-bold text-purple-600">{balanceAfter} pts</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Your parent will need to approve this redemption.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            loading={loading}
            className="flex-1"
          >
            Confirm Redemption
          </Button>
        </div>
      </div>
    </Modal>
  )
}

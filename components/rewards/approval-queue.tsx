'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { REWARD_ICON_OPTIONS } from '@/lib/types'
import type { RewardRedemptionWithDetails } from '@/lib/types'

export interface ApprovalQueueProps {
  redemptions: RewardRedemptionWithDetails[]
  onApprove: (redemptionId: string) => Promise<void>
  onReject: (redemptionId: string) => Promise<void>
}

function getRewardEmoji(iconId: string): string {
  const option = REWARD_ICON_OPTIONS.find((o) => o.id === iconId)
  return option?.emoji ?? '🎁'
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export function ApprovalQueue({ redemptions, onApprove, onReject }: ApprovalQueueProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const handleApprove = async (redemptionId: string) => {
    setLoadingId(`${redemptionId}-approve`)
    try {
      await onApprove(redemptionId)
    } finally {
      setLoadingId(null)
    }
  }

  const handleRejectClick = (redemptionId: string) => {
    setRejectingId(redemptionId)
  }

  const handleRejectConfirm = async () => {
    setLoadingId(`${rejectingId!}-reject`)
    try {
      await onReject(rejectingId!)
      setRejectingId(null)
    } finally {
      setLoadingId(null)
    }
  }

  const rejectingRedemption = redemptions.find((r) => r.id === rejectingId)

  if (redemptions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No pending approvals.</p>
        <p className="text-sm mt-1">All caught up!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {redemptions.map((redemption) => {
        const childName =
          redemption.profiles?.nickname ??
          redemption.profiles?.display_name ??
          'A child'
        const isApprovingThis = loadingId === `${redemption.id}-approve`
        const isRejectingThis = loadingId === `${redemption.id}-reject`

        return (
          <div
            key={redemption.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <Avatar
                src={redemption.profiles?.avatar_url ?? null}
                fallback={childName}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{childName}</p>
                <p className="text-sm text-gray-500">{formatRelativeTime(redemption.redeemed_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label={redemption.rewards.icon_id}>
                  {getRewardEmoji(redemption.rewards.icon_id)}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{redemption.rewards.title}</p>
                  <p className="text-xs text-purple-600 font-semibold">{redemption.points_cost} pts</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => handleApprove(redemption.id)}
                loading={isApprovingThis}
                disabled={isRejectingThis || loadingId !== null && !isApprovingThis}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={() => handleRejectClick(redemption.id)}
                disabled={isApprovingThis || isRejectingThis}
              >
                Reject
              </Button>
            </div>
          </div>
        )
      })}

      {/* Reject confirmation */}
      {rejectingRedemption && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setRejectingId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject Reward?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Reject{' '}
                <span className="font-semibold">&quot;{rejectingRedemption.rewards.title}&quot;</span>?{' '}
                <span className="text-purple-600 font-semibold">
                  {rejectingRedemption.points_cost} points
                </span>{' '}
                will be refunded.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setRejectingId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={handleRejectConfirm}
                  loading={loadingId === `${rejectingId}-reject`}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

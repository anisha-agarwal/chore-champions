'use client'

import { useState } from 'react'
import { RewardCard } from '@/components/rewards/reward-card'
import { Button } from '@/components/ui/button'
import type { Reward } from '@/lib/types'

export interface ManageRewardsProps {
  rewards: Reward[]
  onAdd: () => void
  onEdit: (reward: Reward) => void
  onToggle: (reward: Reward) => Promise<void>
  onDelete: (reward: Reward) => Promise<void>
}

export function ManageRewards({ rewards, onAdd, onEdit, onToggle, onDelete }: ManageRewardsProps) {
  const [deletingReward, setDeletingReward] = useState<Reward | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteClick = (reward: Reward) => {
    setDeletingReward(reward)
    setDeleteError(null)
  }

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await onDelete(deletingReward!)
      setDeletingReward(null)
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Cannot delete. Deactivate it instead.'
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  // Active rewards first, then inactive
  const sorted = [...rewards].sort((a, b) => {
    if (a.active === b.active) return 0
    return a.active ? -1 : 1
  })

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="primary" size="sm" onClick={onAdd}>
          + Add Reward
        </Button>
      </div>

      {rewards.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No rewards yet.</p>
          <p className="text-sm mt-1">Create your first reward for your family!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sorted.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={0}
              userRole="parent"
              isManageView
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingReward && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDeletingReward(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Reward?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Delete <span className="font-semibold">&quot;{deletingReward.title}&quot;</span>? This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg mb-3">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setDeletingReward(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={handleDeleteConfirm}
                  loading={deleteLoading}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

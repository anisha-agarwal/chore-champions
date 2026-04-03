'use client'

import { useState } from 'react'
import { RewardCard } from '@/components/rewards/reward-card'
import { RedeemConfirmModal } from '@/components/rewards/redeem-confirm-modal'
import { REWARD_CATEGORIES } from '@/lib/types'
import type { Reward, RewardCategory } from '@/lib/types'

export interface RewardStoreProps {
  rewards: Reward[]
  userPoints: number
  userRole: 'parent' | 'child'
  onRedeem: (rewardId: string) => Promise<void>
}

export function RewardStore({ rewards, userPoints, userRole, onRedeem }: RewardStoreProps) {
  const [selectedCategory, setSelectedCategory] = useState<RewardCategory | 'all'>('all')
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)

  const filtered =
    selectedCategory === 'all'
      ? rewards
      : rewards.filter((r) => r.category === selectedCategory)

  const handleConfirmRedeem = async (): Promise<void> => {
    await onRedeem(selectedReward!.id)
    setSelectedReward(null)
  }

  return (
    <div>
      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-full border font-medium transition ${
            selectedCategory === 'all'
              ? 'bg-purple-100 text-purple-700 border-purple-300'
              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {REWARD_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-full border font-medium transition ${
              selectedCategory === cat.value
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Reward grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No rewards available yet.</p>
          <p className="text-sm mt-1">Ask your parents to add some!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={userPoints}
              userRole={userRole}
              onRedeem={userRole === 'child' ? async () => { setSelectedReward(reward) } : undefined}
            />
          ))}
        </div>
      )}

      <RedeemConfirmModal
        isOpen={selectedReward !== null}
        onClose={() => setSelectedReward(null)}
        onConfirm={handleConfirmRedeem}
        reward={selectedReward}
        userPoints={userPoints}
      />
    </div>
  )
}

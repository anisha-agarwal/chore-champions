'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { REWARD_CATEGORIES, REWARD_ICON_OPTIONS } from '@/lib/types'
import type { Reward, RewardCategory } from '@/lib/types'

export interface RewardFormData {
  title: string
  description: string
  points_cost: number
  category: RewardCategory
  icon_id: string
  stock: number | null
}

export interface RewardFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: RewardFormData) => Promise<void>
  reward?: Reward
}

export function RewardForm({ isOpen, onClose, onSubmit, reward }: RewardFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pointsCost, setPointsCost] = useState('10')
  const [category, setCategory] = useState<RewardCategory>('other')
  const [iconId, setIconId] = useState('star')
  const [stockInput, setStockInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate fields when editing
  useEffect(() => {
    if (reward) {
      setTitle(reward.title)
      setDescription(reward.description ?? '')
      setPointsCost(String(reward.points_cost))
      setCategory(reward.category as RewardCategory)
      setIconId(reward.icon_id)
      setStockInput(reward.stock !== null ? String(reward.stock) : '')
    } else {
      setTitle('')
      setDescription('')
      setPointsCost('10')
      setCategory('other')
      setIconId('star')
      setStockInput('')
    }
    setError(null)
  }, [reward, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Title is required')
      return
    }

    const cost = parseInt(pointsCost, 10)
    if (isNaN(cost) || cost < 1) {
      setError('Points cost must be at least 1')
      return
    }

    let stock: number | null = null
    if (stockInput.trim() !== '') {
      const stockNum = parseInt(stockInput, 10)
      if (isNaN(stockNum) || stockNum < 1) {
        setError('Stock must be at least 1 if provided')
        return
      }
      stock = stockNum
    }

    setLoading(true)
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        points_cost: cost,
        category,
        icon_id: iconId,
        stock,
      })
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={reward ? 'Edit Reward' : 'New Reward'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
        )}

        <div>
          <label htmlFor="reward-title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="reward-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="e.g. Movie Night"
          />
        </div>

        <div>
          <label htmlFor="reward-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="reward-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            placeholder="Optional details..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reward-points" className="block text-sm font-medium text-gray-700 mb-1">
              Points Cost <span className="text-red-500">*</span>
            </label>
            <input
              id="reward-points"
              type="text"
              inputMode="numeric"
              value={pointsCost}
              onChange={(e) => setPointsCost(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label htmlFor="reward-stock" className="block text-sm font-medium text-gray-700 mb-1">
              Stock Limit
            </label>
            <input
              id="reward-stock"
              type="text"
              inputMode="numeric"
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Unlimited"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reward-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="reward-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as RewardCategory)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {REWARD_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Icon</p>
          <div className="grid grid-cols-8 gap-1">
            {REWARD_ICON_OPTIONS.map((icon) => (
              <button
                key={icon.id}
                type="button"
                onClick={() => setIconId(icon.id)}
                aria-label={icon.label}
                className={`text-xl p-1 rounded-lg transition ${
                  iconId === icon.id
                    ? 'ring-2 ring-purple-600 bg-purple-50'
                    : 'hover:bg-gray-100'
                }`}
              >
                {icon.emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading} className="flex-1">
            {reward ? 'Save Changes' : 'Create Reward'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

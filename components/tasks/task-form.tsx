'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { TIME_OF_DAY_OPTIONS, type Profile } from '@/lib/types'

interface TaskFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (task: {
    title: string
    description: string
    points: number
    time_of_day: string
    recurring: string | null
    assigned_to: string | null
    due_date: string | null
  }) => Promise<void>
  familyMembers: Profile[]
  selectedDate: Date
}

export function TaskForm({ isOpen, onClose, onSubmit, familyMembers, selectedDate }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState(10)
  const [timeOfDay, setTimeOfDay] = useState('anytime')
  const [recurring, setRecurring] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    setError(null)

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        points,
        time_of_day: timeOfDay,
        recurring,
        assigned_to: assignedTo,
        due_date: selectedDate.toISOString().split('T')[0],
      })

      // Reset form
      setTitle('')
      setDescription('')
      setPoints(10)
      setTimeOfDay('anytime')
      setRecurring(null)
      setAssignedTo(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Quest">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quest Name *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            placeholder="e.g., Clean your room"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
            placeholder="Optional details..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Points
            </label>
            <select
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              <option value={5}>5 points</option>
              <option value={10}>10 points</option>
              <option value={15}>15 points</option>
              <option value={20}>20 points</option>
              <option value={25}>25 points</option>
              <option value={50}>50 points</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time of Day
            </label>
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              {TIME_OF_DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign To
          </label>
          <select
            value={assignedTo || ''}
            onChange={(e) => setAssignedTo(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="">Anyone</option>
            {familyMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.nickname || member.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Repeat
          </label>
          <select
            value={recurring || ''}
            onChange={(e) => setRecurring(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="">One time only</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !title.trim()}
            className="flex-1"
          >
            {loading ? 'Creating...' : 'Create Quest'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

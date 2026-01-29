'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import type { TaskWithAssignee } from '@/lib/types'

interface TaskCardProps {
  task: TaskWithAssignee
  onComplete: (taskId: string) => Promise<void>
  onEdit: (task: TaskWithAssignee) => void
}

export function TaskCard({ task, onComplete, onEdit }: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(task.completed)

  // Sync with prop when task data changes (e.g., navigating between days)
  useEffect(() => {
    setIsCompleted(task.completed)
  }, [task.completed])

  async function handleComplete() {
    if (isCompleted || isCompleting) return

    setIsCompleting(true)
    try {
      await onComplete(task.id)
      setIsCompleted(true)
    } catch (error) {
      console.error('Failed to complete task:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  const timeLabels: Record<string, { label: string; color: string }> = {
    morning: { label: 'Morning', color: 'bg-amber-100 text-amber-700' },
    afternoon: { label: 'Afternoon', color: 'bg-blue-100 text-blue-700' },
    night: { label: 'Night', color: 'bg-indigo-100 text-indigo-700' },
    anytime: { label: 'Anytime', color: 'bg-gray-100 text-gray-600' },
  }

  const timeInfo = timeLabels[task.time_of_day] || timeLabels.anytime

  return (
    <div
      className={cn(
        'bg-white rounded-xl p-4 shadow-sm border border-gray-100 transition-all',
        isCompleted && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={handleComplete}
          disabled={isCompleted || isCompleting}
          className={cn(
            'mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            isCompleted
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-purple-500'
          )}
        >
          {isCompleted && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isCompleting && (
            <svg className="w-4 h-4 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'font-semibold text-gray-900',
              isCompleted && 'line-through text-gray-500'
            )}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', timeInfo.color)}>
              {timeInfo.label}
            </span>

            <span className="flex items-center gap-1 text-sm text-yellow-600 font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
              {task.points} pts
            </span>

            {task.recurring && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {task.recurring === 'daily' ? 'Daily' : 'Weekly'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isCompleted && (
            <button
              onClick={() => onEdit(task)}
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Edit quest"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {task.profiles && (
            <Avatar
              src={task.profiles.avatar_url}
              fallback={task.profiles.nickname || task.profiles.display_name}
              size="sm"
            />
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn, combineDateAndTime, formatTime, getTimeRemaining, formatTimeRemaining, toDateString } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import type { Profile, TaskWithAssignee } from '@/lib/types'

interface TaskCardProps {
  task: TaskWithAssignee
  onComplete: (taskId: string) => Promise<void>
  onUncomplete: (taskId: string) => Promise<void>
  onEdit: (task: TaskWithAssignee) => void
  onDelete: (task: TaskWithAssignee) => void
  currentUser: Profile | null
  selectedDate?: Date
}

type DeadlineStatus = {
  isOverdue: boolean
  isWarning: boolean
  hours: number
  minutes: number
} | null

function computeDeadlineStatus(
  dueTime: string | null | undefined,
  dueDate: string | null | undefined,
  recurring: string | null | undefined,
  isCompleted: boolean,
  selectedDate?: Date
): DeadlineStatus {
  if (!dueTime || isCompleted) return null

  const dateStr = recurring && selectedDate ? toDateString(selectedDate) : dueDate
  if (!dateStr) return null

  const deadline = combineDateAndTime(dateStr, dueTime)
  const remaining = getTimeRemaining(deadline)
  return {
    isOverdue: remaining.isOverdue,
    isWarning: remaining.isWarning,
    hours: remaining.hours,
    minutes: remaining.minutes,
  }
}

// Hook to track deadline status with 60-second updates
function useDeadlineStatus(task: TaskWithAssignee, isCompleted: boolean, selectedDate?: Date) {
  // Track a tick counter to force re-computation every 60 seconds
  const [tick, setTick] = useState(0)

  // Recompute whenever task props change OR tick increments (every 60s)
  const currentStatus = useMemo(
    () => computeDeadlineStatus(task.due_time, task.due_date, task.recurring, isCompleted, selectedDate),
    [task.due_time, task.due_date, task.recurring, isCompleted, selectedDate, tick]
  )

  useEffect(() => {
    // Only set up interval when there is an active deadline to track
    if (!task.due_time || isCompleted) return

    const dateStr = task.recurring && selectedDate ? toDateString(selectedDate) : task.due_date
    if (!dateStr) return

    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [task.due_time, task.due_date, task.recurring, isCompleted, selectedDate])

  return currentStatus
}

export function TaskCard({ task, onComplete, onUncomplete, onEdit, onDelete, currentUser, selectedDate }: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [isUncompleting, setIsUncompleting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(task.completed)

  // Determine if user can delete this task
  // Parents can delete any task, kids can only delete tasks they created
  const canDelete = currentUser?.role === 'parent' || task.created_by === currentUser?.id

  // Sync with prop when task data changes (e.g., navigating between days)
  useEffect(() => {
    setIsCompleted(task.completed)
  }, [task.completed])

  const deadlineStatus = useDeadlineStatus(task, isCompleted, selectedDate)

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

  async function handleUncomplete() {
    if (!isCompleted || isUncompleting) return

    setIsUncompleting(true)
    try {
      await onUncomplete(task.id)
      setIsCompleted(false)
    } catch (error) {
      console.error('Failed to uncomplete task:', error)
    } finally {
      setIsUncompleting(false)
    }
  }

  function handleCheckboxClick() {
    if (isCompleted) {
      handleUncomplete()
    } else {
      handleComplete()
    }
  }

  const timeLabels: Record<string, { label: string; color: string }> = {
    morning: { label: 'Morning', color: 'bg-amber-100 text-amber-700' },
    afternoon: { label: 'Afternoon', color: 'bg-blue-100 text-blue-700' },
    night: { label: 'Night', color: 'bg-indigo-100 text-indigo-700' },
    anytime: { label: 'Anytime', color: 'bg-gray-100 text-gray-600' },
  }

  const timeInfo = timeLabels[task.time_of_day] || timeLabels.anytime

  // Determine border color based on deadline status
  const borderClass = !isCompleted && deadlineStatus
    ? deadlineStatus.isOverdue
      ? 'border-red-400'
      : deadlineStatus.isWarning
        ? 'border-amber-400'
        : 'border-gray-100'
    : 'border-gray-100'

  return (
    <div
      className={cn(
        'bg-white rounded-xl p-4 shadow-sm border transition-all',
        borderClass,
        isCompleted && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={handleCheckboxClick}
          disabled={isCompleting || isUncompleting}
          title={isCompleted ? 'Click to undo' : undefined}
          className={cn(
            'mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            isCompleted
              ? 'bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600 cursor-pointer'
              : 'border-gray-300 hover:border-purple-500'
          )}
        >
          {isCompleted && !isUncompleting && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {(isCompleting || isUncompleting) && (
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

            {/* Due time badge with countdown */}
            {task.due_time && !isCompleted && deadlineStatus && (
              <span
                data-testid="due-time-badge"
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  deadlineStatus.isOverdue
                    ? 'bg-red-100 text-red-700'
                    : deadlineStatus.isWarning
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700'
                )}
              >
                {formatTime(task.due_time)} ({formatTimeRemaining(deadlineStatus)})
              </span>
            )}

            {/* Show just the time for completed tasks with due_time */}
            {task.due_time && isCompleted && (
              <span
                data-testid="due-time-badge"
                className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700"
              >
                {formatTime(task.due_time)}
              </span>
            )}

            {/* Points display: show half-points indicator when overdue */}
            {!isCompleted && deadlineStatus?.isOverdue ? (
              <span className="flex items-center gap-1 text-sm font-medium">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
                <span className="line-through text-gray-400">{task.points}</span>
                <span className="text-red-600" data-testid="half-points">{Math.floor(task.points / 2)} pts</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-yellow-600 font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
                {task.points} pts
              </span>
            )}

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
          {canDelete && (
            <button
              onClick={() => onDelete(task)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete quest"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {task.profiles && (
            <Avatar
              src={task.profiles.avatar_url}
              fallback={task.profiles.nickname || task.profiles.display_name}
              size="sm"
              title={task.profiles.nickname || task.profiles.display_name}
            />
          )}
        </div>
      </div>
    </div>
  )
}

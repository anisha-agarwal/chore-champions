'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeekPicker } from '@/components/layout/week-picker'
import { TimeFilter } from '@/components/tasks/time-filter'
import { TaskList } from '@/components/tasks/task-list'
import { TaskForm } from '@/components/tasks/task-form'
import { MemberFilter } from '@/components/family/member-filter'
import { toDateString } from '@/lib/utils'
import type { Profile, TaskWithAssignee } from '@/lib/types'

export default function QuestsPage() {
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([])
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Fetch current user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setLoading(false)
      return
    }
    setCurrentUser(profile)

    // Fetch family members
    if (profile.family_id) {
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id)

      setFamilyMembers(members || [])

      // Fetch tasks for the selected date (including recurring tasks)
      const dateStr = toDateString(selectedDate)
      const dayOfWeek = selectedDate.getDay()

      // 1. Fetch one-time tasks for this date
      const { data: oneTimeTasks } = await supabase
        .from('tasks')
        .select('*, profiles!tasks_assigned_to_fkey(id, display_name, avatar_url, nickname)')
        .eq('family_id', profile.family_id)
        .eq('due_date', dateStr)
        .is('recurring', null)
        .order('created_at', { ascending: true })

      // 2. Fetch recurring tasks that started on or before this date
      const { data: recurringTasks } = await supabase
        .from('tasks')
        .select('*, profiles!tasks_assigned_to_fkey(id, display_name, avatar_url, nickname)')
        .eq('family_id', profile.family_id)
        .lte('due_date', dateStr)
        .not('recurring', 'is', null)
        .order('created_at', { ascending: true })

      // 3. Filter weekly recurring tasks by day of week
      const filteredRecurring = (recurringTasks || []).filter((task) => {
        if (task.recurring === 'daily') return true
        if (task.recurring === 'weekly' && task.due_date) {
          const taskDate = new Date(task.due_date + 'T00:00:00')
          return taskDate.getDay() === dayOfWeek
        }
        return false
      })

      // 4. Get IDs of all recurring tasks to check completions
      const recurringIds = filteredRecurring.map((t) => t.id)

      // 5. Fetch completions for recurring tasks on the selected date
      let completedTaskIds: Set<string> = new Set()

      if (recurringIds.length > 0) {
        const { data: completions } = await supabase
          .from('task_completions')
          .select('task_id')
          .in('task_id', recurringIds)
          .eq('completion_date', dateStr)

        completedTaskIds = new Set((completions || []).map((c) => c.task_id))
      }

      // 6. Mark recurring tasks as completed/not for this specific date
      const processedRecurring = filteredRecurring.map((task) => ({
        ...task,
        completed: completedTaskIds.has(task.id),
      }))

      setTasks([...(oneTimeTasks || []), ...processedRecurring])
    }

    setLoading(false)
  }, [supabase, selectedDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleCreateTask(taskData: {
    title: string
    description: string
    points: number
    time_of_day: string
    recurring: string | null
    assigned_to: string | null
    due_date: string | null
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentUser?.family_id) throw new Error('Not authenticated')

    const { error } = await supabase.from('tasks').insert({
      ...taskData,
      family_id: currentUser.family_id,
      created_by: user.id,
    })

    if (error) throw error
    fetchData()
  }

  async function handleCompleteTask(taskId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found')

    // For non-recurring tasks, mark as completed on the task row
    if (!task.recurring) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ completed: true })
        .eq('id', taskId)

      if (updateError) throw updateError
    }

    // Create completion record
    // For recurring tasks, store the completion_date so we can query by date.
    // completed_at keeps its database default (now()) for audit purposes.
    const { error: completionError } = await supabase
      .from('task_completions')
      .insert({
        task_id: taskId,
        completed_by: user.id,
        points_earned: task.points,
        completion_date: task.recurring ? toDateString(selectedDate) : null,
      })

    if (completionError) throw completionError

    fetchData()
  }

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Filter by member
    if (selectedMember === 'all-kids') {
      const childIds = familyMembers.filter((m) => m.role === 'child').map((m) => m.id)
      if (task.assigned_to && !childIds.includes(task.assigned_to)) return false
    } else if (selectedMember && task.assigned_to !== selectedMember) {
      return false
    }

    // Filter by time of day
    if (selectedTime !== 'all' && task.time_of_day !== selectedTime) {
      return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!currentUser?.family_id) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Family Yet</h2>
          <p className="text-gray-600 mb-4">
            Create or join a family to start tracking quests!
          </p>
          <a
            href="/family"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Set Up Family
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quests</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-semibold text-purple-600">{currentUser.points}</span>
          <span>points</span>
        </div>
      </header>

      <MemberFilter
        members={familyMembers}
        selectedId={selectedMember}
        currentUserId={currentUser.id}
        onChange={setSelectedMember}
      />

      <WeekPicker selectedDate={selectedDate} onDateSelect={setSelectedDate} />

      <TimeFilter selected={selectedTime} onChange={setSelectedTime} />

      <TaskList
        tasks={filteredTasks}
        onComplete={handleCompleteTask}
        emptyMessage="No quests for this day. Add one!"
        dateKey={toDateString(selectedDate)}
      />

      {/* FAB */}
      <button
        onClick={() => setIsFormOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <TaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateTask}
        familyMembers={familyMembers}
        selectedDate={selectedDate}
      />
    </div>
  )
}

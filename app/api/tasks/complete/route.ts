import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'
import { sendPushToUser } from '@/lib/push/send'
import { combineDateAndTime } from '@/lib/utils'

interface TaskRow {
  id: string
  title: string
  points: number
  recurring: string | null
  due_time: string | null
  due_date: string | null
  family_id: string
  completed: boolean
  assigned_to: string | null
  self_assigned: boolean
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { taskId?: string; selectedDate?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.taskId || typeof body.taskId !== 'string') {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return NextResponse.json({ error: 'User has no family' }, { status: 403 })
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, points, recurring, due_time, due_date, family_id, completed, assigned_to, self_assigned')
    .eq('id', body.taskId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const typedTask = task as TaskRow

  if (typedTask.family_id !== profile.family_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!typedTask.recurring && typedTask.completed) {
    return NextResponse.json({ error: 'Task already completed' }, { status: 409 })
  }

  // For non-recurring tasks, mark as completed
  if (!typedTask.recurring) {
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', body.taskId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
  }

  // Calculate points: half if overdue
  let pointsEarned = typedTask.points
  if (typedTask.due_time) {
    const dateStr = typedTask.recurring ? body.selectedDate : typedTask.due_date
    if (dateStr) {
      const deadline = combineDateAndTime(dateStr, typedTask.due_time)
      if (new Date() > deadline) {
        pointsEarned = Math.floor(typedTask.points / 2)
      }
    }
  }

  // Initiative bonus: +50% for self-assigned tasks completed by the assignee
  const bonusApplied = typedTask.self_assigned && typedTask.assigned_to === user.id
  if (bonusApplied) {
    pointsEarned = Math.ceil(pointsEarned * 1.5)
  }

  const completionDate = typedTask.recurring && body.selectedDate ? body.selectedDate : null

  const { error: completionError } = await supabase
    .from('task_completions')
    .insert({
      task_id: body.taskId,
      completed_by: user.id,
      points_earned: pointsEarned,
      completion_date: completionDate,
      bonus_applied: bonusApplied,
    })

  if (completionError) {
    return NextResponse.json({ error: 'Failed to record completion' }, { status: 500 })
  }

  // Fire push to parents (async, never blocks response)
  void notifyParents(profile.family_id, user.id, typedTask.title)

  return NextResponse.json({
    pointsEarned,
    taskTitle: typedTask.title,
    bonusApplied,
  })
}

async function notifyParents(familyId: string, completedBy: string, taskTitle: string) {
  try {
    const supabase = (await import('@/lib/observability/service-client')).createServiceClient()
    const { data: parents } = await supabase
      .from('profiles')
      .select('id')
      .eq('family_id', familyId)
      .eq('role', 'parent')

    if (!parents) return

    const childProfile = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', completedBy)
      .single()

    const childName = childProfile.data?.display_name ?? 'Your child'

    await Promise.allSettled(
      parents.map((parent: { id: string }) =>
        sendPushToUser(parent.id, {
          type: 'task_completed',
          title: `${childName} completed a task`,
          body: `"${taskTitle}" — tap to see`,
          url: '/quests',
        }),
      ),
    )
  } catch {
    // Push failure must never affect the completion response
  }
}

export const POST = withObservability(handler)

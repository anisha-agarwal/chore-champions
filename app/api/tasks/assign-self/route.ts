import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'

interface TaskRow {
  id: string
  family_id: string
  assigned_to: string | null
  completed: boolean
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { taskId?: string }
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
    .select('id, family_id, assigned_to, completed')
    .eq('id', body.taskId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const typedTask = task as TaskRow

  if (typedTask.family_id !== profile.family_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (typedTask.assigned_to !== null) {
    return NextResponse.json({ error: 'Task is already assigned' }, { status: 409 })
  }

  if (typedTask.completed) {
    return NextResponse.json({ error: 'Task already completed' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ assigned_to: user.id, self_assigned: true })
    .eq('id', body.taskId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to assign task' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const POST = withObservability(handler)

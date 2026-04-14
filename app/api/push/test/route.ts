import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'
import { sendPushToUser } from '@/lib/push/send'

async function handler(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sent = await sendPushToUser(user.id, {
    type: 'test',
    title: 'Chore Champions test',
    body: 'Notifications are working on this device.',
    url: '/me?tab=notifications',
  })

  return NextResponse.json({ sent })
}

export const POST = withObservability(handler)

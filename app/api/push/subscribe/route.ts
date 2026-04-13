import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'

async function handler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { endpoint?: string; p256dh_key?: string; auth_key?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.endpoint || typeof body.endpoint !== 'string') {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  if (!body.p256dh_key || typeof body.p256dh_key !== 'string') {
    return NextResponse.json({ error: 'p256dh_key is required' }, { status: 400 })
  }

  if (!body.auth_key || typeof body.auth_key !== 'string') {
    return NextResponse.json({ error: 'auth_key is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh_key: body.p256dh_key,
        auth_key: body.auth_key,
        user_agent: req.headers.get('user-agent') ?? undefined,
      },
      { onConflict: 'user_id,endpoint' },
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const POST = withObservability(handler)

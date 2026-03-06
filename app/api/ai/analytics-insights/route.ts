import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateStaticSummary } from '@/lib/analytics-utils'
import type { KidAnalytics, FamilyAnalytics } from '@/lib/types'

const KID_SYSTEM_PROMPT =
  'You are a fun, encouraging coach for a kid using a chore-tracking app called Chore Champions. ' +
  'Write 2-3 short sentences about their week. Be specific about numbers. Celebrate wins. ' +
  'If they did fewer tasks than last week, gently encourage without being negative. ' +
  'Use simple language appropriate for ages 6-14. No emojis.'

const PARENT_SYSTEM_PROMPT =
  'You are an analytics assistant for a family chore-tracking app. ' +
  'Write 2-3 concise sentences summarizing the family\'s week. Be data-specific. ' +
  'Highlight which children improved, flag declining engagement, and note standout tasks. ' +
  'Tone: supportive and actionable.'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ narrative: null, generated_at: new Date().toISOString() })
  }

  let role: 'parent' | 'child'
  try {
    const body = await request.json()
    role = body.role === 'parent' ? 'parent' : 'child'
  } catch {
    return NextResponse.json({ narrative: null, generated_at: new Date().toISOString() })
  }

  // Re-fetch stats server-side — never trust client-supplied stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ narrative: null, generated_at: new Date().toISOString() })
  }

  let stats: KidAnalytics | FamilyAnalytics | null = null

  if (profile.role === 'parent' && profile.family_id) {
    const { data } = await supabase.rpc('get_family_analytics', {
      p_family_id: profile.family_id,
      p_weeks: 4,
    })
    stats = data as FamilyAnalytics | null
  } else {
    const { data } = await supabase.rpc('get_kid_analytics', {
      p_user_id: user.id,
      p_weeks: 4,
    })
    stats = data as KidAnalytics | null
  }

  if (!stats) {
    return NextResponse.json({ narrative: null, generated_at: new Date().toISOString() })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: role === 'child' ? KID_SYSTEM_PROMPT : PARENT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(stats) }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json({
        narrative: generateStaticSummary(stats, role),
        generated_at: new Date().toISOString(),
      })
    }

    const result = await response.json()
    const narrative = result.content?.[0]?.text?.trim() ?? null
    return NextResponse.json({ narrative, generated_at: new Date().toISOString() })
  } catch {
    clearTimeout(timeout)
    return NextResponse.json({
      narrative: generateStaticSummary(stats, role),
      generated_at: new Date().toISOString(),
    })
  }
}

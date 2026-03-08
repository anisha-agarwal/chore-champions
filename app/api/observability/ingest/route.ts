import { NextResponse, type NextRequest } from 'next/server'
import { validateIngestPayload } from '@/lib/observability/ingest-validation'
import { logError } from '@/lib/observability/error-logger'
import { trackEvent } from '@/lib/observability/event-tracker'
import { INGEST_MAX_PAYLOAD_BYTES } from '@/lib/observability/constants'

export async function POST(request: NextRequest) {
  // Token check — read at request time so tests can set env var before calling
  const INGEST_TOKEN = process.env.NEXT_PUBLIC_OBSERVABILITY_INGEST_TOKEN
  const token = request.headers.get('x-obs-token')
  if (!INGEST_TOKEN || token !== INGEST_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Payload size check
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > INGEST_MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch /* istanbul ignore next -- defensive: request.text() only throws on stream errors */ {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (Buffer.byteLength(rawBody, 'utf8') > INGEST_MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validation = validateIngestPayload(parsed)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status })
  }

  const { payload } = validation

  // Process payload — always return 200 even on partial failure
  if (payload.type === 'error') {
    logError(payload.data)
  } else if (payload.type === 'event') {
    trackEvent(payload.data)
  } else if (payload.type === 'batch') {
    for (const item of payload.items) {
      if (item.type === 'error') {
        logError(item.data)
      } else {
        trackEvent(item.data)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

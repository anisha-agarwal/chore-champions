'use client'

import type { AppEventType, AppErrorType } from './constants'

const INGEST_URL = '/api/observability/ingest'
const OBS_TOKEN = process.env.NEXT_PUBLIC_OBSERVABILITY_INGEST_TOKEN ?? ''

interface ClientLogEventParams {
  event_type: AppEventType
  metadata?: Record<string, unknown>
  duration_ms?: number
}

interface ClientLogErrorParams {
  error_message: string
  error_type: AppErrorType
  route: string
  metadata?: Record<string, unknown>
}

function sendToIngest(payload: unknown): void {
  void fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-obs-token': OBS_TOKEN,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Silent failure — client-side logging must never surface errors to the user
  })
}

/**
 * Logs an event from the browser. Fire-and-forget.
 */
export function logClientEvent(params: ClientLogEventParams): void {
  sendToIngest({ type: 'event', data: params })
}

/**
 * Logs an error from the browser. Fire-and-forget.
 */
export function logClientError(params: ClientLogErrorParams): void {
  sendToIngest({ type: 'error', data: params })
}

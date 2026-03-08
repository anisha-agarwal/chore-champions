import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { logError } from './error-logger'
import { trackEvent } from './event-tracker'

export interface InstrumentedRpcResult<T> {
  data: T | null
  error: PostgrestError | null
  durationMs: number
}

export interface InstrumentedRpcContext {
  route: string
  userId?: string
}

/**
 * Wraps a Supabase RPC call with timing, error logging, and event tracking.
 * Returns the same { data, error } shape as a regular RPC call, plus durationMs.
 * All observability side effects are fire-and-forget (void).
 */
export async function instrumentedRpc<T>(
  supabase: SupabaseClient,
  rpcName: string,
  args: Record<string, unknown>,
  context: InstrumentedRpcContext
): Promise<InstrumentedRpcResult<T>> {
  const start = Date.now()

  const { data, error } = await supabase.rpc(rpcName, args)

  const durationMs = Date.now() - start

  // Fire-and-forget: log error if RPC failed
  if (error) {
    logError({
      error_message: error.message,
      error_type: 'rpc',
      route: context.route,
      error_code: error.code,
      user_id: context.userId,
      metadata: { rpcName },
    })
  }

  // Fire-and-forget: always track the RPC call for performance metrics
  trackEvent({
    event_type: 'rpc_call',
    user_id: context.userId,
    metadata: { rpcName, route: context.route, success: !error },
    duration_ms: durationMs,
  })

  return { data: data as T | null, error, durationMs }
}

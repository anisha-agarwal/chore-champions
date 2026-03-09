import { createServiceClient } from './service-client'
import type { AppErrorType } from './constants'
import { APP_ERROR_TYPES } from './constants'

export interface LogErrorParams {
  error_message: string
  error_type: AppErrorType
  route: string
  error_code?: string
  method?: string
  user_id?: string
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget error logger. Never throws. Never blocks the request path.
 * Uses service-role client to bypass RLS.
 */
export function logError(params: LogErrorParams): void {
  if (!APP_ERROR_TYPES.includes(params.error_type)) {
    /* istanbul ignore next */
    if (process.env.NODE_ENV === 'development') {
      console.warn('[observability] Unknown error_type:', params.error_type)
    }
    return
  }

  void (async () => {
    try {
      const supabase = createServiceClient()
      await supabase.from('app_errors').insert({
        error_message: params.error_message.slice(0, 1000),
        error_type: params.error_type,
        error_code: params.error_code ?? null,
        route: params.route,
        method: params.method ?? null,
        user_id: params.user_id ?? null,
        metadata: params.metadata ?? {},
      })
    } catch (err) {
      /* istanbul ignore next */
      if (process.env.NODE_ENV === 'development') {
        console.warn('[observability] logError failed:', err)
      }
    }
  })()
}

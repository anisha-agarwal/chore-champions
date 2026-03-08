import { createServiceClient } from './service-client'

export interface CleanupResult {
  errors_deleted: number
  events_deleted: number
  cutoff: string
}

/**
 * Deletes observability data older than p_days days.
 * Calls the cleanup_old_observability_data DB RPC via service-role client.
 */
export async function runCleanup(days = 90): Promise<CleanupResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('cleanup_old_observability_data', {
    p_days: days,
  })

  if (error) throw new Error(error.message)

  return data as CleanupResult
}

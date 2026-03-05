// Retry tests once on failure (handles transient Supabase rate limiting)
jest.retryTimes(1, { logErrorsBeforeRetry: true })

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ from: jest.fn() }),
}))

import { createServiceClient } from '@/lib/observability/service-client'
import { createClient } from '@supabase/supabase-js'

describe('createServiceClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    jest.clearAllMocks()
  })

  it('calls createClient with URL and service role key', () => {
    createServiceClient()
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'service-role-key',
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) })
    )
  })

  it('returns the client from createClient', () => {
    const client = createServiceClient()
    expect(client).toBeDefined()
  })
})

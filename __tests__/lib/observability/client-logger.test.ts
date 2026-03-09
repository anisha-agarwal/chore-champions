// Mock fetch before importing the module
const mockFetch = jest.fn().mockResolvedValue({ ok: true })
global.fetch = mockFetch

import { logClientEvent, logClientError } from '@/lib/observability/client-logger'

describe('logClientEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends event to ingest endpoint', async () => {
    logClientEvent({ event_type: 'page_view', metadata: { path: '/quests' } })
    await new Promise((r) => setTimeout(r, 10))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/observability/ingest',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('page_view'),
      })
    )
  })

  it('does not throw when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    expect(() => logClientEvent({ event_type: 'page_view' })).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
  })
})

describe('logClientError', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends error to ingest endpoint', async () => {
    logClientError({
      error_message: 'Component crashed',
      error_type: 'boundary',
      route: '/quests',
      metadata: { componentStack: 'at Foo' },
    })
    await new Promise((r) => setTimeout(r, 10))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/observability/ingest',
      expect.objectContaining({
        body: expect.stringContaining('boundary'),
      })
    )
  })

  it('does not throw when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    expect(() =>
      logClientError({ error_message: 'err', error_type: 'client', route: '/test' })
    ).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
  })
})

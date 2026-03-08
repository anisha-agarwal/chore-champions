import {
  validateIngestPayload,
  sanitizeMetadata,
} from '@/lib/observability/ingest-validation'

describe('sanitizeMetadata', () => {
  it('returns empty object for non-object input', () => {
    expect(sanitizeMetadata(null)).toEqual({})
    expect(sanitizeMetadata('string')).toEqual({})
    expect(sanitizeMetadata([])).toEqual({})
    expect(sanitizeMetadata(42)).toEqual({})
  })

  it('keeps allowed keys and strips unknown keys', () => {
    const result = sanitizeMetadata({
      route: '/api/test',
      rpcName: 'get_data',
      unknownKey: 'should be stripped',
      taskName: 'wash dishes',
    })
    expect(result).toEqual({ route: '/api/test', rpcName: 'get_data', taskName: 'wash dishes' })
    expect(result).not.toHaveProperty('unknownKey')
  })

  it('returns empty object when serialized size exceeds METADATA_MAX_BYTES', () => {
    const huge = 'x'.repeat(11 * 1024) // 11KB
    const result = sanitizeMetadata({ route: huge })
    expect(result).toEqual({})
  })
})

describe('validateIngestPayload', () => {
  it('rejects non-object payload', () => {
    const result = validateIngestPayload('invalid')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects unknown payload type', () => {
    const result = validateIngestPayload({ type: 'unknown' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  describe('error type', () => {
    it('validates required fields', () => {
      const result = validateIngestPayload({ type: 'error', data: { error_message: '', error_type: 'api', route: '/api/test' } })
      expect(result.ok).toBe(false)
    })

    it('rejects invalid error_type', () => {
      const result = validateIngestPayload({ type: 'error', data: { error_message: 'oops', error_type: 'invalid', route: '/api/test' } })
      expect(result.ok).toBe(false)
    })

    it('rejects missing route', () => {
      const result = validateIngestPayload({ type: 'error', data: { error_message: 'oops', error_type: 'api' } })
      expect(result.ok).toBe(false)
    })

    it('rejects non-object data', () => {
      const result = validateIngestPayload({ type: 'error', data: 'not-an-object' })
      expect(result.ok).toBe(false)
    })

    it('accepts valid error payload', () => {
      const result = validateIngestPayload({
        type: 'error',
        data: { error_message: 'Something failed', error_type: 'api', route: '/api/test', metadata: { route: '/api/test' } },
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'error') {
        expect(result.payload.data.error_message).toBe('Something failed')
        expect(result.payload.data.error_type).toBe('api')
      }
    })

    it('truncates error_message to 1000 chars', () => {
      const longMsg = 'x'.repeat(2000)
      const result = validateIngestPayload({ type: 'error', data: { error_message: longMsg, error_type: 'api', route: '/api/test' } })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'error') {
        expect(result.payload.data.error_message.length).toBe(1000)
      }
    })
  })

  describe('event type', () => {
    it('rejects invalid event_type', () => {
      const result = validateIngestPayload({ type: 'event', data: { event_type: 'invalid_event' } })
      expect(result.ok).toBe(false)
    })

    it('rejects non-object data', () => {
      const result = validateIngestPayload({ type: 'event', data: 'not-an-object' })
      expect(result.ok).toBe(false)
    })

    it('accepts valid event payload', () => {
      const result = validateIngestPayload({
        type: 'event',
        data: { event_type: 'task_completed', metadata: { taskName: 'Wash dishes' }, duration_ms: 150 },
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'event') {
        expect(result.payload.data.event_type).toBe('task_completed')
        expect(result.payload.data.duration_ms).toBe(150)
      }
    })

    it('floors decimal duration_ms', () => {
      const result = validateIngestPayload({ type: 'event', data: { event_type: 'page_view', duration_ms: 150.9 } })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'event') {
        expect(result.payload.data.duration_ms).toBe(150)
      }
    })

    it('handles missing optional fields', () => {
      const result = validateIngestPayload({ type: 'event', data: { event_type: 'page_view' } })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'event') {
        expect(result.payload.data.duration_ms).toBeUndefined()
      }
    })
  })

  describe('batch type', () => {
    it('rejects non-array items', () => {
      const result = validateIngestPayload({ type: 'batch', items: 'not-an-array' })
      expect(result.ok).toBe(false)
    })

    it('rejects batches exceeding max items', () => {
      const items = Array(21).fill({ type: 'event', data: { event_type: 'page_view' } })
      const result = validateIngestPayload({ type: 'batch', items })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(400)
    })

    it('accepts valid batch', () => {
      const result = validateIngestPayload({
        type: 'batch',
        items: [
          { type: 'event', data: { event_type: 'page_view' } },
          { type: 'error', data: { error_message: 'err', error_type: 'api', route: '/api/test' } },
        ],
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'batch') {
        expect(result.payload.items.length).toBe(2)
      }
    })

    it('parses error items in batch with truncation and metadata', () => {
      const longMsg = 'x'.repeat(2000)
      const result = validateIngestPayload({
        type: 'batch',
        items: [
          { type: 'error', data: { error_message: longMsg, error_type: 'rpc', route: '/api/data', metadata: { route: '/api/data' } } },
        ],
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'batch') {
        expect(result.payload.items.length).toBe(1)
        const item = result.payload.items[0]
        expect(item.type).toBe('error')
        if (item.type === 'error') {
          expect(item.data.error_message.length).toBe(1000)
          expect(item.data.route).toBe('/api/data')
        }
      }
    })

    it('parses event items in batch with duration_ms', () => {
      const result = validateIngestPayload({
        type: 'batch',
        items: [
          { type: 'event', data: { event_type: 'rpc_call', duration_ms: 42.7, metadata: { rpcName: 'get_data' } } },
          { type: 'event', data: { event_type: 'page_view' } },
        ],
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'batch') {
        expect(result.payload.items.length).toBe(2)
        const first = result.payload.items[0]
        if (first.type === 'event') {
          expect(first.data.duration_ms).toBe(42)
          expect(first.data.event_type).toBe('rpc_call')
        }
        const second = result.payload.items[1]
        if (second.type === 'event') {
          expect(second.data.duration_ms).toBeUndefined()
        }
      }
    })

    it('skips invalid items in batch', () => {
      const result = validateIngestPayload({
        type: 'batch',
        items: [
          { type: 'event', data: { event_type: 'invalid_event' } }, // invalid event
          { type: 'event', data: { event_type: 'page_view' } },     // valid
          null,                                                       // null item
        ],
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'batch') {
        expect(result.payload.items.length).toBe(1)
      }
    })

    it('skips invalid error items and unknown types in batch', () => {
      const result = validateIngestPayload({
        type: 'batch',
        items: [
          { type: 'error', data: { error_message: '', error_type: 'api', route: '/test' } }, // empty message — fails validation
          { type: 'other', data: {} },                                                         // unknown type — skipped
          { type: 'event', data: { event_type: 'page_view' } },                               // valid
        ],
      })
      expect(result.ok).toBe(true)
      if (result.ok && result.payload.type === 'batch') {
        expect(result.payload.items.length).toBe(1)
        expect(result.payload.items[0].type).toBe('event')
      }
    })
  })
})

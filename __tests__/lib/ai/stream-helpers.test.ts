/**
 * @jest-environment node
 */
import { consumeSseStream } from '@/lib/ai/stream-helpers'

/** Build a ReadableStream from a list of string chunks */
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('consumeSseStream', () => {
  it('accumulates text_delta events into full content', async () => {
    const chunks = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
    ]
    const tokens: string[] = []
    const result = await consumeSseStream(makeStream(chunks), (t) => tokens.push(t))
    expect(result).toBe('Hello world')
    expect(tokens).toEqual(['Hello', 'Hello world'])
  })

  it('calls onMeta for conversation_meta events', async () => {
    const metaPayload = { conversationId: 'abc-123', title: 'My chat', limitReached: false }
    const chunks = [
      `event: conversation_meta\ndata: ${JSON.stringify(metaPayload)}\n\n`,
    ]
    const metas: Record<string, unknown>[] = []
    await consumeSseStream(makeStream(chunks), () => {}, (m) => metas.push(m))
    expect(metas).toHaveLength(1)
    expect(metas[0]).toMatchObject(metaPayload)
  })

  it('calls onMeta for chat_meta events', async () => {
    const metaPayload = { chatId: 'xyz-456', limitReached: true }
    const chunks = [
      `event: chat_meta\ndata: ${JSON.stringify(metaPayload)}\n\n`,
    ]
    const metas: Record<string, unknown>[] = []
    await consumeSseStream(makeStream(chunks), () => {}, (m) => metas.push(m))
    expect(metas[0]).toMatchObject(metaPayload)
  })

  it('skips non-text-delta Anthropic events', async () => {
    const chunks = [
      'data: {"type":"message_start","message":{"id":"msg_01"}}\n\n',
      'data: {"type":"content_block_start","content_block":{"type":"text","text":""}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ]
    const result = await consumeSseStream(makeStream(chunks), () => {})
    expect(result).toBe('Hi')
  })

  it('handles line-buffered chunks (split across reads)', async () => {
    // Simulate chunk split mid-line
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split the data line into two reads
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type"'))
        controller.enqueue(encoder.encode(':"text_delta","text":"Split"}}\n\n'))
        controller.close()
      },
    })
    const result = await consumeSseStream(stream, () => {})
    expect(result).toBe('Split')
  })

  it('ignores malformed JSON lines gracefully', async () => {
    const chunks = [
      'data: not-json\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}\n\n',
    ]
    const result = await consumeSseStream(makeStream(chunks), () => {})
    expect(result).toBe('OK')
  })

  it('returns empty string for empty stream', async () => {
    const result = await consumeSseStream(makeStream([]), () => {})
    expect(result).toBe('')
  })

  it('skips data lines with empty payload', async () => {
    const chunks = [
      'data:   \n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
    ]
    const result = await consumeSseStream(makeStream(chunks), () => {})
    expect(result).toBe('Hello')
  })

  it('stops reading when AbortSignal is aborted', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    let resolveRead!: () => void
    const readPromise = new Promise<void>(r => { resolveRead = r })

    // Stream that blocks until the resolve
    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        controller.abort()
        await readPromise
        c.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"never"}}\n\n'))
        c.close()
      },
    })

    const resultPromise = consumeSseStream(stream, () => {}, undefined, controller.signal)
    resolveRead()
    const result = await resultPromise
    // Should have stopped before processing the chunk
    expect(result).toBe('')
  })
})

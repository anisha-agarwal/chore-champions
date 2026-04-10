/**
 * Consumes an Anthropic SSE stream with proper line buffering.
 *
 * Calls onToken with the accumulated text after each text_delta event.
 * Calls onMeta when a custom 'conversation_meta' or 'chat_meta' event arrives.
 * Returns the full assistant message text when the stream ends.
 *
 * Supports AbortSignal for cancellation.
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: (accumulated: string) => void,
  onMeta?: (meta: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let nextEventType = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      /* istanbul ignore next */
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          nextEventType = line.slice(7).trim()
          continue
        }
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data) continue

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>

          // Handle custom metadata events sent after the stream body
          if (nextEventType === 'conversation_meta' || nextEventType === 'chat_meta') {
            onMeta?.(parsed)
            nextEventType = ''
            continue
          }
          nextEventType = ''

          // Handle Anthropic streaming text deltas
          if (
            parsed['type'] === 'content_block_delta' &&
            (parsed['delta'] as Record<string, unknown>)?.['type'] === 'text_delta'
          ) {
            fullContent += (parsed['delta'] as Record<string, unknown>)['text'] as string
            onToken(fullContent)
          }
        } catch {
          // Skip malformed lines — non-JSON SSE comments are expected
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}

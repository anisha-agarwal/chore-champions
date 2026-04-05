import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatPanel } from '@/components/chat/chat-panel'
import type { QuickAction } from '@/lib/types'

// Mock consumeSseStream so we don't need real streams in unit tests
jest.mock('@/lib/ai/stream-helpers', () => ({
  consumeSseStream: jest.fn(),
}))

import { consumeSseStream } from '@/lib/ai/stream-helpers'
const mockConsumeSseStream = consumeSseStream as jest.MockedFunction<typeof consumeSseStream>

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn()
})

const QUICK_ACTIONS: QuickAction[] = [
  { label: '💡 Tip', prompt: 'Give me a tip' },
]

function makeOkResponse() {
  return {
    ok: true,
    status: 200,
    // Use a non-null truthy body to pass the null check in ChatPanel.
    // consumeSseStream is fully mocked so the actual stream content doesn't matter.
    body: {} as ReadableStream,
    json: async () => ({}),
  } as unknown as Response
}

function makeErrorResponse(status: number, body: object) {
  return {
    ok: false,
    status,
    body: null,
    json: async () => body,
  } as unknown as Response
}

describe('ChatPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('renders the system name in the header', () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="Parenting Assistant"
        theme="parent"
        quickActions={[]}
      />
    )
    expect(screen.getByText('Parenting Assistant')).toBeInTheDocument()
  })

  it('renders initial empty state with prompt for parent', () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="Parenting Assistant"
        theme="parent"
        quickActions={[]}
      />
    )
    expect(screen.getByText(/Ask me anything/i)).toBeInTheDocument()
  })

  it('renders initial empty state with prompt for kid', () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/quest-buddy"
        systemName="Quest Buddy"
        theme="kid"
        quickActions={[]}
      />
    )
    // Multiple elements may contain "Quest Buddy" (header + empty state text)
    const instances = screen.getAllByText(/Quest Buddy/i)
    expect(instances.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Hi!/i)).toBeInTheDocument()
  })

  it('renders quick action buttons', () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={QUICK_ACTIONS}
      />
    )
    expect(screen.getByText('💡 Tip')).toBeInTheDocument()
  })

  it('clicking a quick action populates the input', async () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={QUICK_ACTIONS}
      />
    )
    await userEvent.click(screen.getByText('💡 Tip'))
    expect(screen.getByRole('textbox', { name: /message input/i })).toHaveValue('Give me a tip')
  })

  it('send button is disabled when input is empty', () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('send button is enabled when input has text', async () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )
    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled()
  })

  it('sends a message and displays the assistant response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockResolvedValueOnce('Great question!')

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    const input = screen.getByRole('textbox', { name: /message input/i })
    await userEvent.type(input, 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Great question!')).toBeInTheDocument()
    })
  })

  it('shows rate limit error on 429 response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeErrorResponse(429, { error: "You've reached your personal message limit for today (20). Try again tomorrow!" })
    )

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/reached your personal message limit/i)).toBeInTheDocument()
    })
    // Optimistic message should be removed
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('shows service unavailable error on 503 response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeErrorResponse(503, { error: 'AI unavailable' })
    )

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    })
  })

  it('dismisses error when X is clicked', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeErrorResponse(503, { error: 'AI unavailable' })
    )

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => screen.getByLabelText('Dismiss error'))
    await userEvent.click(screen.getByLabelText('Dismiss error'))

    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument()
  })

  it('calls onConversationCreated when metadata has a new conversationId', async () => {
    const onCreated = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockImplementationOnce(async (_body, _onToken, onMeta) => {
      onMeta?.({ conversationId: 'new-conv-id' })
      return 'Response text'
    })

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
        onConversationCreated={onCreated}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new-conv-id')
    })
  })

  it('renders initial messages', () => {
    const initialMessages = [
      { role: 'user' as const, content: 'First message', timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: 'First reply', timestamp: new Date().toISOString() },
    ]
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
        initialMessages={initialMessages}
      />
    )
    expect(screen.getByText('First message')).toBeInTheDocument()
    expect(screen.getByText('First reply')).toBeInTheDocument()
  })

  it('shows limitReached banner when meta signals limit reached', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockImplementationOnce(async (_body, _onToken, onMeta) => {
      onMeta?.({ limitReached: true })
      return 'Last response'
    })

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/Start a new conversation/i)).toBeInTheDocument()
    })

    // Input should be disabled
    expect(screen.getByRole('textbox', { name: /message input/i })).toBeDisabled()
  })

  it('uses the message log role for accessibility', () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )
    expect(screen.getByRole('log')).toBeInTheDocument()
  })

  it('shows generic error on non-429/503 response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeErrorResponse(500, { error: 'Server error' })
    )

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    })
  })

  it('shows error when response has no body', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: null,
      json: async () => ({}),
    } as unknown as Response)

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/No response received/i)).toBeInTheDocument()
    })
  })

  it('calls onConversationCreated with chatId from meta', async () => {
    const onCreated = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockImplementationOnce(async (_body, _onToken, onMeta) => {
      onMeta?.({ chatId: 'chat-id-123' })
      return 'Response text'
    })

    render(
      <ChatPanel
        apiEndpoint="/api/ai/quest-buddy"
        systemName="QB"
        theme="kid"
        quickActions={[]}
        onConversationCreated={onCreated}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('chat-id-123')
    })
  })

  it('shows connection error when fetch throws a non-abort error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'))

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/Connection interrupted/i)).toBeInTheDocument()
    })
  })

  it('shows no error when fetch throws an AbortError', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(abortError)

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    // No error banner should appear after an abort
    await waitFor(() => {
      expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument()
    })
  })

  it('submits message on Enter key press', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockResolvedValueOnce('Response!')

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    const input = screen.getByRole('textbox', { name: /message input/i })
    await userEvent.type(input, 'Hello{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Response!')).toBeInTheDocument()
    })
  })

  it('does not submit message on Shift+Enter key press', async () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    const input = screen.getByRole('textbox', { name: /message input/i })
    await userEvent.type(input, 'Hello{Shift>}{Enter}{/Shift}')

    // fetch should NOT have been called
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('displays streaming content via onToken callback', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockImplementationOnce(async (_body, onToken, _onMeta) => {
      onToken('Streaming...')
      return 'Full response'
    })

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText('Full response')).toBeInTheDocument()
    })
  })

  it('shows maxMessages limitReached banner text when maxMessages is set', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockImplementationOnce(async (_body, _onToken, onMeta) => {
      onMeta?.({ limitReached: true })
      return 'Last response'
    })

    render(
      <ChatPanel
        apiEndpoint="/api/ai/quest-buddy"
        systemName="QB"
        theme="kid"
        quickActions={[]}
        maxMessages={20}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/That's all for now/i)).toBeInTheDocument()
    })
  })

  it('does nothing when sendMessage is called with empty/whitespace input', async () => {
    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    const input = screen.getByRole('textbox', { name: /message input/i })
    // Press Enter on empty input — sendMessage('') → trimmed='' → early return
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    // fetch should NOT have been called
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows fallback limit message when 429 body has no error field', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeErrorResponse(429, {}) // empty body — no .error field
    )

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/reached the message limit/i)).toBeInTheDocument()
    })
  })

  it('shows (no response) when consumeSseStream returns empty string', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())
    mockConsumeSseStream.mockResolvedValueOnce('')

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText('(no response)')).toBeInTheDocument()
    })
  })

  it('shows streaming content bubble (not typing indicator) while streaming', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeOkResponse())

    let resolveStream!: (value: string) => void
    mockConsumeSseStream.mockImplementationOnce((_body, onToken, _onMeta) => {
      // Emit a token so streamingContent becomes truthy
      onToken('Streaming...')
      // Return a promise that we control
      return new Promise<string>((resolve) => {
        resolveStream = resolve
      })
    })

    render(
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="PA"
        theme="parent"
        quickActions={[]}
      />
    )

    await userEvent.type(screen.getByRole('textbox', { name: /message input/i }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    // While streaming, the streaming content <p> should be visible
    await waitFor(() => {
      expect(screen.getByText('Streaming...')).toBeInTheDocument()
    })

    // Resolve the stream so the component can finish
    resolveStream('Full response')

    await waitFor(() => {
      expect(screen.getByText('Full response')).toBeInTheDocument()
    })
  })
})

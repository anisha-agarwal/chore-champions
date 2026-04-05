import { render, screen } from '@testing-library/react'
import { ChatMessageBubble } from '@/components/chat/chat-message'
import type { ChatMessage } from '@/lib/types'

const userMsg: ChatMessage = {
  role: 'user',
  content: 'Hello there',
  timestamp: '2024-01-01T10:00:00.000Z',
}

const assistantMsg: ChatMessage = {
  role: 'assistant',
  content: 'Hi! How can I help?',
  timestamp: '2024-01-01T10:00:05.000Z',
}

describe('ChatMessageBubble', () => {
  it('renders user message content', () => {
    render(<ChatMessageBubble message={userMsg} theme="parent" />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(<ChatMessageBubble message={assistantMsg} theme="parent" />)
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
  })

  it('user message aligns to the right', () => {
    const { container } = render(<ChatMessageBubble message={userMsg} theme="parent" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('justify-end')
  })

  it('assistant message aligns to the left', () => {
    const { container } = render(<ChatMessageBubble message={assistantMsg} theme="parent" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('justify-start')
  })

  it('parent theme uses purple for assistant', () => {
    const { container } = render(<ChatMessageBubble message={assistantMsg} theme="parent" />)
    const bubble = container.querySelector('.bg-purple-100')
    expect(bubble).toBeInTheDocument()
  })

  it('kid theme uses green for assistant', () => {
    const { container } = render(<ChatMessageBubble message={assistantMsg} theme="kid" />)
    const bubble = container.querySelector('.bg-green-100')
    expect(bubble).toBeInTheDocument()
  })

  it('hides timestamp when isStreaming is true', () => {
    render(<ChatMessageBubble message={assistantMsg} theme="parent" isStreaming />)
    expect(screen.queryByRole('time')).not.toBeInTheDocument()
  })

  it('shows timestamp when not streaming', () => {
    render(<ChatMessageBubble message={assistantMsg} theme="parent" />)
    expect(screen.getByRole('time')).toBeInTheDocument()
  })
})

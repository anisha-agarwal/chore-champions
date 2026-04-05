import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationList } from '@/components/chat/conversation-list'
import type { ConversationSummary } from '@/components/chat/conversation-list'

const CONVERSATIONS: ConversationSummary[] = [
  { id: 'conv-1', title: 'Chat about chores', updatedAt: '2024-01-15T10:00:00Z', messageCount: 5 },
  { id: 'conv-2', title: null, updatedAt: '2024-01-14T10:00:00Z', messageCount: 1 },
]

describe('ConversationList', () => {
  it('shows loading skeletons when loading=true', () => {
    const { container } = render(
      <ConversationList conversations={[]} activeId={null} onSelect={jest.fn()} loading />
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no conversations', () => {
    render(<ConversationList conversations={[]} activeId={null} onSelect={jest.fn()} />)
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument()
  })

  it('renders list of conversations', () => {
    render(<ConversationList conversations={CONVERSATIONS} activeId={null} onSelect={jest.fn()} />)
    expect(screen.getByText('Chat about chores')).toBeInTheDocument()
    expect(screen.getByText('New conversation')).toBeInTheDocument()
  })

  it('shows singular "message" for messageCount of 1', () => {
    render(<ConversationList conversations={[CONVERSATIONS[1]]} activeId={null} onSelect={jest.fn()} />)
    expect(screen.getByText(/\b1 message\b/)).toBeInTheDocument()
    expect(screen.queryByText(/1 messages/)).not.toBeInTheDocument()
  })

  it('shows plural "messages" for messageCount > 1', () => {
    render(<ConversationList conversations={[CONVERSATIONS[0]]} activeId={null} onSelect={jest.fn()} />)
    expect(screen.getByText(/5 messages/)).toBeInTheDocument()
  })

  it('marks the active conversation with aria-selected=true', () => {
    render(<ConversationList conversations={CONVERSATIONS} activeId="conv-1" onSelect={jest.fn()} />)
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onSelect with conversation id when clicked', async () => {
    const onSelect = jest.fn()
    render(<ConversationList conversations={CONVERSATIONS} activeId={null} onSelect={onSelect} />)
    await userEvent.click(screen.getAllByRole('option')[0])
    expect(onSelect).toHaveBeenCalledWith('conv-1')
  })

  it('renders within a listbox element', () => {
    render(<ConversationList conversations={CONVERSATIONS} activeId={null} onSelect={jest.fn()} />)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})

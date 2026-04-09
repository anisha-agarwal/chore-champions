import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatFab } from '@/components/chat/chat-fab'

// Mock ChatPanel to avoid pulling in all its dependencies
jest.mock('@/components/chat/chat-panel', () => ({
  ChatPanel: (props: { systemName: string }) => (
    <div data-testid="chat-panel">{props.systemName}</div>
  ),
}))

describe('ChatFab', () => {
  it('renders the FAB button', () => {
    render(<ChatFab role="parent" />)
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument()
  })

  it('does not show chat window initially', () => {
    render(<ChatFab role="parent" />)
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('opens chat window when FAB is clicked', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('shows Parenting Assistant for parent role', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(screen.getByText('Parenting Assistant')).toBeInTheDocument()
  })

  it('shows Quest Buddy for child role', async () => {
    render(<ChatFab role="child" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(screen.getByText('Quest Buddy')).toBeInTheDocument()
  })

  it('closes chat window when close button in header is clicked', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    // First "Close chat" button is the header X
    const closeButtons = screen.getAllByRole('button', { name: 'Close chat' })
    await userEvent.click(closeButtons[0])
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('toggles chat window when FAB is clicked again', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    // Both the header X and FAB show "Close chat" — click the FAB (last one)
    const closeButtons = screen.getAllByRole('button', { name: 'Close chat' })
    await userEvent.click(closeButtons[closeButtons.length - 1])
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('shows backdrop on mobile when open', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    // Backdrop has sm:hidden class
    const backdrop = document.querySelector('.bg-black\\/30')
    expect(backdrop).toBeInTheDocument()
  })

  it('closes when backdrop is clicked', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    const backdrop = document.querySelector('.bg-black\\/30') as HTMLElement
    await userEvent.click(backdrop)
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('applies purple style for parent FAB', () => {
    render(<ChatFab role="parent" />)
    const fab = screen.getByRole('button', { name: 'Open chat' })
    expect(fab).toHaveClass('bg-purple-600')
  })

  it('applies gradient style for child FAB', () => {
    render(<ChatFab role="child" />)
    const fab = screen.getByRole('button', { name: 'Open chat' })
    expect(fab).toHaveClass('bg-gradient-to-br')
  })

  it('adds chat-open class to body when chat opens', async () => {
    render(<ChatFab role="parent" />)
    expect(document.body.classList.contains('chat-open')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(document.body.classList.contains('chat-open')).toBe(true)
  })

  it('removes chat-open class from body when chat closes', async () => {
    render(<ChatFab role="parent" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(document.body.classList.contains('chat-open')).toBe(true)
    const closeButtons = screen.getAllByRole('button', { name: 'Close chat' })
    await userEvent.click(closeButtons[0])
    expect(document.body.classList.contains('chat-open')).toBe(false)
  })

  it('removes chat-open class on unmount', () => {
    const { unmount } = render(<ChatFab role="parent" />)
    document.body.classList.add('chat-open')
    unmount()
    expect(document.body.classList.contains('chat-open')).toBe(false)
  })
})

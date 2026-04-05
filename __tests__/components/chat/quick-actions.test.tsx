import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActions } from '@/components/chat/quick-actions'
import type { QuickAction } from '@/lib/types'

const actions: QuickAction[] = [
  { label: '💡 Suggest quests', prompt: 'Suggest some quests' },
  { label: '📊 Weekly report', prompt: 'Give me a report' },
]

describe('QuickActions', () => {
  it('renders all action buttons', () => {
    render(<QuickActions actions={actions} onSelect={jest.fn()} />)
    expect(screen.getByText('💡 Suggest quests')).toBeInTheDocument()
    expect(screen.getByText('📊 Weekly report')).toBeInTheDocument()
  })

  it('calls onSelect with the prompt when clicked', async () => {
    const handleSelect = jest.fn()
    render(<QuickActions actions={actions} onSelect={handleSelect} />)
    await userEvent.click(screen.getByText('💡 Suggest quests'))
    expect(handleSelect).toHaveBeenCalledWith('Suggest some quests')
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<QuickActions actions={actions} onSelect={jest.fn()} disabled />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => expect(btn).toBeDisabled())
  })

  it('renders with accessible group label', () => {
    render(<QuickActions actions={actions} onSelect={jest.fn()} />)
    expect(screen.getByRole('group', { name: 'Quick actions' })).toBeInTheDocument()
  })

  it('renders nothing extra for empty actions array', () => {
    const { container } = render(<QuickActions actions={[]} onSelect={jest.fn()} />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})

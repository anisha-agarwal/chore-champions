import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard } from '@/components/tasks/task-card'
import type { TaskWithAssignee } from '@/lib/types'

const mockTask: TaskWithAssignee = {
  id: 'task-1',
  family_id: 'family-1',
  title: 'Clean your room',
  description: 'Make bed and pick up toys',
  assigned_to: 'user-1',
  points: 10,
  time_of_day: 'morning',
  recurring: null,
  due_date: '2024-01-15',
  completed: false,
  created_by: 'user-2',
  created_at: '2024-01-01T00:00:00Z',
  profiles: {
    id: 'user-1',
    display_name: 'Timmy',
    avatar_url: null,
    nickname: 'Little T',
  },
}

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} />)
    expect(screen.getByText('Clean your room')).toBeInTheDocument()
  })

  it('renders task description', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} />)
    expect(screen.getByText('Make bed and pick up toys')).toBeInTheDocument()
  })

  it('renders points', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} />)
    expect(screen.getByText('10 pts')).toBeInTheDocument()
  })

  it('renders time of day badge', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} />)
    expect(screen.getByText('Morning')).toBeInTheDocument()
  })

  it('renders recurring badge when task is recurring', () => {
    const recurringTask = { ...mockTask, recurring: 'daily' as const }
    render(<TaskCard task={recurringTask} onComplete={jest.fn()} />)
    expect(screen.getByText('Daily')).toBeInTheDocument()
  })

  it('does not render recurring badge for one-time tasks', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} />)
    expect(screen.queryByText('Daily')).not.toBeInTheDocument()
    expect(screen.queryByText('Weekly')).not.toBeInTheDocument()
  })

  it('calls onComplete when checkbox clicked', async () => {
    const handleComplete = jest.fn()
    render(<TaskCard task={mockTask} onComplete={handleComplete} />)

    const checkbox = screen.getByRole('button')
    await userEvent.click(checkbox)

    expect(handleComplete).toHaveBeenCalledWith('task-1')
  })

  it('shows completed state', () => {
    const completedTask = { ...mockTask, completed: true }
    render(<TaskCard task={completedTask} onComplete={jest.fn()} />)

    expect(screen.getByText('Clean your room')).toHaveClass('line-through')
  })

  it('disables checkbox when already completed', async () => {
    const completedTask = { ...mockTask, completed: true }
    const handleComplete = jest.fn()
    render(<TaskCard task={completedTask} onComplete={handleComplete} />)

    const checkbox = screen.getByRole('button')
    await userEvent.click(checkbox)

    expect(handleComplete).not.toHaveBeenCalled()
  })
})

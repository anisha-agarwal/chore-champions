import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard } from '@/components/tasks/task-card'
import type { Profile, TaskWithAssignee } from '@/lib/types'

const mockParentUser: Profile = {
  id: 'parent-1',
  family_id: 'family-1',
  display_name: 'Parent',
  avatar_url: null,
  nickname: null,
  role: 'parent',
  points: 0,
  created_at: '2024-01-01T00:00:00Z',
}

const mockChildUser: Profile = {
  id: 'child-1',
  family_id: 'family-1',
  display_name: 'Child',
  avatar_url: null,
  nickname: null,
  role: 'child',
  points: 0,
  created_at: '2024-01-01T00:00:00Z',
}

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
    render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)
    expect(screen.getByText('Clean your room')).toBeInTheDocument()
  })

  it('renders task description', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)
    expect(screen.getByText('Make bed and pick up toys')).toBeInTheDocument()
  })

  it('renders points', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)
    expect(screen.getByText('10 pts')).toBeInTheDocument()
  })

  it('renders time of day badge', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)
    expect(screen.getByText('Morning')).toBeInTheDocument()
  })

  it('renders recurring badge when task is recurring', () => {
    const recurringTask = { ...mockTask, recurring: 'daily' as const }
    render(<TaskCard task={recurringTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)
    expect(screen.getByText('Daily')).toBeInTheDocument()
  })

  it('does not render recurring badge for one-time tasks', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)
    expect(screen.queryByText('Daily')).not.toBeInTheDocument()
    expect(screen.queryByText('Weekly')).not.toBeInTheDocument()
  })

  it('calls onComplete when checkbox clicked on incomplete task', async () => {
    const handleComplete = jest.fn()
    render(<TaskCard task={mockTask} onComplete={handleComplete} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

    const buttons = screen.getAllByRole('button')
    // First button is the complete checkbox
    await userEvent.click(buttons[0])

    expect(handleComplete).toHaveBeenCalledWith('task-1')
  })

  it('shows completed state', () => {
    const completedTask = { ...mockTask, completed: true }
    render(<TaskCard task={completedTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

    expect(screen.getByText('Clean your room')).toHaveClass('line-through')
  })

  it('calls onUncomplete when clicking completed checkbox', async () => {
    const completedTask = { ...mockTask, completed: true }
    const handleComplete = jest.fn()
    const handleUncomplete = jest.fn()
    render(<TaskCard task={completedTask} onComplete={handleComplete} onUncomplete={handleUncomplete} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

    // First button is the checkbox
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])

    expect(handleComplete).not.toHaveBeenCalled()
    expect(handleUncomplete).toHaveBeenCalledWith('task-1')
  })

  it('shows "Click to undo" title on completed checkbox', () => {
    const completedTask = { ...mockTask, completed: true }
    render(<TaskCard task={completedTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

    const buttons = screen.getAllByRole('button')
    // First button is the checkbox
    expect(buttons[0]).toHaveAttribute('title', 'Click to undo')
  })

  it('does not show undo title on incomplete checkbox', () => {
    render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).not.toHaveAttribute('title')
  })

  describe('Delete Button', () => {
    it('renders delete button for incomplete tasks', () => {
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const deleteButton = screen.getByTitle('Delete quest')
      expect(deleteButton).toBeInTheDocument()
    })

    it('renders delete button for completed tasks', () => {
      const completedTask = { ...mockTask, completed: true }
      render(<TaskCard task={completedTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const deleteButton = screen.getByTitle('Delete quest')
      expect(deleteButton).toBeInTheDocument()
    })

    it('calls onDelete with task when delete button is clicked', async () => {
      const handleDelete = jest.fn()
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={handleDelete} currentUser={mockParentUser} />)

      const deleteButton = screen.getByTitle('Delete quest')
      await userEvent.click(deleteButton)

      expect(handleDelete).toHaveBeenCalledWith(mockTask)
    })

    it('has correct hover styles for delete button', () => {
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const deleteButton = screen.getByTitle('Delete quest')
      expect(deleteButton).toHaveClass('hover:text-red-600')
      expect(deleteButton).toHaveClass('hover:bg-red-50')
    })

    it('hides delete button for child who did not create the task', () => {
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockChildUser} />)

      expect(screen.queryByTitle('Delete quest')).not.toBeInTheDocument()
    })

    it('shows delete button for child who created the task', () => {
      const taskCreatedByChild = { ...mockTask, created_by: 'child-1' }
      render(<TaskCard task={taskCreatedByChild} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockChildUser} />)

      expect(screen.getByTitle('Delete quest')).toBeInTheDocument()
    })
  })

  describe('Assignee Tooltip', () => {
    it('shows nickname as tooltip when assignee has nickname', () => {
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      // mockTask has profiles.nickname = 'Little T'
      const avatar = screen.getByTitle('Little T')
      expect(avatar).toBeInTheDocument()
    })

    it('shows display_name as tooltip when assignee has no nickname', () => {
      const taskWithoutNickname: TaskWithAssignee = {
        ...mockTask,
        profiles: {
          id: 'user-1',
          display_name: 'Timmy',
          avatar_url: null,
          nickname: null,
        },
      }
      render(<TaskCard task={taskWithoutNickname} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const avatar = screen.getByTitle('Timmy')
      expect(avatar).toBeInTheDocument()
    })

    it('does not render avatar or tooltip when task has no assignee profile', () => {
      const taskWithoutProfile: TaskWithAssignee = {
        ...mockTask,
        profiles: null,
      }
      render(<TaskCard task={taskWithoutProfile} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      // No avatar title should exist - check that neither nickname nor display_name appear as titles
      expect(screen.queryByTitle('Little T')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Timmy')).not.toBeInTheDocument()
    })
  })

  describe('Edit Button', () => {
    it('renders edit button for incomplete tasks', () => {
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const editButton = screen.getByTitle('Edit quest')
      expect(editButton).toBeInTheDocument()
    })

    it('calls onEdit with task when edit button is clicked', async () => {
      const handleEdit = jest.fn()
      render(<TaskCard task={mockTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={handleEdit} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const editButton = screen.getByTitle('Edit quest')
      await userEvent.click(editButton)

      expect(handleEdit).toHaveBeenCalledWith(mockTask)
    })

    it('hides edit button when task is completed', () => {
      const completedTask = { ...mockTask, completed: true }
      render(<TaskCard task={completedTask} onComplete={jest.fn()} onUncomplete={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />)

      expect(screen.queryByTitle('Edit quest')).not.toBeInTheDocument()
    })

    it('shows edit button again after uncompleting', async () => {
      const completedTask = { ...mockTask, completed: true }
      const handleUncomplete = jest.fn()
      const { rerender } = render(
        <TaskCard task={completedTask} onComplete={jest.fn()} onUncomplete={handleUncomplete} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />
      )

      // Initially, edit button is hidden
      expect(screen.queryByTitle('Edit quest')).not.toBeInTheDocument()

      // Simulate uncomplete - update the task prop
      const uncompletedTask = { ...mockTask, completed: false }
      rerender(
        <TaskCard task={uncompletedTask} onComplete={jest.fn()} onUncomplete={handleUncomplete} onEdit={jest.fn()} onDelete={jest.fn()} currentUser={mockParentUser} />
      )

      // Edit button should reappear
      expect(screen.getByTitle('Edit quest')).toBeInTheDocument()
    })

    it('does not call onComplete when edit button is clicked', async () => {
      const handleComplete = jest.fn()
      const handleEdit = jest.fn()
      render(<TaskCard task={mockTask} onComplete={handleComplete} onUncomplete={jest.fn()} onEdit={handleEdit} onDelete={jest.fn()} currentUser={mockParentUser} />)

      const editButton = screen.getByTitle('Edit quest')
      await userEvent.click(editButton)

      expect(handleComplete).not.toHaveBeenCalled()
      expect(handleEdit).toHaveBeenCalled()
    })
  })
})

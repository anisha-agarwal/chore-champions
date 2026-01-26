import { render, screen } from '@testing-library/react'
import { TaskList } from '@/components/tasks/task-list'
import type { TaskWithAssignee } from '@/lib/types'

const mockTasks: TaskWithAssignee[] = [
  {
    id: 'task-1',
    family_id: 'family-1',
    title: 'Clean room',
    description: null,
    assigned_to: null,
    points: 10,
    time_of_day: 'morning',
    recurring: null,
    due_date: '2024-01-15',
    completed: false,
    created_by: null,
    created_at: '2024-01-01T00:00:00Z',
    profiles: null,
  },
  {
    id: 'task-2',
    family_id: 'family-1',
    title: 'Do homework',
    description: null,
    assigned_to: null,
    points: 15,
    time_of_day: 'afternoon',
    recurring: null,
    due_date: '2024-01-15',
    completed: false,
    created_by: null,
    created_at: '2024-01-01T00:00:00Z',
    profiles: null,
  },
]

describe('TaskList', () => {
  it('renders all tasks', () => {
    render(<TaskList tasks={mockTasks} onComplete={jest.fn()} />)

    expect(screen.getByText('Clean room')).toBeInTheDocument()
    expect(screen.getByText('Do homework')).toBeInTheDocument()
  })

  it('shows empty message when no tasks', () => {
    render(<TaskList tasks={[]} onComplete={jest.fn()} />)

    expect(screen.getByText('No quests found')).toBeInTheDocument()
  })

  it('shows custom empty message', () => {
    render(
      <TaskList
        tasks={[]}
        onComplete={jest.fn()}
        emptyMessage="No tasks for today!"
      />
    )

    expect(screen.getByText('No tasks for today!')).toBeInTheDocument()
  })

  it('renders correct number of task cards', () => {
    render(<TaskList tasks={mockTasks} onComplete={jest.fn()} />)

    const taskTitles = screen.getAllByRole('button')
    expect(taskTitles).toHaveLength(2)
  })
})

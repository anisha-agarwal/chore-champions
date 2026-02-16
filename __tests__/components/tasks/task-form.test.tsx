import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskForm } from '@/components/tasks/task-form'
import type { TaskWithAssignee, Profile } from '@/lib/types'

const mockFamilyMembers: Profile[] = [
  {
    id: 'user-1',
    display_name: 'Timmy',
    nickname: 'Little T',
    avatar_url: null,
    role: 'child',
    family_id: 'family-1',
    points: 100,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    display_name: 'Parent',
    nickname: null,
    avatar_url: null,
    role: 'parent',
    family_id: 'family-1',
    points: 0,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockTask: TaskWithAssignee = {
  id: 'task-1',
  family_id: 'family-1',
  title: 'Clean your room',
  description: 'Make bed and pick up toys',
  assigned_to: 'user-1',
  points: 20,
  time_of_day: 'morning',
  recurring: 'daily',
  due_date: '2024-01-15',
  due_time: null,
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

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(undefined),
  familyMembers: mockFamilyMembers,
  selectedDate: new Date('2024-01-15'),
}

describe('TaskForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Create Mode', () => {
    it('renders with "New Quest" title', () => {
      render(<TaskForm {...defaultProps} />)
      expect(screen.getByText('New Quest')).toBeInTheDocument()
    })

    it('renders with "Create Quest" button', () => {
      render(<TaskForm {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Create Quest' })).toBeInTheDocument()
    })

    it('starts with empty form fields', () => {
      render(<TaskForm {...defaultProps} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      expect(titleInput).toHaveValue('')

      const descriptionInput = screen.getByPlaceholderText('Optional details...')
      expect(descriptionInput).toHaveValue('')
    })

    it('calls onSubmit without taskId when creating', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'New Task' }),
          undefined
        )
      })
    })

    it('shows "Creating..." while submitting', async () => {
      const handleSubmit = jest.fn().mockImplementation(() => new Promise(() => {}))
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument()
    })

    it('shows error message on create failure', async () => {
      const handleSubmit = jest.fn().mockRejectedValue(new Error('Network error'))
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode', () => {
    it('renders with "Edit Quest" title', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)
      expect(screen.getByText('Edit Quest')).toBeInTheDocument()
    })

    it('renders with "Save Changes" button', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    })

    it('pre-populates form with task data', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      expect(titleInput).toHaveValue('Clean your room')

      const descriptionInput = screen.getByPlaceholderText('Optional details...')
      expect(descriptionInput).toHaveValue('Make bed and pick up toys')
    })

    it('pre-populates points select', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)

      const pointsSelect = screen.getByDisplayValue('20 points')
      expect(pointsSelect).toBeInTheDocument()
    })

    it('pre-populates time of day select', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)

      const timeSelect = screen.getByDisplayValue('Morning')
      expect(timeSelect).toBeInTheDocument()
    })

    it('pre-populates recurring select', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)

      const recurringSelect = screen.getByDisplayValue('Daily')
      expect(recurringSelect).toBeInTheDocument()
    })

    it('calls onSubmit with taskId when editing', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      const submitButton = screen.getByRole('button', { name: 'Save Changes' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Clean your room' }),
          'task-1'
        )
      })
    })

    it('shows "Saving..." while submitting', async () => {
      const handleSubmit = jest.fn().mockImplementation(() => new Promise(() => {}))
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      const submitButton = screen.getByRole('button', { name: 'Save Changes' })
      await userEvent.click(submitButton)

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument()
    })

    it('shows error message on update failure', async () => {
      const handleSubmit = jest.fn().mockRejectedValue(new Error('Update failed'))
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      const submitButton = screen.getByRole('button', { name: 'Save Changes' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument()
      })
    })

    it('allows editing fields', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Task Title')

      const submitButton = screen.getByRole('button', { name: 'Save Changes' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Updated Task Title' }),
          'task-1'
        )
      })
    })
  })

  describe('Due Time', () => {
    it('renders due time input', () => {
      render(<TaskForm {...defaultProps} />)
      expect(screen.getByLabelText('Due Time (optional)')).toBeInTheDocument()
    })

    it('submits null due_time when not set', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ due_time: null }),
          undefined
        )
      })
    })

    it('submits due_time when set', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const timeInput = screen.getByLabelText('Due Time (optional)')
      // fireEvent is needed for time inputs since userEvent doesn't handle them well
      const { fireEvent } = await import('@testing-library/react')
      fireEvent.change(timeInput, { target: { value: '14:30' } })

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ due_time: '14:30:00' }),
          undefined
        )
      })
    })

    it('pre-populates due time in edit mode', () => {
      const taskWithTime = { ...mockTask, due_time: '14:30:00' }
      render(<TaskForm {...defaultProps} task={taskWithTime} />)

      const timeInput = screen.getByLabelText('Due Time (optional)') as HTMLInputElement
      expect(timeInput.value).toBe('14:30')
    })

    it('pre-populates empty due time in edit mode when null', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)

      const timeInput = screen.getByLabelText('Due Time (optional)') as HTMLInputElement
      expect(timeInput.value).toBe('')
    })
  })

  describe('Common Behavior', () => {
    it('does not render when isOpen is false', () => {
      render(<TaskForm {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('New Quest')).not.toBeInTheDocument()
    })

    it('calls onClose when Cancel button is clicked', async () => {
      const handleClose = jest.fn()
      render(<TaskForm {...defaultProps} onClose={handleClose} />)

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await userEvent.click(cancelButton)

      expect(handleClose).toHaveBeenCalled()
    })

    it('disables submit button when title is empty', () => {
      render(<TaskForm {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when title has value', async () => {
      render(<TaskForm {...defaultProps} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'A task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      expect(submitButton).not.toBeDisabled()
    })

    it('renders family members in assign dropdown', () => {
      render(<TaskForm {...defaultProps} />)

      expect(screen.getByRole('option', { name: 'Anyone' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Little T' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Parent' })).toBeInTheDocument()
    })
  })
})

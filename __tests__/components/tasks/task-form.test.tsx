import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskForm } from '@/components/tasks/task-form'
import type { TaskWithAssignee, Profile } from '@/lib/types'

// Store original fetch
const originalFetch = global.fetch

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

  afterEach(() => {
    global.fetch = originalFetch
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

  describe('Edit Mode - Additional', () => {
    it('pre-populates due_time with seconds format (.slice(0,5))', () => {
      const taskWithSeconds = { ...mockTask, due_time: '09:30:45' }
      render(<TaskForm {...defaultProps} task={taskWithSeconds} />)

      const timeInput = screen.getByLabelText('Due Time (optional)') as HTMLInputElement
      expect(timeInput.value).toBe('09:30')
    })

    it('shows fallback error message on non-Error rejection in edit mode', async () => {
      const handleSubmit = jest.fn().mockRejectedValue('string error')
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      const submitButton = screen.getByRole('button', { name: 'Save Changes' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to update task')).toBeInTheDocument()
      })
    })

    it('shows fallback error message on non-Error rejection in create mode', async () => {
      const handleSubmit = jest.fn().mockRejectedValue('string error')
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to create task')).toBeInTheDocument()
      })
    })
  })

  describe('Form Reset', () => {
    it('resets form after successful create', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      const handleClose = jest.fn()
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} onClose={handleClose} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'New Task')

      const submitButton = screen.getByRole('button', { name: 'Create Quest' })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled()
      })
    })
  })

  describe('Dropdown interactions', () => {
    it('changes Assign To dropdown to a specific member', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'Assigned Task')

      // Change Assign To dropdown (it defaults to "Anyone")
      const assignSelect = screen.getByDisplayValue('Anyone')
      await userEvent.selectOptions(assignSelect, 'user-1')

      await userEvent.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ assigned_to: 'user-1' }),
          undefined
        )
      })
    })

    it('changes Repeat dropdown to Daily', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'Recurring Task')

      // Change Repeat dropdown
      const repeatSelect = screen.getByDisplayValue('One time only')
      await userEvent.selectOptions(repeatSelect, 'daily')

      await userEvent.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ recurring: 'daily' }),
          undefined
        )
      })
    })
  })

  describe('Description textarea onChange (line 129)', () => {
    it('triggers description onChange by typing', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'Task With Desc')

      const descInput = screen.getByPlaceholderText('Optional details...')
      await userEvent.type(descInput, 'Some description')

      await userEvent.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Some description' }),
          undefined
        )
      })
    })
  })

  describe('Select Dropdowns Rendering (lines 129-161)', () => {
    it('renders Points dropdown with all options', () => {
      render(<TaskForm {...defaultProps} />)

      const pointsSelect = screen.getByDisplayValue('10 points')
      expect(pointsSelect).toBeInTheDocument()

      expect(screen.getByRole('option', { name: '5 points' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '10 points' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '15 points' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '20 points' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '25 points' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '50 points' })).toBeInTheDocument()
    })

    it('renders Time of Day dropdown with all options', () => {
      render(<TaskForm {...defaultProps} />)

      expect(screen.getByRole('option', { name: 'Anytime' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Morning' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Afternoon' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Night' })).toBeInTheDocument()
    })

    it('renders Repeat dropdown with all options', () => {
      render(<TaskForm {...defaultProps} />)

      expect(screen.getByRole('option', { name: 'One time only' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Daily' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument()
    })

    it('changes Points dropdown value', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'Points Task')

      // Change Points dropdown
      const pointsSelect = screen.getByDisplayValue('10 points')
      await userEvent.selectOptions(pointsSelect, '25')

      await userEvent.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ points: 25 }),
          undefined
        )
      })
    })

    it('changes Time of Day dropdown value', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'Time Task')

      // Change Time of Day dropdown
      const timeSelect = screen.getByDisplayValue('Anytime')
      await userEvent.selectOptions(timeSelect, 'night')

      await userEvent.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ time_of_day: 'night' }),
          undefined
        )
      })
    })

    it('changes Repeat dropdown to Weekly', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const titleInput = screen.getByPlaceholderText('e.g., Clean your room')
      await userEvent.type(titleInput, 'Weekly Task')

      const repeatSelect = screen.getByDisplayValue('One time only')
      await userEvent.selectOptions(repeatSelect, 'weekly')

      await userEvent.click(screen.getByRole('button', { name: 'Create Quest' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ recurring: 'weekly' }),
          undefined
        )
      })
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

  describe('Edit mode with null description (line 44 falsy branch)', () => {
    it('pre-populates description as empty string when task.description is null', () => {
      const taskNullDesc = { ...mockTask, description: null }
      render(<TaskForm {...defaultProps} task={taskNullDesc} />)

      const descInput = screen.getByPlaceholderText('Optional details...')
      expect(descInput).toHaveValue('')
    })
  })

  describe('Empty title guard (line 65)', () => {
    it('does not call onSubmit when title is empty (programmatic form submit)', async () => {
      const { fireEvent: fe } = await import('@testing-library/react')
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      // Programmatically submit form to bypass disabled button
      const form = document.querySelector('form')!
      fe.submit(form)

      // handleSubmit should not be called because title.trim() is empty
      expect(handleSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Resetting dropdowns to empty (|| null branches)', () => {
    it('changes Assign To back to Anyone (line 179 empty value → null)', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      // assignedTo starts as 'user-1' from mockTask, change to empty
      const assignSelect = screen.getByDisplayValue('Little T')
      await userEvent.selectOptions(assignSelect, '')

      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ assigned_to: null }),
          'task-1'
        )
      })
    })

    it('clears due time input (line 199 empty value → null)', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      const taskWithTime = { ...mockTask, due_time: '14:30:00' }
      render(<TaskForm {...defaultProps} task={taskWithTime} onSubmit={handleSubmit} />)

      // Clear the due time input
      const timeInput = screen.getByLabelText('Due Time (optional)')
      fireEvent.change(timeInput, { target: { value: '' } })

      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ due_time: null }),
          'task-1'
        )
      })
    })

    it('changes Repeat back to One time only (line 210 empty value → null)', async () => {
      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} task={mockTask} onSubmit={handleSubmit} />)

      // recurring starts as 'daily' from mockTask, change to empty
      const repeatSelect = screen.getByDisplayValue('Daily')
      await userEvent.selectOptions(repeatSelect, '')

      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ recurring: null }),
          'task-1'
        )
      })
    })
  })

  describe('Natural Language Input', () => {
    it('is not rendered in edit mode', () => {
      render(<TaskForm {...defaultProps} task={mockTask} />)
      expect(screen.queryByTestId('nl-input-section')).not.toBeInTheDocument()
    })

    it('is rendered in create mode', () => {
      render(<TaskForm {...defaultProps} />)
      expect(screen.getByTestId('nl-input-section')).toBeInTheDocument()
      expect(screen.getByLabelText('Describe the quest')).toBeInTheDocument()
    })

    it('has Fill button disabled when input is empty', () => {
      render(<TaskForm {...defaultProps} />)
      const fillButton = screen.getByRole('button', { name: 'Fill' })
      expect(fillButton).toBeDisabled()
    })

    it('enables Fill button when input has text', async () => {
      render(<TaskForm {...defaultProps} />)
      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Make bed for Sarah')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      expect(fillButton).not.toBeDisabled()
    })

    it('calls fetch on Fill button click and pre-fills form', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          prefill: {
            title: 'Make bed',
            description: 'Make the bed every morning',
            points: 5,
            time_of_day: 'morning',
            recurring: 'daily',
            assigned_to: 'user-1',
          },
        }),
      })

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Daily quest for Sarah to make her bed')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/parse-quest', expect.objectContaining({
          method: 'POST',
        }))
      })

      await waitFor(() => {
        // Check form was pre-filled
        expect(screen.getByPlaceholderText('e.g., Clean your room')).toHaveValue('Make bed')
        expect(screen.getByPlaceholderText('Optional details...')).toHaveValue('Make the bed every morning')
        expect(screen.getByDisplayValue('5 points')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Morning')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Daily')).toBeInTheDocument()
      })
    })

    it('calls fetch on Enter key press', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          prefill: {
            title: 'Test quest',
            description: '',
            points: 10,
            time_of_day: 'anytime',
            recurring: null,
            assigned_to: null,
          },
        }),
      })

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Test quest')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/parse-quest', expect.any(Object))
      })
    })

    it('shows error when prefill is null', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ prefill: null }),
      })

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Something')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      await waitFor(() => {
        expect(screen.getByText('Could not parse quest. Please fill the form manually.')).toBeInTheDocument()
      })
    })

    it('shows error when fetch fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Something')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      await waitFor(() => {
        expect(screen.getByText('Could not parse quest. Please fill the form manually.')).toBeInTheDocument()
      })
    })

    it('shows error when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Something')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      await waitFor(() => {
        expect(screen.getByText('Could not parse quest. Please fill the form manually.')).toBeInTheDocument()
      })
    })

    it('shows confirmation hint after successful pre-fill', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          prefill: {
            title: 'Test',
            description: '',
            points: 10,
            time_of_day: 'anytime',
            recurring: null,
            assigned_to: null,
          },
        }),
      })

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Test quest')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      await waitFor(() => {
        expect(screen.getByText('Form pre-filled! Review and submit below.')).toBeInTheDocument()
      })
    })

    it('shows "Parsing..." text while loading', async () => {
      global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}))

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Test quest')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      expect(screen.getByRole('button', { name: 'Parsing...' })).toBeInTheDocument()
    })

    it('disables NL input while loading', async () => {
      global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}))

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Test quest')

      const fillButton = screen.getByRole('button', { name: 'Fill' })
      await userEvent.click(fillButton)

      expect(nlInput).toBeDisabled()
    })

    it('resets NL state when switching from create to edit mode', () => {
      const { rerender } = render(<TaskForm {...defaultProps} />)

      // NL section should be visible in create mode
      expect(screen.getByTestId('nl-input-section')).toBeInTheDocument()

      // Switch to edit mode
      rerender(<TaskForm {...defaultProps} task={mockTask} />)

      // NL section should not be visible in edit mode
      expect(screen.queryByTestId('nl-input-section')).not.toBeInTheDocument()
    })

    it('does not call fetch when Enter is pressed with empty input', async () => {
      global.fetch = jest.fn()

      render(<TaskForm {...defaultProps} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      fireEvent.keyDown(nlInput, { key: 'Enter' })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('does not submit the form when Enter is pressed in NL input', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          prefill: {
            title: 'Test',
            description: '',
            points: 10,
            time_of_day: 'anytime',
            recurring: null,
            assigned_to: null,
          },
        }),
      })

      const handleSubmit = jest.fn().mockResolvedValue(undefined)
      render(<TaskForm {...defaultProps} onSubmit={handleSubmit} />)

      const nlInput = screen.getByLabelText('Describe the quest')
      await userEvent.type(nlInput, 'Test quest')
      await userEvent.keyboard('{Enter}')

      // fetch should be called for NL parsing, but form should not be submitted
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it('resets NL input when form is closed and reopened', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          prefill: {
            title: 'Parsed Quest',
            description: '',
            points: 10,
            time_of_day: 'anytime',
            recurring: null,
            assigned_to: null,
          },
        }),
      })

      const { rerender } = render(<TaskForm {...defaultProps} isOpen={true} />)

      // Type into NL input and parse
      const nlInput = screen.getByLabelText('Describe the quest')
      fireEvent.change(nlInput, { target: { value: 'Some quest' } })
      expect(nlInput).toHaveValue('Some quest')

      // Close the form
      rerender(<TaskForm {...defaultProps} isOpen={false} />)

      // Reopen the form
      rerender(<TaskForm {...defaultProps} isOpen={true} />)

      // NL input should be empty
      expect(screen.getByLabelText('Describe the quest')).toHaveValue('')
    })
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewardForm } from '@/components/rewards/reward-form'
import type { Reward } from '@/lib/types'

const mockReward: Reward = {
  id: 'reward-1',
  family_id: 'family-1',
  title: 'Movie Night',
  description: 'Pick any movie',
  points_cost: 50,
  icon_id: 'movie',
  category: 'activities',
  stock: 5,
  active: true,
  created_by: 'parent-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(undefined),
}

describe('RewardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('create mode', () => {
    it('shows "New Reward" title', () => {
      render(<RewardForm {...defaultProps} />)
      expect(screen.getByText('New Reward')).toBeInTheDocument()
    })

    it('shows "Create Reward" submit button', () => {
      render(<RewardForm {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Create Reward' })).toBeInTheDocument()
    })

    it('starts with empty title', () => {
      render(<RewardForm {...defaultProps} />)
      expect(screen.getByLabelText(/Title/i)).toHaveValue('')
    })

    it('starts with default points cost of 10', () => {
      render(<RewardForm {...defaultProps} />)
      expect(screen.getByLabelText(/Points Cost/i)).toHaveValue('10')
    })
  })

  describe('edit mode', () => {
    it('shows "Edit Reward" title', () => {
      render(<RewardForm {...defaultProps} reward={mockReward} />)
      expect(screen.getByText('Edit Reward')).toBeInTheDocument()
    })

    it('shows "Save Changes" submit button', () => {
      render(<RewardForm {...defaultProps} reward={mockReward} />)
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    })

    it('pre-populates title from reward', () => {
      render(<RewardForm {...defaultProps} reward={mockReward} />)
      expect(screen.getByLabelText(/Title/i)).toHaveValue('Movie Night')
    })

    it('pre-populates points cost from reward', () => {
      render(<RewardForm {...defaultProps} reward={mockReward} />)
      expect(screen.getByLabelText(/Points Cost/i)).toHaveValue('50')
    })

    it('pre-populates stock from reward', () => {
      render(<RewardForm {...defaultProps} reward={mockReward} />)
      expect(screen.getByLabelText(/Stock Limit/i)).toHaveValue('5')
    })

    it('resets to empty when switching to create mode', () => {
      const { rerender } = render(<RewardForm {...defaultProps} reward={mockReward} />)
      rerender(<RewardForm {...defaultProps} reward={undefined} />)
      expect(screen.getByLabelText(/Title/i)).toHaveValue('')
    })

    it('populates description (null becomes empty string)', () => {
      const noDesc = { ...mockReward, description: null }
      render(<RewardForm {...defaultProps} reward={noDesc} />)
      expect(screen.getByLabelText(/Description/i)).toHaveValue('')
    })

    it('shows stock as empty when reward.stock is null', () => {
      const unlimited = { ...mockReward, stock: null }
      render(<RewardForm {...defaultProps} reward={unlimited} />)
      expect(screen.getByLabelText(/Stock Limit/i)).toHaveValue('')
    })
  })

  describe('validation', () => {
    it('shows error when title is empty on submit', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      expect(screen.getByText('Title is required')).toBeInTheDocument()
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('shows error when points cost is 0', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.clear(screen.getByLabelText(/Points Cost/i))
      await userEvent.type(screen.getByLabelText(/Points Cost/i), '0')
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() =>
        expect(screen.getByText('Points cost must be at least 1')).toBeInTheDocument()
      )
    })

    it('shows error when stock is -1', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.type(screen.getByLabelText(/Stock Limit/i), '-1')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() =>
        expect(screen.getByText('Stock must be at least 1 if provided')).toBeInTheDocument()
      )
    })
  })

  describe('successful submission', () => {
    it('calls onSubmit with form data', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Ice Cream')
      // Submit with default points cost (10), no stock limit
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Ice Cream',
            points_cost: 10,
            stock: null,
          })
        )
      })
    })

    it('includes description in submitted data', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.type(screen.getByLabelText(/Description/i), 'A fun reward')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'A fun reward' })
        )
      })
    })

    it('includes selected category in submitted data', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.selectOptions(screen.getByLabelText(/Category/i), 'treats')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'treats' })
        )
      })
    })

    it('passes stock as number when provided', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Limited Reward')
      await userEvent.type(screen.getByLabelText(/Stock Limit/i), '3')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ stock: 3 })
        )
      })
    })

    it('calls onClose after successful submit', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled())
    })
  })

  describe('error handling', () => {
    it('shows error message when submit throws', async () => {
      const onSubmit = jest.fn().mockRejectedValue(new Error('DB error'))
      render(<RewardForm {...defaultProps} onSubmit={onSubmit} />)
      await userEvent.type(screen.getByLabelText(/Title/i), 'Test')
      await userEvent.click(screen.getByRole('button', { name: 'Create Reward' }))
      await waitFor(() =>
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      )
    })
  })

  describe('cancel', () => {
    it('calls onClose when Cancel clicked', async () => {
      render(<RewardForm {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('icon selection', () => {
    it('renders icon grid buttons', () => {
      render(<RewardForm {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Movie' })).toBeInTheDocument()
    })

    it('selects clicked icon', async () => {
      render(<RewardForm {...defaultProps} />)
      const gameBtn = screen.getByRole('button', { name: 'Game' })
      await userEvent.click(gameBtn)
      expect(gameBtn).toHaveClass('ring-2')
    })
  })

  describe('not open', () => {
    it('renders nothing when isOpen is false', () => {
      render(<RewardForm {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('New Reward')).not.toBeInTheDocument()
    })
  })
})

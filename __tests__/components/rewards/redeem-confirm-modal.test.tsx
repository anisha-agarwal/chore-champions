import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RedeemConfirmModal } from '@/components/rewards/redeem-confirm-modal'
import type { Reward } from '@/lib/types'

const mockReward: Reward = {
  id: 'reward-1',
  family_id: 'family-1',
  title: 'Movie Night',
  description: null,
  points_cost: 50,
  icon_id: 'movie',
  category: 'activities',
  stock: null,
  active: true,
  created_by: 'parent-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onConfirm: jest.fn().mockResolvedValue(undefined),
  reward: mockReward,
  userPoints: 100,
}

describe('RedeemConfirmModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when reward is null', () => {
    render(<RedeemConfirmModal {...defaultProps} reward={null} />)
    expect(screen.queryByText('Redeem Reward')).not.toBeInTheDocument()
  })

  it('renders nothing when isOpen is false', () => {
    render(<RedeemConfirmModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Redeem Reward')).not.toBeInTheDocument()
  })

  it('shows reward title and cost', () => {
    render(<RedeemConfirmModal {...defaultProps} />)
    expect(screen.getByText('Movie Night')).toBeInTheDocument()
    expect(screen.getByText(/50 points/i)).toBeInTheDocument()
  })

  it('shows current balance', () => {
    render(<RedeemConfirmModal {...defaultProps} />)
    expect(screen.getByText('100 pts')).toBeInTheDocument()
  })

  it('shows balance after redemption', () => {
    render(<RedeemConfirmModal {...defaultProps} />)
    // 100 - 50 = 50 pts after
    expect(screen.getByText('50 pts')).toBeInTheDocument()
  })

  it('shows reward emoji', () => {
    render(<RedeemConfirmModal {...defaultProps} />)
    expect(screen.getByRole('img', { name: 'movie' })).toBeInTheDocument()
  })

  it('uses fallback emoji for unknown icon', () => {
    const unknown = { ...mockReward, icon_id: 'unknown_icon' }
    render(<RedeemConfirmModal {...defaultProps} reward={unknown} />)
    expect(screen.getByRole('img', { name: 'unknown_icon' })).toHaveTextContent('🎁')
  })

  it('calls onConfirm and onClose when confirmed', async () => {
    render(<RedeemConfirmModal {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('shows loading state during confirmation', async () => {
    let resolve: () => void
    const promise = new Promise<void>((r) => { resolve = r })
    const onConfirm = jest.fn().mockReturnValue(promise)
    render(<RedeemConfirmModal {...defaultProps} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    resolve!()
    await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument())
  })

  it('shows error when confirmation fails', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('fail'))
    render(<RedeemConfirmModal {...defaultProps} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    )
  })

  it('calls onClose when Cancel clicked', async () => {
    render(<RedeemConfirmModal {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})

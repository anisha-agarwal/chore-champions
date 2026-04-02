import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewardStore } from '@/components/rewards/reward-store'
import type { Reward } from '@/lib/types'

const makeReward = (overrides: Partial<Reward> = {}): Reward => ({
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
  ...overrides,
})

const mockRewards: Reward[] = [
  makeReward({ id: 'r1', title: 'Movie Night', category: 'activities' }),
  makeReward({ id: 'r2', title: 'Ice Cream', category: 'treats', icon_id: 'ice_cream' }),
  makeReward({ id: 'r3', title: 'Screen Time', category: 'screen_time', icon_id: 'game', points_cost: 30 }),
]

const defaultProps = {
  rewards: mockRewards,
  userPoints: 100,
  userRole: 'child' as const,
  onRedeem: jest.fn().mockResolvedValue(undefined),
}

describe('RewardStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no rewards', () => {
    render(<RewardStore {...defaultProps} rewards={[]} />)
    expect(screen.getByText(/No rewards available yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Ask your parents to add some/i)).toBeInTheDocument()
  })

  it('renders all rewards by default', () => {
    render(<RewardStore {...defaultProps} />)
    expect(screen.getByText('Movie Night')).toBeInTheDocument()
    expect(screen.getByText('Ice Cream')).toBeInTheDocument()
    expect(screen.getByText('Screen Time')).toBeInTheDocument()
  })

  it('shows All filter chip as active by default', () => {
    render(<RewardStore {...defaultProps} />)
    const allButton = screen.getByRole('button', { name: 'All' })
    expect(allButton).toHaveClass('bg-purple-100')
  })

  it('shows category filter chips', () => {
    render(<RewardStore {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Activities/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Treats/i })).toBeInTheDocument()
  })

  it('filters rewards by category', async () => {
    render(<RewardStore {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Treats/i }))
    expect(screen.queryByText('Movie Night')).not.toBeInTheDocument()
    expect(screen.getByText('Ice Cream')).toBeInTheDocument()
  })

  it('shows all rewards again when All is clicked', async () => {
    render(<RewardStore {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Treats/i }))
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('Movie Night')).toBeInTheDocument()
    expect(screen.getByText('Ice Cream')).toBeInTheDocument()
  })

  it('shows empty state when category has no rewards', async () => {
    render(<RewardStore {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Privileges/i }))
    expect(screen.getByText(/No rewards available yet/i)).toBeInTheDocument()
  })

  it('opens confirm modal when child clicks Redeem', async () => {
    render(<RewardStore {...defaultProps} />)
    const redeemBtns = screen.getAllByRole('button', { name: 'Redeem' })
    await userEvent.click(redeemBtns[0])
    expect(screen.getByText('Redeem Reward')).toBeInTheDocument()
  })

  it('calls onRedeem when confirm modal confirmed', async () => {
    render(<RewardStore {...defaultProps} />)
    const redeemBtns = screen.getAllByRole('button', { name: 'Redeem' })
    await userEvent.click(redeemBtns[0])
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Redemption' }))
    await waitFor(() => expect(defaultProps.onRedeem).toHaveBeenCalled())
  })

  it('closes modal without calling onRedeem when Cancel clicked', async () => {
    render(<RewardStore {...defaultProps} />)
    const redeemBtns = screen.getAllByRole('button', { name: 'Redeem' })
    await userEvent.click(redeemBtns[0])
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Redeem Reward')).not.toBeInTheDocument()
    expect(defaultProps.onRedeem).not.toHaveBeenCalled()
  })

  it('does not show Redeem buttons for parent role', () => {
    render(<RewardStore {...defaultProps} userRole="parent" />)
    expect(screen.queryByRole('button', { name: 'Redeem' })).not.toBeInTheDocument()
  })
})

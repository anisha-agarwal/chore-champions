import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RedemptionHistory } from '@/components/rewards/redemption-history'
import type { RewardRedemptionWithDetails } from '@/lib/types'

const now = new Date()
const makeRedemption = (
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  daysAgo = 0
): RewardRedemptionWithDetails => ({
  id,
  reward_id: 'reward-1',
  redeemed_by: 'child-1',
  points_cost: 50,
  status,
  redeemed_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
  resolved_at: null,
  resolved_by: null,
  rewards: { title: 'Movie Night', icon_id: 'movie' },
})

const defaultProps = {
  redemptions: [],
  hasMore: false,
  onLoadMore: jest.fn(),
  loadingMore: false,
}

describe('RedemptionHistory', () => {
  it('shows empty state when no redemptions', () => {
    render(<RedemptionHistory {...defaultProps} />)
    expect(screen.getByText(/No rewards redeemed yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Browse the store to get started/i)).toBeInTheDocument()
  })

  it('renders list of redemptions', () => {
    const redemptions = [makeRedemption('r1', 'pending')]
    render(<RedemptionHistory {...defaultProps} redemptions={redemptions} />)
    expect(screen.getByText('Movie Night')).toBeInTheDocument()
    expect(screen.getByText(/50 pts/)).toBeInTheDocument()
  })

  it('shows "Waiting for approval" badge for pending', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'pending')]} />)
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
  })

  it('shows "Approved" badge for approved', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'approved')]} />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows "Rejected — points refunded" badge for rejected', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'rejected')]} />)
    expect(screen.getByText('Rejected — points refunded')).toBeInTheDocument()
  })

  it('shows "Today" for redemptions from today', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'pending', 0)]} />)
    expect(screen.getByText(/Today/)).toBeInTheDocument()
  })

  it('shows "Yesterday" for redemptions from 1 day ago', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'pending', 1)]} />)
    expect(screen.getByText(/Yesterday/)).toBeInTheDocument()
  })

  it('shows "X days ago" for recent redemptions', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'pending', 3)]} />)
    expect(screen.getByText(/3 days ago/)).toBeInTheDocument()
  })

  it('shows "X weeks ago" for older redemptions', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'pending', 10)]} />)
    expect(screen.getByText(/weeks ago/)).toBeInTheDocument()
  })

  it('shows "X months ago" for old redemptions', () => {
    render(<RedemptionHistory {...defaultProps} redemptions={[makeRedemption('r1', 'pending', 40)]} />)
    expect(screen.getByText(/months ago/)).toBeInTheDocument()
  })

  it('shows Load more button when hasMore is true', () => {
    render(
      <RedemptionHistory
        {...defaultProps}
        redemptions={[makeRedemption('r1', 'pending')]}
        hasMore
      />
    )
    expect(screen.getByRole('button', { name: /Load more/i })).toBeInTheDocument()
  })

  it('does not show Load more when hasMore is false', () => {
    render(
      <RedemptionHistory
        {...defaultProps}
        redemptions={[makeRedemption('r1', 'pending')]}
        hasMore={false}
      />
    )
    expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument()
  })

  it('calls onLoadMore when Load more clicked', async () => {
    const onLoadMore = jest.fn()
    render(
      <RedemptionHistory
        {...defaultProps}
        redemptions={[makeRedemption('r1', 'pending')]}
        hasMore
        onLoadMore={onLoadMore}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /Load more/i }))
    expect(onLoadMore).toHaveBeenCalled()
  })

  it('shows loading state on Load more when loadingMore is true', () => {
    render(
      <RedemptionHistory
        {...defaultProps}
        redemptions={[makeRedemption('r1', 'pending')]}
        hasMore
        loadingMore
      />
    )
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('uses fallback emoji for unknown icon', () => {
    const redemption = makeRedemption('r1', 'pending')
    redemption.rewards = { title: 'Unknown', icon_id: 'unknown_icon' }
    render(<RedemptionHistory {...defaultProps} redemptions={[redemption]} />)
    expect(screen.getByRole('img', { name: 'unknown_icon' })).toHaveTextContent('🎁')
  })
})

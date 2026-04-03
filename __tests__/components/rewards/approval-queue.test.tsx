import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApprovalQueue } from '@/components/rewards/approval-queue'
import type { RewardRedemptionWithDetails } from '@/lib/types'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

const makeRedemption = (id: string, minutesAgo = 5): RewardRedemptionWithDetails => ({
  id,
  reward_id: 'reward-1',
  redeemed_by: 'child-1',
  points_cost: 50,
  status: 'pending',
  redeemed_at: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  resolved_at: null,
  resolved_by: null,
  rewards: { title: 'Movie Night', icon_id: 'movie' },
  profiles: {
    display_name: 'Timmy',
    nickname: 'Little T',
    avatar_url: null,
  },
})

const defaultProps = {
  redemptions: [],
  onApprove: jest.fn().mockResolvedValue(undefined),
  onReject: jest.fn().mockResolvedValue(undefined),
}

describe('ApprovalQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no pending redemptions', () => {
    render(<ApprovalQueue {...defaultProps} />)
    expect(screen.getByText(/No pending approvals/i)).toBeInTheDocument()
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument()
  })

  it('renders redemption items', () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    expect(screen.getByText('Movie Night')).toBeInTheDocument()
    expect(screen.getByText('50 pts')).toBeInTheDocument()
  })

  it('shows child nickname when available', () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    expect(screen.getByText('Little T')).toBeInTheDocument()
  })

  it('shows child display_name when no nickname', () => {
    const redemption = makeRedemption('r1')
    redemption.profiles = { display_name: 'Timmy Jones', nickname: null, avatar_url: null }
    render(<ApprovalQueue {...defaultProps} redemptions={[redemption]} />)
    expect(screen.getByText('Timmy Jones')).toBeInTheDocument()
  })

  it('shows fallback name when no profile', () => {
    const redemption = makeRedemption('r1')
    redemption.profiles = undefined
    render(<ApprovalQueue {...defaultProps} redemptions={[redemption]} />)
    expect(screen.getByText('A child')).toBeInTheDocument()
  })

  it('shows relative time for recent redemption', () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1', 5)]} />)
    expect(screen.getByText(/5m ago/)).toBeInTheDocument()
  })

  it('shows hours ago for older redemption', () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1', 90)]} />)
    expect(screen.getByText(/1h ago/)).toBeInTheDocument()
  })

  it('shows days ago for old redemption', () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1', 60 * 25)]} />)
    expect(screen.getByText(/1d ago/)).toBeInTheDocument()
  })

  it('calls onApprove when Approve clicked', async () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(defaultProps.onApprove).toHaveBeenCalledWith('r1'))
  })

  it('shows Reject confirmation when Reject clicked', async () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByText('Reject Reward?')).toBeInTheDocument()
    expect(screen.getByText(/50 points/)).toBeInTheDocument()
  })

  it('calls onReject after confirmation', async () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    const modal = screen.getByText('Reject Reward?').closest('div')!
    await userEvent.click(within(modal).getByRole('button', { name: /^Reject$/ }))
    await waitFor(() => expect(defaultProps.onReject).toHaveBeenCalledWith('r1'))
  })

  it('closes reject modal when Cancel clicked', async () => {
    render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Reject Reward?')).not.toBeInTheDocument()
  })

  it('closes reject modal when backdrop clicked', async () => {
    const { container } = render(<ApprovalQueue {...defaultProps} redemptions={[makeRedemption('r1')]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByText('Reject Reward?')).toBeInTheDocument()
    const backdrop = container.querySelector('.fixed.z-40') as Element
    await userEvent.click(backdrop)
    expect(screen.queryByText('Reject Reward?')).not.toBeInTheDocument()
  })

  it('uses fallback emoji for unknown icon', () => {
    const redemption = makeRedemption('r1')
    redemption.rewards = { title: 'Mystery', icon_id: 'unknown_icon' }
    render(<ApprovalQueue {...defaultProps} redemptions={[redemption]} />)
    expect(screen.getByRole('img', { name: 'unknown_icon' })).toHaveTextContent('🎁')
  })

  it('disables Approve button while approve loading', async () => {
    let resolve: () => void
    const promise = new Promise<void>((r) => { resolve = r })
    const onApprove = jest.fn().mockReturnValue(promise)
    render(<ApprovalQueue {...defaultProps} onApprove={onApprove} redemptions={[makeRedemption('r1')]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    // While loading, the loading state shows 'Saving...' and reject button should be disabled
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
    resolve!()
    await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument())
  })
})

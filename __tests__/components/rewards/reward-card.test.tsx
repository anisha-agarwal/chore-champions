import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewardCard } from '@/components/rewards/reward-card'
import type { Reward } from '@/lib/types'

const mockReward: Reward = {
  id: 'reward-1',
  family_id: 'family-1',
  title: 'Movie Night',
  description: 'Pick any movie to watch',
  points_cost: 50,
  icon_id: 'movie',
  category: 'activities',
  stock: null,
  active: true,
  created_by: 'parent-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('RewardCard', () => {
  describe('store view — child', () => {
    it('renders title, cost, and emoji', () => {
      render(
        <RewardCard reward={mockReward} userPoints={100} userRole="child" />
      )
      expect(screen.getByText('Movie Night')).toBeInTheDocument()
      expect(screen.getByText('50 pts')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'movie' })).toBeInTheDocument()
    })

    it('renders description when provided', () => {
      render(<RewardCard reward={mockReward} userPoints={100} userRole="child" />)
      expect(screen.getByText('Pick any movie to watch')).toBeInTheDocument()
    })

    it('does not render description when absent', () => {
      const noDesc = { ...mockReward, description: null }
      render(<RewardCard reward={noDesc} userPoints={100} userRole="child" />)
      expect(screen.queryByText('Pick any movie to watch')).not.toBeInTheDocument()
    })

    it('shows Redeem button when child can afford', () => {
      render(<RewardCard reward={mockReward} userPoints={100} userRole="child" />)
      expect(screen.getByRole('button', { name: 'Redeem' })).toBeInTheDocument()
    })

    it('shows "Need X more pts" when child cannot afford', () => {
      render(<RewardCard reward={mockReward} userPoints={20} userRole="child" />)
      expect(screen.getByRole('button', { name: /Need 30 more pts/i })).toBeInTheDocument()
    })

    it('disables button when child cannot afford', () => {
      render(<RewardCard reward={mockReward} userPoints={20} userRole="child" />)
      expect(screen.getByRole('button', { name: /Need 30 more pts/i })).toBeDisabled()
    })

    it('shows "Out of stock" when stock is 0', () => {
      const outOfStock = { ...mockReward, stock: 0 }
      render(<RewardCard reward={outOfStock} userPoints={100} userRole="child" />)
      expect(screen.getByRole('button', { name: 'Out of stock' })).toBeInTheDocument()
    })

    it('disables button when out of stock', () => {
      const outOfStock = { ...mockReward, stock: 0 }
      render(<RewardCard reward={outOfStock} userPoints={100} userRole="child" />)
      expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled()
    })

    it('shows stock remaining badge when stock > 0', () => {
      const limited = { ...mockReward, stock: 3 }
      render(<RewardCard reward={limited} userPoints={100} userRole="child" />)
      expect(screen.getByText('3 left')).toBeInTheDocument()
    })

    it('shows out of stock badge when stock is 0', () => {
      const oos = { ...mockReward, stock: 0 }
      render(<RewardCard reward={oos} userPoints={100} userRole="child" />)
      // Badge in stock indicator (not the button)
      const badges = screen.getAllByText('Out of stock')
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    it('does not show stock badge when unlimited (null)', () => {
      render(<RewardCard reward={mockReward} userPoints={100} userRole="child" />)
      expect(screen.queryByText(/left/)).not.toBeInTheDocument()
    })

    it('calls onRedeem with reward id when Redeem clicked', async () => {
      const onRedeem = jest.fn().mockResolvedValue(undefined)
      render(
        <RewardCard reward={mockReward} userPoints={100} userRole="child" onRedeem={onRedeem} />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Redeem' }))
      expect(onRedeem).toHaveBeenCalledWith('reward-1')
    })

    it('shows loading state while redeeming', async () => {
      let resolve: () => void
      const promise = new Promise<void>((r) => { resolve = r })
      const onRedeem = jest.fn().mockReturnValue(promise)
      render(
        <RewardCard reward={mockReward} userPoints={100} userRole="child" onRedeem={onRedeem} />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Redeem' }))
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      resolve!()
      await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument())
    })

    it('uses fallback emoji for unknown icon_id', () => {
      const unknown = { ...mockReward, icon_id: 'nonexistent' }
      render(<RewardCard reward={unknown} userPoints={100} userRole="child" />)
      expect(screen.getByRole('img', { name: 'nonexistent' })).toHaveTextContent('🎁')
    })

    it('does nothing when Redeem clicked without onRedeem handler', async () => {
      render(<RewardCard reward={mockReward} userPoints={100} userRole="child" />)
      await userEvent.click(screen.getByRole('button', { name: 'Redeem' }))
      // No error thrown and no loading state
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    })
  })

  describe('store view — parent', () => {
    it('does not show Redeem button for parent', () => {
      render(<RewardCard reward={mockReward} userPoints={0} userRole="parent" />)
      expect(screen.queryByRole('button', { name: 'Redeem' })).not.toBeInTheDocument()
    })
  })

  describe('manage view', () => {
    it('shows Edit, Deactivate, Delete buttons for active reward', () => {
      render(
        <RewardCard
          reward={mockReward}
          userPoints={0}
          userRole="parent"
          isManageView
          onEdit={jest.fn()}
          onToggle={jest.fn()}
          onDelete={jest.fn()}
        />
      )
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('shows Activate button for inactive reward', () => {
      const inactive = { ...mockReward, active: false }
      render(
        <RewardCard reward={inactive} userPoints={0} userRole="parent" isManageView onToggle={jest.fn()} />
      )
      expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument()
    })

    it('shows Inactive badge for inactive reward', () => {
      const inactive = { ...mockReward, active: false }
      render(<RewardCard reward={inactive} userPoints={0} userRole="parent" isManageView />)
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('applies opacity class for inactive reward in manage view', () => {
      const inactive = { ...mockReward, active: false }
      const { container } = render(
        <RewardCard reward={inactive} userPoints={0} userRole="parent" isManageView />
      )
      expect(container.firstChild).toHaveClass('opacity-50')
    })

    it('does not apply opacity for active reward', () => {
      const { container } = render(
        <RewardCard reward={mockReward} userPoints={0} userRole="parent" isManageView />
      )
      expect(container.firstChild).not.toHaveClass('opacity-50')
    })

    it('calls onEdit when Edit clicked', async () => {
      const onEdit = jest.fn()
      render(
        <RewardCard reward={mockReward} userPoints={0} userRole="parent" isManageView onEdit={onEdit} />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      expect(onEdit).toHaveBeenCalledWith(mockReward)
    })

    it('calls onDelete when Delete clicked', async () => {
      const onDelete = jest.fn()
      render(
        <RewardCard reward={mockReward} userPoints={0} userRole="parent" isManageView onDelete={onDelete} />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(onDelete).toHaveBeenCalledWith(mockReward)
    })

    it('calls onToggle when toggle button clicked', async () => {
      const onToggle = jest.fn().mockResolvedValue(undefined)
      render(
        <RewardCard reward={mockReward} userPoints={0} userRole="parent" isManageView onToggle={onToggle} />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
      expect(onToggle).toHaveBeenCalledWith(mockReward)
    })

    it('shows loading state while toggling', async () => {
      let resolve: () => void
      const promise = new Promise<void>((r) => { resolve = r })
      const onToggle = jest.fn().mockReturnValue(promise)
      render(
        <RewardCard reward={mockReward} userPoints={0} userRole="parent" isManageView onToggle={onToggle} />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      resolve!()
      await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument())
    })

    it('does nothing when toggle clicked without onToggle handler', async () => {
      render(
        <RewardCard reward={mockReward} userPoints={0} userRole="parent" isManageView />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    })
  })
})

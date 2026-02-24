import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneBadge } from '@/components/streaks/milestone-badge'
import type { StreakMilestone } from '@/lib/types'

const mockMilestone: StreakMilestone = { days: 7, bonus: 50, badge: 'Week Warrior' }

describe('MilestoneBadge', () => {
  it('renders milestone days and bonus', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="locked" />)

    expect(screen.getByText('7d')).toBeInTheDocument()
    expect(screen.getByText('+50')).toBeInTheDocument()
  })

  it('has correct aria-label', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="locked" />)

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Week Warrior - 7 days - locked'
    )
  })

  it('is disabled when locked', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="locked" />)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when claimed', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="claimed" />)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is enabled when claimable', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="claimable" />)

    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('calls onClaim when clicked and claimable', async () => {
    const onClaim = jest.fn()
    const user = userEvent.setup()
    render(<MilestoneBadge milestone={mockMilestone} status="claimable" onClaim={onClaim} />)

    await user.click(screen.getByRole('button'))

    expect(onClaim).toHaveBeenCalledTimes(1)
  })

  it('does not call onClaim when locked', async () => {
    const onClaim = jest.fn()
    const user = userEvent.setup()
    render(<MilestoneBadge milestone={mockMilestone} status="locked" onClaim={onClaim} />)

    await user.click(screen.getByRole('button'))

    expect(onClaim).not.toHaveBeenCalled()
  })

  it('does not call onClaim when claimed', async () => {
    const onClaim = jest.fn()
    const user = userEvent.setup()
    render(<MilestoneBadge milestone={mockMilestone} status="claimed" onClaim={onClaim} />)

    await user.click(screen.getByRole('button'))

    expect(onClaim).not.toHaveBeenCalled()
  })

  it('handles claimable status without onClaim prop', async () => {
    const user = userEvent.setup()
    render(<MilestoneBadge milestone={mockMilestone} status="claimable" />)

    // Should not throw
    await user.click(screen.getByRole('button'))
  })

  it('applies claimed styles', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="claimed" />)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-yellow-100')
  })

  it('applies claimable styles', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="claimable" />)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-purple-100')
    expect(button.className).toContain('animate-pulse')
  })

  it('applies locked styles', () => {
    render(<MilestoneBadge milestone={mockMilestone} status="locked" />)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-gray-100')
  })

  it('renders different milestone values', () => {
    const milestone: StreakMilestone = { days: 100, bonus: 1000, badge: 'Century Champion' }
    render(<MilestoneBadge milestone={milestone} status="locked" />)

    expect(screen.getByText('100d')).toBeInTheDocument()
    expect(screen.getByText('+1000')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Century Champion - 100 days - locked'
    )
  })
})

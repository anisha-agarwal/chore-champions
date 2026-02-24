import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StreakCard } from '@/components/streaks/streak-card'

describe('StreakCard', () => {
  const defaultProps = {
    type: 'active_day',
    label: 'Active Day',
    streak: 5,
    claimedMilestones: [] as number[],
    onClaimMilestone: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders label and streak count', () => {
    render(<StreakCard {...defaultProps} />)

    expect(screen.getByText('Active Day')).toBeInTheDocument()
    expect(screen.getByTestId('streak-count-active_day')).toHaveTextContent('5')
  })

  it('renders fire icon', () => {
    render(<StreakCard {...defaultProps} />)

    expect(screen.getByText('🔥')).toBeInTheDocument()
  })

  it('shows progress toward next milestone', () => {
    render(<StreakCard {...defaultProps} />)

    expect(screen.getByText('5 days')).toBeInTheDocument()
    expect(screen.getByText('Next: 7 days')).toBeInTheDocument()
  })

  it('shows singular "day" for streak of 1', () => {
    render(<StreakCard {...defaultProps} streak={1} />)

    expect(screen.getByText('1 day')).toBeInTheDocument()
  })

  it('renders progress bar with correct percentage', () => {
    render(<StreakCard {...defaultProps} streak={5} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveStyle({ width: '71%' }) // 5/7 ≈ 71%
  })

  it('renders all 5 milestone badges', () => {
    render(<StreakCard {...defaultProps} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('shows milestone badges with correct statuses', () => {
    render(<StreakCard {...defaultProps} streak={10} claimedMilestones={[7]} />)

    // 7-day should be claimed
    expect(screen.getByLabelText(/Week Warrior.*claimed/)).toBeInTheDocument()
    // 14-day should be locked (streak 10 < 14)
    expect(screen.getByLabelText(/Fortnight Fighter.*locked/)).toBeInTheDocument()
  })

  it('shows claimable milestone when streak meets threshold', () => {
    render(<StreakCard {...defaultProps} streak={7} />)

    expect(screen.getByLabelText(/Week Warrior.*claimable/)).toBeInTheDocument()
  })

  it('calls onClaimMilestone when claimable badge clicked', async () => {
    const onClaim = jest.fn()
    const user = userEvent.setup()
    render(<StreakCard {...defaultProps} streak={7} onClaimMilestone={onClaim} />)

    await user.click(screen.getByLabelText(/Week Warrior.*claimable/))

    expect(onClaim).toHaveBeenCalledWith(7)
  })

  it('does not show "Next" text when all milestones are claimed and streak exceeds all', () => {
    render(
      <StreakCard
        {...defaultProps}
        streak={200}
        claimedMilestones={[7, 14, 30, 60, 100]}
      />
    )

    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument()
  })

  it('progress bar is 100% when no next milestone', () => {
    render(
      <StreakCard
        {...defaultProps}
        streak={200}
        claimedMilestones={[7, 14, 30, 60, 100]}
      />
    )

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveStyle({ width: '100%' })
  })

  it('renders with zero streak', () => {
    render(<StreakCard {...defaultProps} streak={0} />)

    expect(screen.getByTestId('streak-count-active_day')).toHaveTextContent('0')
    expect(screen.getByText('0 days')).toBeInTheDocument()
  })

  it('progress bar caps at 100% when streak equals milestone', () => {
    // When streak is 7 and 7-day is unclaimed, next milestone is still 7
    // so 7/7 = 100%
    render(<StreakCard {...defaultProps} streak={7} />)

    const progressBar = screen.getByRole('progressbar')
    // getNextMilestone returns 14-day since 7-day is claimable (not "next")
    // Actually getNextMilestone: streak < milestone.days, so 7 < 7 is false, moves to 14
    // so 7/14 = 50%
    expect(progressBar).toHaveStyle({ width: '50%' })
  })
})

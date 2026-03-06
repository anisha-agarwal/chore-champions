import { render, screen } from '@testing-library/react'
import { BadgeCollection } from '@/components/analytics/badge-collection'
import type { BadgeInfo, UserStreaks } from '@/lib/types'

const mockStreaks: UserStreaks = {
  active_day_streak: 5,
  perfect_day_streak: 3,
  task_streaks: [{ task_id: 'task-1', title: 'Clean Room', current_streak: 4 }],
}

function makeBadge(overrides: Partial<BadgeInfo> = {}): BadgeInfo {
  return {
    badge_name: 'Week Warrior',
    milestone_days: 7,
    streak_type: 'active_day',
    task_id: null,
    claimed_at: null,
    ...overrides,
  }
}

describe('BadgeCollection', () => {
  it('shows empty state when badges array is empty', () => {
    render(<BadgeCollection badges={[]} streaks={mockStreaks} />)
    expect(screen.getByText('Complete streaks to earn badges!')).toBeInTheDocument()
  })

  it('does not render list when empty', () => {
    render(<BadgeCollection badges={[]} streaks={mockStreaks} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders badge grid as list with label', () => {
    render(<BadgeCollection badges={[makeBadge()]} streaks={mockStreaks} />)
    expect(screen.getByRole('list', { name: 'Badge collection' })).toBeInTheDocument()
  })

  it('renders badge name and streak type label', () => {
    render(
      <BadgeCollection
        badges={[makeBadge({ badge_name: 'Fire Starter', streak_type: 'active_day', milestone_days: 3 })]}
        streaks={mockStreaks}
      />
    )
    expect(screen.getByText('Fire Starter')).toBeInTheDocument()
    expect(screen.getByText(/Active Day/)).toBeInTheDocument()
    expect(screen.getByText(/3d/)).toBeInTheDocument()
  })

  it('shows correct streak type labels', () => {
    const badges = [
      makeBadge({ badge_name: 'A', streak_type: 'active_day', milestone_days: 5 }),
      makeBadge({ badge_name: 'B', streak_type: 'perfect_day', milestone_days: 7 }),
      makeBadge({ badge_name: 'C', streak_type: 'task', milestone_days: 10, task_id: 'task-1' }),
    ]
    render(<BadgeCollection badges={badges} streaks={mockStreaks} />)
    expect(screen.getByText(/Active Day/)).toBeInTheDocument()
    expect(screen.getByText(/Perfect Day/)).toBeInTheDocument()
    expect(screen.getByText(/Task/)).toBeInTheDocument()
  })

  it('renders progress bar with correct percentage for unclaimed badge', () => {
    // active_day_streak=5, milestone_days=10 => 50%
    render(
      <BadgeCollection
        badges={[makeBadge({ milestone_days: 10 })]}
        streaks={mockStreaks}
      />
    )
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '50')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('shows percentage text for unclaimed badge', () => {
    render(
      <BadgeCollection
        badges={[makeBadge({ milestone_days: 10 })]}
        streaks={mockStreaks}
      />
    )
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders claimed badge with 100% progress and "Claimed!" text', () => {
    render(
      <BadgeCollection
        badges={[makeBadge({ claimed_at: '2024-01-01' })]}
        streaks={mockStreaks}
      />
    )
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Claimed!')).toBeInTheDocument()
  })

  it('applies purple styling for claimed badges', () => {
    const { container } = render(
      <BadgeCollection
        badges={[makeBadge({ claimed_at: '2024-01-01' })]}
        streaks={mockStreaks}
      />
    )
    const li = container.querySelector('li')
    expect(li).toHaveClass('border-purple-200', 'bg-purple-50')
  })

  it('applies gray styling for unclaimed badges', () => {
    const { container } = render(
      <BadgeCollection
        badges={[makeBadge()]}
        streaks={mockStreaks}
      />
    )
    const li = container.querySelector('li')
    expect(li).toHaveClass('border-gray-200', 'bg-gray-50')
  })

  it('has aria-label on progress bar with badge name', () => {
    render(
      <BadgeCollection
        badges={[makeBadge({ badge_name: 'Fire Starter', milestone_days: 10 })]}
        streaks={mockStreaks}
      />
    )
    expect(screen.getByLabelText('Fire Starter progress: 50%')).toBeInTheDocument()
  })

  it('renders multiple badges', () => {
    const badges = [
      makeBadge({ badge_name: 'Badge A' }),
      makeBadge({ badge_name: 'Badge B' }),
      makeBadge({ badge_name: 'Badge C' }),
    ]
    render(<BadgeCollection badges={badges} streaks={mockStreaks} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
  })

  it('clamps progress to 100% when streak exceeds milestone', () => {
    // active_day_streak=5, milestone_days=3 => clamped to 100%
    render(
      <BadgeCollection
        badges={[makeBadge({ milestone_days: 3 })]}
        streaks={mockStreaks}
      />
    )
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '100')
  })

  it('uses purple-600 fill for claimed progress bar and purple-300 for unclaimed', () => {
    const { container } = render(
      <BadgeCollection
        badges={[
          makeBadge({ badge_name: 'Claimed', claimed_at: '2024-01-01' }),
          makeBadge({ badge_name: 'Unclaimed' }),
        ]}
        streaks={mockStreaks}
      />
    )
    const bars = container.querySelectorAll('[role="progressbar"] > div')
    expect(bars[0]).toHaveClass('bg-purple-600')
    expect(bars[1]).toHaveClass('bg-purple-300')
  })
})

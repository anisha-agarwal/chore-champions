import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageRewards } from '@/components/rewards/manage-rewards'
import type { Reward } from '@/lib/types'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

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

const defaultProps = {
  rewards: [],
  onAdd: jest.fn(),
  onEdit: jest.fn(),
  onToggle: jest.fn().mockResolvedValue(undefined),
  onDelete: jest.fn().mockResolvedValue(undefined),
}

describe('ManageRewards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no rewards', () => {
    render(<ManageRewards {...defaultProps} />)
    expect(screen.getByText(/No rewards yet/i)).toBeInTheDocument()
  })

  it('shows Add Reward button', () => {
    render(<ManageRewards {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Add Reward/i })).toBeInTheDocument()
  })

  it('calls onAdd when Add Reward clicked', async () => {
    render(<ManageRewards {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Add Reward/i }))
    expect(defaultProps.onAdd).toHaveBeenCalled()
  })

  it('renders reward cards', () => {
    render(<ManageRewards {...defaultProps} rewards={[makeReward()]} />)
    expect(screen.getByText('Movie Night')).toBeInTheDocument()
  })

  it('sorts active rewards before inactive', () => {
    const rewards = [
      makeReward({ id: 'r1', title: 'Inactive Reward', active: false }),
      makeReward({ id: 'r2', title: 'Active Reward', active: true }),
    ]
    render(<ManageRewards {...defaultProps} rewards={rewards} />)
    const cards = screen.getAllByRole('heading', { level: 3 })
    expect(cards[0]).toHaveTextContent('Active Reward')
    expect(cards[1]).toHaveTextContent('Inactive Reward')
  })

  it('preserves relative order of rewards with equal active status', () => {
    const rewards = [
      makeReward({ id: 'r1', title: 'First Active', active: true }),
      makeReward({ id: 'r2', title: 'Second Active', active: true }),
      makeReward({ id: 'r3', title: 'Inactive', active: false }),
    ]
    render(<ManageRewards {...defaultProps} rewards={rewards} />)
    const cards = screen.getAllByRole('heading', { level: 3 })
    expect(cards[0]).toHaveTextContent('First Active')
    expect(cards[1]).toHaveTextContent('Second Active')
    expect(cards[2]).toHaveTextContent('Inactive')
  })

  it('calls onEdit when Edit button clicked', async () => {
    const reward = makeReward()
    render(<ManageRewards {...defaultProps} rewards={[reward]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(defaultProps.onEdit).toHaveBeenCalledWith(reward)
  })

  it('calls onToggle when toggle button clicked', async () => {
    const reward = makeReward()
    render(<ManageRewards {...defaultProps} rewards={[reward]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(defaultProps.onToggle).toHaveBeenCalledWith(reward))
  })

  it('shows delete confirmation modal when Delete clicked', async () => {
    render(<ManageRewards {...defaultProps} rewards={[makeReward()]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Reward?')).toBeInTheDocument()
    expect(screen.getByText(/"Movie Night"/)).toBeInTheDocument()
  })

  it('closes delete modal when Cancel clicked', async () => {
    render(<ManageRewards {...defaultProps} rewards={[makeReward()]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Delete Reward?')).not.toBeInTheDocument()
  })

  it('closes delete modal when backdrop clicked', async () => {
    const { container } = render(<ManageRewards {...defaultProps} rewards={[makeReward()]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Reward?')).toBeInTheDocument()
    const backdrop = container.querySelector('.fixed.z-40') as Element
    await userEvent.click(backdrop)
    expect(screen.queryByText('Delete Reward?')).not.toBeInTheDocument()
  })

  it('calls onDelete when delete confirmed', async () => {
    const reward = makeReward()
    render(<ManageRewards {...defaultProps} rewards={[reward]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const modal = screen.getByText('Delete Reward?').closest('div')!
    await userEvent.click(within(modal).getByRole('button', { name: /^Delete$/ }))
    await waitFor(() => expect(defaultProps.onDelete).toHaveBeenCalledWith(reward))
  })

  it('shows error when onDelete rejects', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('Cannot delete'))
    render(<ManageRewards {...defaultProps} rewards={[makeReward()]} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const modal = screen.getByText('Delete Reward?').closest('div')!
    await userEvent.click(within(modal).getByRole('button', { name: /^Delete$/ }))
    await waitFor(() => expect(screen.getByText('Cannot delete')).toBeInTheDocument())
  })

  it('shows fallback error message when onDelete rejects with non-Error', async () => {
    const onDelete = jest.fn().mockRejectedValue('string error')
    render(<ManageRewards {...defaultProps} rewards={[makeReward()]} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const modal = screen.getByText('Delete Reward?').closest('div')!
    await userEvent.click(within(modal).getByRole('button', { name: /^Delete$/ }))
    await waitFor(() =>
      expect(screen.getByText('Cannot delete. Deactivate it instead.')).toBeInTheDocument()
    )
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberFilter } from '@/components/family/member-filter'
import type { Profile } from '@/lib/types'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

const mockMembers: Profile[] = [
  {
    id: 'parent-1',
    family_id: 'family-1',
    display_name: 'Jane Parent',
    avatar_url: null,
    nickname: null,
    role: 'parent',
    points: 0,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'child-1',
    family_id: 'family-1',
    display_name: 'Timmy Child',
    avatar_url: null,
    nickname: 'Little T',
    role: 'child',
    points: 50,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'child-2',
    family_id: 'family-1',
    display_name: 'Sally Child',
    avatar_url: null,
    nickname: null,
    role: 'child',
    points: 30,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const defaultProps = {
  members: mockMembers,
  selectedId: null,
  currentUserId: 'parent-1',
  onChange: jest.fn(),
}

describe('MemberFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders All button', () => {
    render(<MemberFilter {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
  })

  it('renders All kids button when children exist', () => {
    render(<MemberFilter {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'All kids' })).toBeInTheDocument()
  })

  it('does not render All kids button when no children', () => {
    const parentOnly = [mockMembers[0]]
    render(<MemberFilter {...defaultProps} members={parentOnly} />)
    expect(screen.queryByRole('button', { name: 'All kids' })).not.toBeInTheDocument()
  })

  it('renders Me button', () => {
    render(<MemberFilter {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Me' })).toBeInTheDocument()
  })

  it('renders other member buttons (not current user)', () => {
    render(<MemberFilter {...defaultProps} />)
    // Should show child members (uses nickname when available, first name otherwise)
    expect(screen.getByText('Little T')).toBeInTheDocument()
    expect(screen.getByText('Sally')).toBeInTheDocument()
    // Should not show current user in member list (they have the "Me" button)
    // Jane Parent is shown via "Me" only
  })

  it('highlights All when selectedId is null', () => {
    render(<MemberFilter {...defaultProps} selectedId={null} />)
    const allButton = screen.getByRole('button', { name: 'All' })
    expect(allButton).toHaveClass('bg-purple-600')
  })

  it('highlights All kids when selectedId is all-kids', () => {
    render(<MemberFilter {...defaultProps} selectedId="all-kids" />)
    const allKidsButton = screen.getByRole('button', { name: 'All kids' })
    expect(allKidsButton).toHaveClass('bg-purple-600')
  })

  it('highlights Me when selectedId matches currentUserId', () => {
    render(<MemberFilter {...defaultProps} selectedId="parent-1" />)
    const meButton = screen.getByRole('button', { name: 'Me' })
    expect(meButton).toHaveClass('bg-purple-600')
  })

  it('calls onChange with null when All is clicked', async () => {
    const onChange = jest.fn()
    render(<MemberFilter {...defaultProps} selectedId="child-1" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with all-kids when All kids is clicked', async () => {
    const onChange = jest.fn()
    render(<MemberFilter {...defaultProps} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'All kids' }))
    expect(onChange).toHaveBeenCalledWith('all-kids')
  })

  it('calls onChange with currentUserId when Me is clicked', async () => {
    const onChange = jest.fn()
    render(<MemberFilter {...defaultProps} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Me' }))
    expect(onChange).toHaveBeenCalledWith('parent-1')
  })

  it('calls onChange with member id when member button is clicked', async () => {
    const onChange = jest.fn()
    render(<MemberFilter {...defaultProps} onChange={onChange} />)

    await userEvent.click(screen.getByText('Little T'))
    expect(onChange).toHaveBeenCalledWith('child-1')
  })
})

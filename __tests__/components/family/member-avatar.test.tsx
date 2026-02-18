import { render, screen } from '@testing-library/react'
import { MemberAvatar } from '@/components/family/member-avatar'
import type { Profile } from '@/lib/types'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

const mockParent: Profile = {
  id: 'parent-1',
  family_id: 'family-1',
  display_name: 'Jane Doe',
  avatar_url: '/avatars/panther.svg',
  nickname: null,
  role: 'parent',
  points: 150,
  created_at: '2024-01-01T00:00:00Z',
}

const mockChild: Profile = {
  id: 'child-1',
  family_id: 'family-1',
  display_name: 'Timmy Doe',
  avatar_url: null,
  nickname: 'Little T',
  role: 'child',
  points: 75,
  created_at: '2024-01-01T00:00:00Z',
}

describe('MemberAvatar', () => {
  it('renders display name when no nickname', () => {
    render(<MemberAvatar member={mockParent} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('renders nickname when available', () => {
    render(<MemberAvatar member={mockChild} />)
    expect(screen.getByText('Little T')).toBeInTheDocument()
  })

  it('shows role badge for parent', () => {
    const { container } = render(<MemberAvatar member={mockParent} />)
    // Parent badge is an SVG star inside a yellow circle
    const badge = container.querySelector('.bg-yellow-400')
    expect(badge).toBeInTheDocument()
  })

  it('does not show role badge for child', () => {
    const { container } = render(<MemberAvatar member={mockChild} />)
    const badge = container.querySelector('.bg-yellow-400')
    expect(badge).not.toBeInTheDocument()
  })

  it('shows points when showPoints is true', () => {
    render(<MemberAvatar member={mockChild} showPoints />)
    expect(screen.getByText('75 pts')).toBeInTheDocument()
  })

  it('does not show points when showPoints is false', () => {
    render(<MemberAvatar member={mockChild} />)
    expect(screen.queryByText('75 pts')).not.toBeInTheDocument()
  })

  it('applies sm size text class', () => {
    render(<MemberAvatar member={mockChild} size="sm" />)
    const name = screen.getByText('Little T')
    expect(name).toHaveClass('text-xs')
  })

  it('applies lg size text class by default', () => {
    render(<MemberAvatar member={mockChild} />)
    const name = screen.getByText('Little T')
    expect(name).toHaveClass('text-base')
  })

  it('applies xl size text class', () => {
    render(<MemberAvatar member={mockChild} size="xl" />)
    const name = screen.getByText('Little T')
    expect(name).toHaveClass('text-lg')
  })

  it('applies md size text class', () => {
    render(<MemberAvatar member={mockChild} size="md" />)
    const name = screen.getByText('Little T')
    expect(name).toHaveClass('text-sm')
  })
})

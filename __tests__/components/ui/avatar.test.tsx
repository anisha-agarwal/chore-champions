import { render, screen } from '@testing-library/react'
import { Avatar } from '@/components/ui/avatar'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

describe('Avatar', () => {
  it('renders with image when src is provided', () => {
    render(<Avatar src="/avatar.png" alt="User avatar" />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/avatar.png')
    expect(img).toHaveAttribute('alt', 'User avatar')
  })

  it('renders fallback initials when no src', () => {
    render(<Avatar fallback="John Doe" />)

    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders question mark when no src or fallback', () => {
    render(<Avatar />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies sm size classes', () => {
    const { container } = render(<Avatar size="sm" fallback="A" />)

    expect(container.firstChild).toHaveClass('h-8', 'w-8')
  })

  it('applies md size classes (default)', () => {
    const { container } = render(<Avatar fallback="A" />)

    expect(container.firstChild).toHaveClass('h-10', 'w-10')
  })

  it('applies lg size classes', () => {
    const { container } = render(<Avatar size="lg" fallback="A" />)

    expect(container.firstChild).toHaveClass('h-12', 'w-12')
  })

  it('applies xl size classes', () => {
    const { container } = render(<Avatar size="xl" fallback="A" />)

    expect(container.firstChild).toHaveClass('h-16', 'w-16')
  })

  it('applies 2xl size classes', () => {
    const { container } = render(<Avatar size="2xl" fallback="A" />)

    expect(container.firstChild).toHaveClass('h-28', 'w-28')
  })

  it('applies custom className', () => {
    const { container } = render(<Avatar fallback="A" className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('has rounded-full class for circular shape', () => {
    const { container } = render(<Avatar fallback="A" />)

    expect(container.firstChild).toHaveClass('rounded-full')
  })
})

import { render, screen } from '@testing-library/react'
import { NavBar } from '@/components/layout/nav-bar'

// Mock next/navigation
const mockPathname = jest.fn().mockReturnValue('/quests')
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

describe('NavBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname.mockReturnValue('/quests')
  })

  it('renders all nav items', () => {
    render(<NavBar />)

    expect(screen.getByText('Me')).toBeInTheDocument()
    expect(screen.getByText('Quests')).toBeInTheDocument()
    expect(screen.getByText('Rewards')).toBeInTheDocument()
    expect(screen.getByText('Family')).toBeInTheDocument()
  })

  it('renders nav items as links', () => {
    render(<NavBar />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)

    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/me')
    expect(hrefs).toContain('/quests')
    expect(hrefs).toContain('/rewards')
    expect(hrefs).toContain('/family')
  })

  it('highlights active Quests link when on /quests', () => {
    mockPathname.mockReturnValue('/quests')
    render(<NavBar />)

    const questsLink = screen.getByRole('link', { name: /quests/i })
    expect(questsLink).toHaveClass('text-purple-600')
  })

  it('highlights active Family link when on /family', () => {
    mockPathname.mockReturnValue('/family')
    render(<NavBar />)

    const familyLink = screen.getByRole('link', { name: /family/i })
    expect(familyLink).toHaveClass('text-purple-600')
  })

  it('highlights active Me link when on /me', () => {
    mockPathname.mockReturnValue('/me')
    render(<NavBar />)

    const meLink = screen.getByRole('link', { name: /^me$/i })
    expect(meLink).toHaveClass('text-purple-600')
  })

  it('highlights active Rewards link when on /rewards', () => {
    mockPathname.mockReturnValue('/rewards')
    render(<NavBar />)

    const rewardsLink = screen.getByRole('link', { name: /rewards/i })
    expect(rewardsLink).toHaveClass('text-purple-600')
  })

  it('non-active links have gray color', () => {
    mockPathname.mockReturnValue('/quests')
    render(<NavBar />)

    const familyLink = screen.getByRole('link', { name: /family/i })
    expect(familyLink).toHaveClass('text-gray-400')
  })

  it('renders within a nav element', () => {
    render(<NavBar />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})

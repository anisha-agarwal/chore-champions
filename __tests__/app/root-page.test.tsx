import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'

// Mock next/navigation
const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    // Throw to stop execution like the real redirect does
    throw new Error('NEXT_REDIRECT')
  },
}))

// Mock Supabase server client
const mockGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders landing page content when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const Component = await HomePage()
    render(Component)

    expect(screen.getByRole('heading', { name: /chore champions/i })).toBeInTheDocument()
    expect(screen.getByText(/turn household tasks into epic quests/i)).toBeInTheDocument()
  })

  it('renders Get Started Free link', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const Component = await HomePage()
    render(Component)

    const link = screen.getByRole('link', { name: /get started free/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/signup')
  })

  it('renders Sign In link', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const Component = await HomePage()
    render(Component)

    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders feature cards', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const Component = await HomePage()
    render(Component)

    expect(screen.getByText('Create Quests')).toBeInTheDocument()
    expect(screen.getByText('Family Fun')).toBeInTheDocument()
    expect(screen.getByText('Earn Rewards')).toBeInTheDocument()
  })

  it('redirects authenticated users to /quests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    try {
      await HomePage()
    } catch {
      // redirect throws
    }

    expect(mockRedirect).toHaveBeenCalledWith('/quests')
  })
})

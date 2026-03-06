import { render, screen } from '@testing-library/react'
import AnalyticsPage from '@/app/(dashboard)/analytics/page'

// Mock next/navigation
const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

// Mock ParentAnalytics component
jest.mock('@/components/analytics/parent-analytics', () => ({
  ParentAnalytics: ({ familyId, userId }: { familyId: string; userId: string }) => (
    <div data-testid="parent-analytics">Analytics for {familyId} by {userId}</div>
  ),
}))

// Mock Supabase server client
const mockGetUser = jest.fn()
const mockProfileData = { current: null as unknown }

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockProfileData.current }),
          }),
        }),
      }),
    }),
}))

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to /login when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    try {
      await AnalyticsPage()
    } catch {
      // redirect throws
    }

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /me when profile is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileData.current = null

    try {
      await AnalyticsPage()
    } catch {
      // redirect throws
    }

    expect(mockRedirect).toHaveBeenCalledWith('/me')
  })

  it('redirects to /me when user is not a parent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileData.current = { role: 'child', family_id: 'family-1' }

    try {
      await AnalyticsPage()
    } catch {
      // redirect throws
    }

    expect(mockRedirect).toHaveBeenCalledWith('/me')
  })

  it('redirects to /family when parent has no family_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileData.current = { role: 'parent', family_id: null }

    try {
      await AnalyticsPage()
    } catch {
      // redirect throws
    }

    expect(mockRedirect).toHaveBeenCalledWith('/family')
  })

  it('renders ParentAnalytics when authenticated parent with family', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileData.current = { role: 'parent', family_id: 'family-1' }

    const Component = await AnalyticsPage()
    render(Component)

    expect(screen.getByRole('heading', { name: 'Family Analytics' })).toBeInTheDocument()
    expect(screen.getByTestId('parent-analytics')).toBeInTheDocument()
    expect(screen.getByText('Analytics for family-1 by user-1')).toBeInTheDocument()
  })
})

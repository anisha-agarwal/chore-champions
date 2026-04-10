import { render, screen } from '@testing-library/react'
import ChatPage from '@/app/(dashboard)/chat/page'

const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

jest.mock('@/components/chat/chat-panel', () => ({
  ChatPanel: ({ systemName }: { systemName: string }) => (
    <div data-testid="chat-panel">{systemName}</div>
  ),
}))

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (...args: unknown[]) => mockFrom(...args),
    }),
}))

describe('ChatPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to /login when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    try {
      await ChatPage()
    } catch {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /quests when profile is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
        }),
      }),
    })
    try {
      await ChatPage()
    } catch {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith('/quests')
  })

  it('redirects to /quests when user is not a parent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: 'child' } }),
        }),
      }),
    })
    try {
      await ChatPage()
    } catch {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith('/quests')
  })

  it('renders ChatPanel with parent config for authenticated parent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: 'parent' } }),
        }),
      }),
    })
    const Component = await ChatPage()
    render(Component)
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByText('Parenting Assistant')).toBeInTheDocument()
  })
})

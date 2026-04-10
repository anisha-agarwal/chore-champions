import { render, screen } from '@testing-library/react'
import QuestBuddyPage from '@/app/(dashboard)/quest-buddy/page'

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

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
    }),
}))

describe('QuestBuddyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to /login when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    try {
      await QuestBuddyPage()
    } catch {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('renders ChatPanel with Quest Buddy config for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const Component = await QuestBuddyPage()
    render(Component)
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByText('Quest Buddy')).toBeInTheDocument()
  })
})

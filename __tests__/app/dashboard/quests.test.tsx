import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestsPage from '@/app/(dashboard)/quests/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/quests',
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock data
const mockUser = { id: 'user-1', email: 'test@example.com' }
const mockProfile = {
  id: 'user-1',
  family_id: 'family-1',
  display_name: 'Test Parent',
  avatar_url: null,
  nickname: null,
  role: 'parent',
  points: 100,
  created_at: '2024-01-01T00:00:00Z',
}

const mockMembers = [
  mockProfile,
  {
    id: 'child-1',
    family_id: 'family-1',
    display_name: 'Timmy',
    avatar_url: null,
    nickname: 'Little T',
    role: 'child',
    points: 50,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockTasks = [
  {
    id: 'task-1',
    family_id: 'family-1',
    title: 'Clean Room',
    description: 'Make bed and vacuum',
    assigned_to: 'child-1',
    points: 10,
    time_of_day: 'morning',
    recurring: null,
    due_date: '2024-01-15',
    due_time: null,
    completed: false,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    profiles: { id: 'child-1', display_name: 'Timmy', avatar_url: null, nickname: 'Little T' },
  },
]

// Supabase mock setup
const mockGetUser = jest.fn()
const mockInsert = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      return {
        select: () => {
          if (table === 'profiles') {
            return {
              eq: () => ({
                single: () => Promise.resolve({ data: mockProfile }),
                // Member query (no single)
                order: () => Promise.resolve({ data: mockMembers }),
              }),
            }
          }
          if (table === 'tasks') {
            return {
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => Promise.resolve({ data: mockTasks }),
                  }),
                }),
                lte: () => ({
                  not: () => ({
                    order: () => Promise.resolve({ data: [] }),
                  }),
                }),
              }),
            }
          }
          if (table === 'task_skips') {
            return {
              in: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }
          }
          if (table === 'task_completions') {
            return {
              in: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }
          }
          return {
            eq: () => ({
              single: () => Promise.resolve({ data: null }),
            }),
          }
        },
        insert: mockInsert,
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }
    },
  }),
}))

describe('QuestsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('shows loading state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}))
    render(<QuestsPage />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders page header with title', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
    })
  })

  it('renders user points in header', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('points')).toBeInTheDocument()
    })
  })

  it('renders task list with task titles', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('Clean Room')).toBeInTheDocument()
    })
  })

  it('renders task description', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('Make bed and vacuum')).toBeInTheDocument()
    })
  })

  it('renders task points', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('10 pts')).toBeInTheDocument()
    })
  })

  it('shows no-family state when user has no family', async () => {
    const noFamilyProfile = { ...mockProfile, family_id: null }
    mockGetUser.mockResolvedValue({ data: { user: mockUser } })

    // Override profile query for this test
    jest.spyOn(console, 'error').mockImplementation()

    // Re-mock with no family
    const originalMock = jest.requireMock('@/lib/supabase/client')
    const origCreateClient = originalMock.createClient
    originalMock.createClient = () => ({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: noFamilyProfile }),
          }),
        }),
      }),
    })

    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByText('No Family Yet')).toBeInTheDocument()
    })

    // Restore
    originalMock.createClient = origCreateClient
  })

  it('renders FAB button to add quest', async () => {
    render(<QuestsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
    })

    // FAB button - find the fixed positioned button
    const fab = document.querySelector('button.fixed')
    expect(fab).toBeInTheDocument()
  })

  it('opens task form when FAB is clicked', async () => {
    const user = userEvent.setup()
    render(<QuestsPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument()
    })

    const fab = document.querySelector('button.fixed') as HTMLElement
    await user.click(fab)

    expect(screen.getByText('New Quest')).toBeInTheDocument()
  })
})
